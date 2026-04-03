import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { getSchedule, updateDate, cancelDate, deleteDate, bulkSyncSchedule } from '@/services/schedule';
import { getPosts } from '@/services/bulletin';
import { getConflicts } from '@/services/conflicts';
import { getAssignments, assignCast, unassignCast, type CastAssignment } from '@/services/castAssignments';
import { useAuth } from '@/hooks/useAuth';
import { formatTime } from '@/utils/format';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { ChalkText } from '@/components/theater/Chalkboard';
import { GafferTape } from '@/components/theater/GafferTape';
import type { RehearsalDate } from '@/types';

// Map rehearsal types to gaffer tape colors (must match sticky note colors)
const tapeColorMap: Record<string, 'yellow' | 'blue' | 'purple' | 'pink' | 'white'> = {
  regular: 'yellow',
  tech: 'blue',
  dress: 'purple',
  performance: 'pink',
  blocked: 'white',
};

function isStaffRole(role: string | null) {
  return role === 'director' || role === 'staff';
}

// Types cycle order when clicking in edit mode
const typesCycle = ['', 'regular', 'tech', 'dress', 'performance', 'blocked'] as const;
type DayType = typeof typesCycle[number];

const typeConfig: Record<string, { label: string; noteBg: string; noteText: string; chalkBg: string }> = {
  regular:     { label: 'Rehearsal', noteBg: 'hsl(48, 90%, 85%)', noteText: 'hsl(35, 40%, 20%)', chalkBg: 'rgba(255,255,255,0.08)' },
  tech:        { label: 'Tech', noteBg: 'hsl(210, 70%, 88%)', noteText: 'hsl(210, 30%, 22%)', chalkBg: 'rgba(100,180,255,0.1)' },
  dress:       { label: 'Dress', noteBg: 'hsl(280, 60%, 88%)', noteText: 'hsl(280, 30%, 25%)', chalkBg: 'rgba(200,140,255,0.1)' },
  performance: { label: 'Show', noteBg: 'hsl(340, 80%, 88%)', noteText: 'hsl(340, 30%, 25%)', chalkBg: 'rgba(255,140,100,0.1)' },
  blocked:     { label: 'Blocked', noteBg: 'hsl(0, 0%, 75%)', noteText: 'hsl(0, 0%, 30%)', chalkBg: 'rgba(255,80,80,0.06)' },
};

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const spring = { type: 'spring' as const, stiffness: 120, damping: 18 };

export function SchedulePage() {
  usePageTitle('Schedule');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userRole, production, members } = useProduction();
  const { toast } = useToast();
  const { user } = useAuth();
  const isCast = userRole === 'cast';
  const canEdit = isStaffRole(userRole);
  const { data: dates, refetch } = useApi(() => getSchedule(id!), [id]);
  const { data: bulletinPosts } = useApi(() => getPosts(id!), [id]);
  const { data: myAssignments } = useApi<CastAssignment[]>(
    () => isCast && user ? getAssignments(id!, user.id) : Promise.resolve([]),
    [id, isCast, user?.id],
  );

  // Admin/staff: fetch conflicts and all assignments
  const { data: conflictsData } = useApi<any[]>(
    () => canEdit ? getConflicts(id!) : Promise.resolve([]),
    [id, canEdit],
  );
  const { data: allAssignments, refetch: refetchAssignments } = useApi<CastAssignment[]>(
    () => canEdit ? getAssignments(id!) : Promise.resolve([]),
    [id, canEdit],
  );

  // Conflict count map: date string -> { count, conflicts[] }
  const conflictMap = useMemo(() => {
    const map: Record<string, { count: number; conflicts: { user_id: string; reason: string | null }[] }> = {};
    if (!conflictsData) return map;
    for (const d of conflictsData) {
      if (d.conflict_count > 0) {
        map[d.date] = { count: d.conflict_count, conflicts: d.conflicts || [] };
      }
    }
    return map;
  }, [conflictsData]);

  // Assignments by date ID
  const assignmentsByDateId = useMemo(() => {
    const map: Record<string, string[]> = {}; // dateId -> userId[]
    if (!allAssignments) return map;
    for (const a of allAssignments) {
      (map[a.rehearsal_date_id] ??= []).push(a.user_id);
    }
    return map;
  }, [allAssignments]);

  // Set of date strings the cast member is assigned to
  const myAssignedDates = useMemo(() => {
    const set = new Set<string>();
    if (!myAssignments) return set;
    for (const a of myAssignments) {
      if (a.date) set.add(a.date);
    }
    return set;
  }, [myAssignments]);

  // Map bulletin posts to dates (YYYY-MM-DD) for pulse indicators
  const bulletinDateSet = useMemo(() => {
    const set = new Set<string>();
    if (!bulletinPosts) return set;
    for (const post of bulletinPosts) {
      const d = new Date(post.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      set.add(key);
    }
    return set;
  }, [bulletinPosts]);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Edit mode — click days to set types
  const [editMode, setEditMode] = useState(false);
  const [dayTypes, setDayTypes] = useState<Record<string, DayType>>({});
  const [defaultTime, setDefaultTime] = useState({ start: '18:00', end: '21:00' });
  const [saving, setSaving] = useState(false);

  // Weekly pattern — set what happens each day of the week
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  const [weeklyPattern, setWeeklyPattern] = useState<Record<number, DayType>>({});

  // Helper: fill dayTypes for a given month from a weekly pattern.
  // Pattern is authoritative — it sets the type for every matching day-of-week.
  // `overrides` are per-day clicks that take priority over the pattern.
  function fillMonthFromPattern(year: number, month: number, pattern: Record<number, DayType>, overrides: Record<string, DayType> = {}): Record<string, DayType> {
    const updated: Record<string, DayType> = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      // Per-day override wins, then pattern, then nothing
      if (overrides[key]) {
        updated[key] = overrides[key];
      } else {
        const pType = pattern[date.getDay()];
        if (pType) updated[key] = pType;
      }
    }
    return updated;
  }

  // Cycle weekly pattern for a day-of-week (0=Sun, 6=Sat)
  function cycleWeekDay(dow: number) {
    const current = weeklyPattern[dow] || '';
    const idx = typesCycle.indexOf(current as DayType);
    const next = typesCycle[(idx + 1) % typesCycle.length];
    const newPattern = { ...weeklyPattern };
    if (next === '') delete newPattern[dow];
    else newPattern[dow] = next;
    setWeeklyPattern(newPattern);

    // Re-fill the current month from the updated pattern
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    setDayTypes(prev => {
      // First clear all days matching this dow (remove old pattern for this day-of-week)
      const cleared = { ...prev };
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        if (date.getDay() === dow) {
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          delete cleared[key];
        }
      }
      // Then fill from the full updated pattern (all days, not just this one dow)
      return fillMonthFromPattern(year, month, newPattern, cleared);
    });
  }

  // Single date edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editNote, setEditNote] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth]);

  // Map existing dates to calendar
  const dateMap = useMemo(() => {
    const map: Record<number, RehearsalDate[]> = {};
    if (!dates) return map;
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    for (const d of dates) {
      if (d.is_deleted) continue;
      const dt = new Date(d.date + 'T00:00:00');
      if (dt.getFullYear() === year && dt.getMonth() === month) {
        (map[dt.getDate()] ??= []).push(d);
      }
    }
    return map;
  }, [dates, currentMonth]);

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentMonth.getFullYear() && today.getMonth() === currentMonth.getMonth();

  // Build overrides for a given month — dates whose type differs from the weekly pattern
  function getMonthOverrides(year: number, month: number, pattern: Record<number, DayType>): Record<string, DayType> {
    const overrides: Record<string, DayType> = {};
    if (!dates) return overrides;
    for (const dt of dates) {
      if (dt.is_deleted || dt.is_cancelled) continue;
      const dd = new Date(dt.date + 'T00:00:00');
      if (dd.getFullYear() === year && dd.getMonth() === month) {
        const patternType = pattern[dd.getDay()];
        if (dt.type !== patternType) {
          overrides[dt.date] = dt.type as DayType;
        }
      }
    }
    return overrides;
  }

  function prevMonth() {
    setCurrentMonth(d => {
      const next = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      if (editMode && Object.keys(weeklyPattern).length > 0) {
        const overrides = getMonthOverrides(next.getFullYear(), next.getMonth(), weeklyPattern);
        setDayTypes(fillMonthFromPattern(next.getFullYear(), next.getMonth(), weeklyPattern, overrides));
      }
      return next;
    });
    setSelectedDay(null);
  }
  function nextMonth() {
    setCurrentMonth(d => {
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      if (editMode && Object.keys(weeklyPattern).length > 0) {
        const overrides = getMonthOverrides(next.getFullYear(), next.getMonth(), weeklyPattern);
        setDayTypes(fillMonthFromPattern(next.getFullYear(), next.getMonth(), weeklyPattern, overrides));
      }
      return next;
    });
    setSelectedDay(null);
  }

  // Get date string for a calendar day
  function dateStr(day: number) {
    const y = currentMonth.getFullYear();
    const m = String(currentMonth.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-${String(day).padStart(2, '0')}`;
  }

  // Click day in edit mode — cycle through types
  const handleDayClick = useCallback((day: number) => {
    if (!editMode) {
      setSelectedDay(prev => prev === day ? null : day);
      return;
    }
    const key = dateStr(day);
    const current = dayTypes[key] || '';
    const currentIdx = typesCycle.indexOf(current as DayType);
    const nextIdx = (currentIdx + 1) % typesCycle.length;
    const nextType = typesCycle[nextIdx];
    setDayTypes(prev => {
      const updated = { ...prev };
      if (nextType === '') delete updated[key];
      else updated[key] = nextType;
      return updated;
    });
  }, [editMode, dayTypes, currentMonth]);

  function startEditMode() {
    setEditMode(true);
    setSelectedDay(null);

    // Reconstruct weekly pattern from ALL existing dates (most common type per day-of-week)
    const dowCounts: Record<number, Record<string, number>> = {};
    if (dates) {
      for (const d of dates) {
        if (d.is_deleted || d.is_cancelled) continue;
        const dt = new Date(d.date + 'T00:00:00');
        const dow = dt.getDay();
        dowCounts[dow] ??= {};
        dowCounts[dow][d.type] = (dowCounts[dow][d.type] || 0) + 1;
      }
    }
    const reconstructed: Record<number, DayType> = {};
    for (const [dow, counts] of Object.entries(dowCounts)) {
      let best = '';
      let bestCount = 0;
      for (const [type, count] of Object.entries(counts)) {
        if (count > bestCount) { best = type; bestCount = count; }
      }
      if (best) reconstructed[Number(dow)] = best as DayType;
    }
    setWeeklyPattern(reconstructed);

    // Find per-day overrides — dates whose type differs from what the pattern says
    const overrides: Record<string, DayType> = {};
    if (dates) {
      for (const d of dates) {
        if (d.is_deleted || d.is_cancelled) continue;
        const dt = new Date(d.date + 'T00:00:00');
        const patternType = reconstructed[dt.getDay()];
        if (d.type !== patternType) {
          overrides[d.date] = d.type as DayType;
        }
      }
    }

    // Apply pattern to current month with overrides
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    setDayTypes(fillMonthFromPattern(year, month, reconstructed, overrides));

    // Reconstruct default times from first existing date
    if (dates) {
      const first = dates.find(d => !d.is_deleted && !d.is_cancelled);
      if (first) {
        setDefaultTime({ start: first.start_time, end: first.end_time });
      }
    }
  }

  function cancelEditMode() {
    setEditMode(false);
    setDayTypes({});
    setWeeklyPattern({});
  }

  // Build a lookup of existing dates by date string
  const existingByDate = useMemo(() => {
    const map: Record<string, RehearsalDate> = {};
    if (!dates) return map;
    for (const d of dates) {
      if (d.is_deleted) continue;
      // Keep the non-cancelled version if there is one
      if (!map[d.date] || (map[d.date].is_cancelled && !d.is_cancelled)) {
        map[d.date] = d;
      }
    }
    return map;
  }, [dates]);

  // All types the backend accepts (including blocked)
  const validBackendTypes = new Set(['regular', 'tech', 'dress', 'performance', 'blocked']);

  // Expand the weekly pattern across the production date range
  function expandPatternToFullRange(pattern: Record<number, DayType>): Record<string, DayType> {
    const expanded: Record<string, DayType> = {};
    if (Object.keys(pattern).length === 0) return expanded;

    const todayStr = new Date().toISOString().split('T')[0];
    // Start from today or first_rehearsal (whichever is later)
    const startStr = production?.first_rehearsal && production.first_rehearsal > todayStr
      ? production.first_rehearsal : todayStr;
    // End at closing_night, or 6 months from now — whichever is LATER
    const fallbackEnd = new Date();
    fallbackEnd.setMonth(fallbackEnd.getMonth() + 6);
    const fallbackStr = fallbackEnd.toISOString().split('T')[0];
    const closingStr = production?.closing_night || '';
    const endStr = closingStr > fallbackStr ? closingStr : fallbackStr;

    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      const pType = pattern[dow];
      if (!pType) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      expanded[key] = pType;
    }
    return expanded;
  }

  // Apply — save the weekly pattern across the full production + any per-day overrides
  async function applySchedule() {
    if (!id) return;
    setSaving(true);
    try {
      // Merge: weekly pattern expanded across ALL months + per-day overrides
      const patternDates = expandPatternToFullRange(weeklyPattern);
      const allDayTypes = { ...patternDates, ...dayTypes };

      // Build the full target list in one shot
      const bulkDates: { date: string; start_time: string; end_time: string; type: string }[] = [];
      for (const [date, type] of Object.entries(allDayTypes)) {
        if (!type || !validBackendTypes.has(type)) continue;
        bulkDates.push({ date, start_time: defaultTime.start, end_time: defaultTime.end, type });
      }

      const result = await bulkSyncSchedule(id, bulkDates);

      const parts = [];
      if (result.added) parts.push(`${result.added} added`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.removed) parts.push(`${result.removed} removed`);
      toast(parts.length ? parts.join(', ') : 'No changes');

      setEditMode(false);
      setDayTypes({});
      setWeeklyPattern({});
      refetch();
    } catch { toast('Failed to save schedule', 'error'); }
    finally { setSaving(false); }
  }

  // Count pending changes — includes the full-range weekly pattern expansion
  const changes = useMemo(() => {
    let newDates = 0, modified = 0, removals = 0;
    const keptDates = new Set<string>();

    // Merge pattern across all months + per-day overrides
    const patternDates = expandPatternToFullRange(weeklyPattern);
    const allDayTypes = { ...patternDates, ...dayTypes };

    for (const [date, type] of Object.entries(allDayTypes)) {
      if (!type || !validBackendTypes.has(type)) continue;
      keptDates.add(date);
      const existing = existingByDate[date];
      if (!existing || existing.is_cancelled) newDates++;
      else if (existing.type !== type || existing.start_time !== defaultTime.start || existing.end_time !== defaultTime.end) modified++;
    }

    // Dates that existed but won't be kept
    for (const [date, existing] of Object.entries(existingByDate)) {
      if (existing.is_cancelled || keptDates.has(date)) continue;
      removals++;
    }

    return { newDates, modified, removals, total: newDates + modified + removals };
  }, [dayTypes, weeklyPattern, existingByDate, defaultTime, production]);
  // Handlers for existing date edits
  async function handleEditSave() {
    if (!editId || !id) return; setBusy(true);
    try { await updateDate(id, editId, { start_time: editStart, end_time: editEnd, note: editNote || undefined }); toast('Updated'); setEditId(null); refetch(); }
    catch { toast('Failed', 'error'); } finally { setBusy(false); }
  }
  async function handleCancel(dateId: string) {
    if (!id) return; setBusy(true);
    try { await cancelDate(id, dateId); toast('Cancelled'); refetch(); }
    catch { toast('Failed', 'error'); } finally { setBusy(false); }
  }
  async function handleDelete() {
    if (!deleteId || !id) return; setBusy(true);
    try { await deleteDate(id, deleteId, true); toast('Deleted'); setDeleteId(null); refetch(); }
    catch { toast('Failed', 'error'); } finally { setBusy(false); }
  }

  const selectedEvents = selectedDay ? (dateMap[selectedDay] || []) : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <ChalkText size="lg">Schedule</ChalkText>
        {canEdit && !editMode && (
          <button onClick={startEditMode}
            className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded cursor-pointer"
            style={{ background: 'rgba(255,220,100,0.1)', color: 'rgba(255,220,100,0.8)', border: '1px solid rgba(255,220,100,0.15)' }}>
            Edit Schedule
          </button>
        )}
      </div>

      {/* Edit mode toolbar */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            className="mb-4 rounded-sm p-3 space-y-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,220,100,0.12)' }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {/* Weekly pattern — set the recurring weekly flow */}
            <div>
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgba(255,220,100,0.6)' }}>
                Weekly Pattern — click to set each day
              </p>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day, dow) => {
                  const pattern = weeklyPattern[dow];
                  const config = pattern ? typeConfig[pattern] : null;
                  return (
                    <motion.button
                      key={dow}
                      onClick={() => cycleWeekDay(dow)}
                      className="flex flex-col items-center gap-1 py-2 rounded-sm cursor-pointer"
                      style={{
                        background: config ? config.chalkBg : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${config ? 'rgba(255,220,100,0.12)' : 'rgba(255,255,255,0.04)'}`,
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>{day}</span>
                      {config ? (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-[2px]"
                          style={{ background: config.noteBg, color: config.noteText }}>
                          {config.label}
                        </span>
                      ) : (
                        <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.2)' }}>off</span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Then override individual days below */}
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Then click individual days on the calendar below to override or block specific dates
            </p>

            {/* Default times */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Default time:</span>
              <input type="time" value={defaultTime.start} onChange={e => setDefaultTime(p => ({ ...p, start: e.target.value }))}
                className="px-2 py-1 rounded-sm text-xs outline-none w-24"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }} />
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>to</span>
              <input type="time" value={defaultTime.end} onChange={e => setDefaultTime(p => ({ ...p, end: e.target.value }))}
                className="px-2 py-1 rounded-sm text-xs outline-none w-24"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }} />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {Object.entries(typeConfig).map(([type, c]) => (
                  <div key={type} className="flex items-center gap-1">
                    <div className="w-3 h-2 rounded-[1px]" style={{ background: c.noteBg }} />
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '8px' }}>{c.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={cancelEditMode} className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded cursor-pointer"
                  style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}>
                  Cancel
                </button>
                <button onClick={applySchedule} disabled={saving || changes.total === 0}
                  className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded cursor-pointer font-bold"
                  style={{ color: 'hsl(25,20%,8%)', background: 'hsl(38,70%,50%)', opacity: (saving || changes.total === 0) ? 0.5 : 1 }}>
                  {saving ? 'Saving...' : changes.total === 0 ? 'No changes' : `Apply ${changes.total} change${changes.total !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Month nav */}
      <div className="flex items-center justify-center gap-6 mb-5">
        <button onClick={prevMonth} className="cursor-pointer px-2 py-1 text-lg" style={{ color: 'rgba(255,255,255,0.35)' }}>&lsaquo;</button>
        <h2 style={{ color: 'rgba(255,255,255,0.8)', fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', letterSpacing: '0.04em' }}>
          {monthName}
        </h2>
        <button onClick={nextMonth} className="cursor-pointer px-2 py-1 text-lg" style={{ color: 'rgba(255,255,255,0.35)' }}>&rsaquo;</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map(day => (
          <div key={day} className="text-center py-1" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {day}
          </div>
        ))}
      </div>
      <div className="mb-3 mx-1" style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 10%, rgba(255,255,255,0.1) 90%, transparent)' }} />

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-[2px]">
        {calendarDays.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="min-h-[80px]" />;

          const key = dateStr(day);
          const editType = dayTypes[key]; // Type set in edit mode
          const events = dateMap[day] || [];
          const hasEvent = events.length > 0;
          const isToday = isCurrentMonth && day === today.getDate();
          const isSelected = selectedDay === day;
          const topEvent = events.find(e => !e.is_cancelled) || events[0];

          // What to show: edit mode type OR existing event
          // Cast: only see their assigned dates + blocked dates
          const isBlockedDate = topEvent && topEvent.type === 'blocked';
          const isAssignedToMe = !isCast || isBlockedDate || myAssignedDates.has(key);
          const displayType = editMode && editType ? editType
            : (topEvent && !topEvent.is_cancelled && isAssignedToMe ? topEvent.type : null);
          const config = displayType ? typeConfig[displayType] : null;
          const isCancelled = hasEvent && events.every(e => e.is_cancelled);
          const isBlocked = displayType === 'blocked';
          const hasBulletinPost = bulletinDateSet.has(dateStr(day));

          return (
            <motion.button
              key={day}
              onClick={() => handleDayClick(day)}
              className="relative flex flex-col items-center rounded-sm cursor-pointer min-h-[80px] p-1"
              style={{
                background: isSelected ? 'rgba(255,255,255,0.06)'
                  : isBlocked ? (typeConfig.blocked?.chalkBg || 'rgba(255,80,80,0.06)')
                  : editMode && editType ? (typeConfig[editType]?.chalkBg || 'transparent')
                  : 'transparent',
                outline: isBlocked ? '1px dashed rgba(255,80,80,0.2)'
                  : editMode && editType ? `1px dashed rgba(255,220,100,0.15)` : 'none',
              }}
              whileHover={editMode ? { scale: 1.05 } : {}}
              whileTap={editMode ? { scale: 0.95 } : {}}
              transition={spring}
            >
              {/* Day number */}
              <span style={{
                color: isCancelled ? 'rgba(255,100,100,0.4)'
                  : isBlocked ? 'rgba(255,100,100,0.5)'
                  : isToday ? 'rgba(255,220,100,0.9)'
                  : displayType ? 'rgba(255,255,255,0.75)'
                  : 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                fontWeight: isToday ? 600 : 300,
                textDecoration: (isCancelled || isBlocked) ? 'line-through' : 'none',
              }}>
                {day}
              </span>

              {/* Sticky note */}
              {config && displayType !== 'blocked' && (
                <motion.div
                  className="mt-1 w-full rounded-[2px] px-1.5 py-1 text-left"
                  style={{
                    background: config.noteBg,
                    color: config.noteText,
                    boxShadow: '1px 2px 4px rgba(0,0,0,0.15)',
                    transform: `rotate(${(day % 3 - 1) * 0.5}deg)`,
                    fontSize: '9px',
                    lineHeight: '1.3',
                  }}
                  layout
                >
                  <span className="font-bold block truncate">{config.label}</span>
                  {!editMode && topEvent && (
                    <span className="opacity-60 block truncate">{formatTime(topEvent.start_time)}-{formatTime(topEvent.end_time)}</span>
                  )}
                  {editMode && <span className="opacity-50 block">{defaultTime.start}-{defaultTime.end}</span>}
                </motion.div>
              )}

              {/* Blocked X marker — visible in both edit and view mode */}
              {isBlocked && (
                <div className="mt-2 text-sm font-bold" style={{ color: 'rgba(255,100,100,0.4)' }}>X</div>
              )}

              {/* Multiple events dots */}
              {!editMode && events.filter(e => !e.is_cancelled).length > 1 && (
                <div className="mt-0.5 flex gap-0.5">
                  {events.filter(e => !e.is_cancelled).slice(1, 3).map((e, j) => (
                    <div key={j} className="w-1 h-1 rounded-full" style={{ background: (typeConfig[e.type] || typeConfig.regular).noteBg }} />
                  ))}
                </div>
              )}

              {/* Bulletin post pulse indicator */}
              {!editMode && hasBulletinPost && (
                <motion.div
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ background: 'rgba(255,180,60,0.8)' }}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* Conflict count badge — admin/staff only */}
              {!editMode && canEdit && conflictMap[key] && (
                <div className="absolute top-0.5 left-0.5 text-[8px] font-bold px-1 rounded-full"
                  style={{ background: 'rgba(255,80,80,0.2)', color: 'rgba(255,120,120,0.9)' }}>
                  {conflictMap[key].count}
                </div>
              )}

              {isToday && <div className="absolute bottom-0.5 w-3 h-[2px] rounded-full" style={{ background: 'rgba(255,220,100,0.5)' }} />}
            </motion.button>
          );
        })}
      </div>

      {/* Legend (view mode) — gaffer tape strips */}
      {!editMode && (
        <div className="flex gap-3 justify-center mt-5 flex-wrap">
          {Object.entries(typeConfig).filter(([k]) => k !== 'blocked').map(([type, c]) => (
            <GafferTape
              key={type}
              color={tapeColorMap[type] || 'yellow'}
              rotate={(type.charCodeAt(0) % 3 - 1) * 0.5}
            >
              {c.label}
            </GafferTape>
          ))}
        </div>
      )}

      {/* Selected day detail */}
      {!editMode && selectedDay !== null && (
        <motion.div
          className="mt-5 rounded-sm overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <ChalkText size="md">
              {new Date(currentMonth.getFullYear(), currentMonth.getMonth(), selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </ChalkText>
            <button onClick={() => setSelectedDay(null)} className="cursor-pointer text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>x</button>
          </div>

          {/* Bulletin post link */}
          {bulletinDateSet.has(dateStr(selectedDay)) && (
            <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,180,60,0.04)' }}>
              <motion.div
                className="w-2 h-2 rounded-full"
                style={{ background: 'rgba(255,180,60,0.8)' }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="text-[11px]" style={{ color: 'rgba(255,220,100,0.7)' }}>Bulletin posted this day</span>
              <button
                onClick={() => navigate(`/productions/${id}/bulletin`)}
                className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm cursor-pointer ml-auto"
                style={{ color: 'rgba(255,220,100,0.8)', background: 'rgba(255,220,100,0.08)', border: '1px solid rgba(255,220,100,0.12)' }}
              >
                View Bulletin
              </button>
            </div>
          )}

          {selectedEvents.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontStyle: 'italic' }}>No rehearsals scheduled</span>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {selectedEvents.map(d => {
                const c = typeConfig[d.type] || typeConfig.regular;
                return (
                  <div key={d.id} className={`px-4 py-3 ${d.is_cancelled ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-[2px]" style={{ background: c.noteBg, color: c.noteText }}>{c.label}</span>
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>
                        {formatTime(d.start_time)} - {formatTime(d.end_time)}
                      </span>
                      {d.is_cancelled && <span className="text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(255,80,80,0.1)', color: 'rgba(255,150,150,0.7)' }}>Cancelled</span>}
                    </div>
                    {d.note ? (
                      <div className="mt-2 px-2 py-1.5 rounded-sm" style={{ background: 'rgba(255,220,100,0.04)', border: '1px solid rgba(255,220,100,0.08)' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,220,100,0.5)' }}>Notes</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{d.note}</p>
                      </div>
                    ) : (
                      <p className="text-[10px] mt-1 italic" style={{ color: 'rgba(255,255,255,0.2)' }}>No notes for this day</p>
                    )}
                    {canEdit && !d.is_cancelled && (
                      <div className="flex gap-2 mt-2">
                        <button className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm cursor-pointer"
                          style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}
                          onClick={() => { setEditId(d.id); setEditStart(d.start_time); setEditEnd(d.end_time); setEditNote(d.note || ''); }}>Edit</button>
                        <button className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm cursor-pointer"
                          style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}
                          onClick={() => handleCancel(d.id)}>Cancel</button>
                        <button className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm cursor-pointer"
                          style={{ color: 'rgba(255,150,150,0.5)', background: 'rgba(255,80,80,0.04)' }}
                          onClick={() => setDeleteId(d.id)}>Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Conflicts for this day — admin/staff only */}
          {canEdit && selectedDay && conflictMap[dateStr(selectedDay)] && (
            <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,80,80,0.02)' }}>
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgba(255,120,120,0.7)' }}>
                Conflicts ({conflictMap[dateStr(selectedDay)].count})
              </p>
              <div className="space-y-1 max-h-[120px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {conflictMap[dateStr(selectedDay)].conflicts.map((c, i) => {
                  const member = members.find(m => m.user_id === c.user_id);
                  return (
                    <div key={i} className="text-[11px] px-2 py-1 rounded" style={{ background: 'rgba(255,80,80,0.06)' }}>
                      <span style={{ color: 'rgba(255,150,150,0.8)' }}>{member?.name || 'Unknown'}</span>
                      {c.reason && <span style={{ color: 'rgba(255,255,255,0.3)' }}> — {c.reason}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cast Assignment — admin/staff can assign cast to this date */}
          {canEdit && selectedDay && selectedEvents.length > 0 && (() => {
            const topEvent = selectedEvents.find(e => !e.is_cancelled);
            if (!topEvent) return null;
            const assignedUserIds = new Set(assignmentsByDateId[topEvent.id] || []);
            const castMembers = members.filter(m => m.role === 'cast');
            const assigned = castMembers.filter(m => assignedUserIds.has(m.user_id));
            const unassigned = castMembers.filter(m => !assignedUserIds.has(m.user_id));

            async function toggleAssignment(userId: string, isAssigned: boolean) {
              if (!id || !topEvent) return;
              try {
                if (isAssigned) {
                  await unassignCast(id, userId, topEvent.id);
                } else {
                  await assignCast(id, userId, topEvent.id);
                }
                refetchAssignments();
              } catch { toast('Failed to update assignment', 'error'); }
            }

            return (
              <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgba(255,220,100,0.6)' }}>
                  Cast Assigned ({assigned.length}/{castMembers.length})
                </p>
                <div className="space-y-0.5 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {assigned.map(m => (
                    <div key={m.user_id} className="flex items-center justify-between text-[11px] px-2 py-1 rounded"
                      style={{ background: 'rgba(100,200,100,0.06)' }}>
                      <span style={{ color: 'rgba(150,220,150,0.8)' }}>{m.name || 'Member'}</span>
                      <button onClick={() => toggleAssignment(m.user_id, true)}
                        className="text-[9px] cursor-pointer px-1.5 py-0.5 rounded"
                        style={{ color: 'rgba(255,150,150,0.6)', background: 'rgba(255,80,80,0.06)' }}>
                        Remove
                      </button>
                    </div>
                  ))}
                  {unassigned.length > 0 && (
                    <>
                      <p className="text-[9px] uppercase tracking-wider mt-2 mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        Not assigned
                      </p>
                      {unassigned.map(m => {
                        const hasConflict = conflictMap[dateStr(selectedDay)]?.conflicts.some(c => c.user_id === m.user_id);
                        return (
                          <div key={m.user_id} className="flex items-center justify-between text-[11px] px-2 py-1 rounded"
                            style={{ background: hasConflict ? 'rgba(255,80,80,0.04)' : 'rgba(255,255,255,0.02)' }}>
                            <span style={{ color: hasConflict ? 'rgba(255,150,150,0.5)' : 'rgba(255,255,255,0.4)' }}>
                              {m.name || 'Member'}
                              {hasConflict && <span className="text-[8px] ml-1" style={{ color: 'rgba(255,120,120,0.6)' }}>conflict</span>}
                            </span>
                            <button onClick={() => toggleAssignment(m.user_id, false)}
                              className="text-[9px] cursor-pointer px-1.5 py-0.5 rounded"
                              style={{ color: 'rgba(150,220,150,0.6)', background: 'rgba(100,200,100,0.06)' }}>
                              Assign
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}

      <Dialog open={!!editId} onClose={() => setEditId(null)} title="Edit Date" confirmLabel="Save" onConfirm={handleEditSave} isLoading={busy}>
        <div className="space-y-3">
          <Input label="Start Time" type="time" value={editStart} onChange={e => setEditStart(e.target.value)} />
          <Input label="End Time" type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
          <Input label="Note" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Optional note" />
        </div>
      </Dialog>

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Date" confirmLabel="Delete" confirmVariant="destructive" onConfirm={handleDelete} isLoading={busy}>
        <p>Are you sure you want to permanently delete this date?</p>
      </Dialog>
    </div>
  );
}
