import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { getSchedule, generateSchedule, updateDate, cancelDate, deleteDate, addDate, type ScheduleWizardInput } from '@/services/schedule';
import { formatTime } from '@/utils/format';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { ChalkText } from '@/components/theater/Chalkboard';
import type { RehearsalDate } from '@/types';

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
  const { userRole } = useProduction();
  const { toast } = useToast();
  const { data: dates, isLoading, refetch } = useApi(() => getSchedule(id!), [id]);

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

  // Cycle weekly pattern for a day-of-week (0=Sun, 6=Sat)
  function cycleWeekDay(dow: number) {
    const current = weeklyPattern[dow] || '';
    const idx = typesCycle.indexOf(current as DayType);
    const next = typesCycle[(idx + 1) % typesCycle.length];
    setWeeklyPattern(prev => {
      const updated = { ...prev };
      if (next === '') delete updated[dow];
      else updated[dow] = next;
      return updated;
    });

    // Auto-populate all matching days in the current month
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    setDayTypes(prev => {
      const updated = { ...prev };
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        if (date.getDay() === dow) {
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          // Don't set dates in the past
          if (key < todayStr) continue;
          if (next === '') delete updated[key];
          else updated[key] = next;
        }
      }
      return updated;
    });
  }

  // Single date edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editNote, setEditNote] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canEdit = isStaffRole(userRole);

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

  function prevMonth() { setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setSelectedDay(null); }
  function nextMonth() { setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setSelectedDay(null); }

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
    setDayTypes({});
    setWeeklyPattern({});
    setSelectedDay(null);
  }

  function cancelEditMode() {
    setEditMode(false);
    setDayTypes({});
    setWeeklyPattern({});
  }

  // Apply — create all the dates
  async function applySchedule() {
    if (!id) return;
    setSaving(true);
    try {
      const entries = Object.entries(dayTypes).filter(([_, t]) => t && t !== 'blocked');
      let created = 0;
      for (const [date, type] of entries) {
        try {
          await addDate(id, {
            date,
            start_time: defaultTime.start,
            end_time: defaultTime.end,
            type: type as string,
          });
          created++;
        } catch {
          // Skip dates that already exist
        }
      }
      toast(`${created} date${created !== 1 ? 's' : ''} added`);
      setEditMode(false);
      setDayTypes({});
      refetch();
    } catch { toast('Failed to save', 'error'); }
    finally { setSaving(false); }
  }

  // Count of pending changes
  const pendingCount = Object.values(dayTypes).filter(t => t && t !== 'blocked').length;
  const blockedCount = Object.values(dayTypes).filter(t => t === 'blocked').length;

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
                <button onClick={applySchedule} disabled={saving || pendingCount === 0}
                  className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded cursor-pointer font-bold"
                  style={{ color: 'hsl(25,20%,8%)', background: 'hsl(38,70%,50%)', opacity: (saving || pendingCount === 0) ? 0.5 : 1 }}>
                  {saving ? 'Saving...' : `Apply ${pendingCount} date${pendingCount !== 1 ? 's' : ''}`}
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
          const displayType = editMode && editType ? editType : (topEvent && !topEvent.is_cancelled ? topEvent.type : null);
          const config = displayType ? typeConfig[displayType] : null;
          const isCancelled = hasEvent && events.every(e => e.is_cancelled);

          return (
            <motion.button
              key={day}
              onClick={() => handleDayClick(day)}
              className="relative flex flex-col items-center rounded-sm cursor-pointer min-h-[80px] p-1"
              style={{
                background: isSelected ? 'rgba(255,255,255,0.06)'
                  : editMode && editType ? (typeConfig[editType]?.chalkBg || 'transparent')
                  : 'transparent',
                outline: editMode && editType ? `1px dashed ${editType === 'blocked' ? 'rgba(255,80,80,0.2)' : 'rgba(255,220,100,0.15)'}` : 'none',
              }}
              whileHover={editMode ? { scale: 1.05 } : {}}
              whileTap={editMode ? { scale: 0.95 } : {}}
              transition={spring}
            >
              {/* Day number */}
              <span style={{
                color: isCancelled ? 'rgba(255,100,100,0.4)'
                  : editType === 'blocked' ? 'rgba(255,100,100,0.5)'
                  : isToday ? 'rgba(255,220,100,0.9)'
                  : displayType ? 'rgba(255,255,255,0.75)'
                  : 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                fontWeight: isToday ? 600 : 300,
                textDecoration: (isCancelled || editType === 'blocked') ? 'line-through' : 'none',
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
                    <span className="opacity-60 block truncate">{formatTime(topEvent.start_time)}</span>
                  )}
                  {editMode && <span className="opacity-50 block">{defaultTime.start}</span>}
                </motion.div>
              )}

              {/* Blocked X marker */}
              {editType === 'blocked' && (
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

              {isToday && <div className="absolute bottom-0.5 w-3 h-[2px] rounded-full" style={{ background: 'rgba(255,220,100,0.5)' }} />}
            </motion.button>
          );
        })}
      </div>

      {/* Legend (view mode) */}
      {!editMode && (
        <div className="flex gap-4 justify-center mt-5 flex-wrap">
          {Object.entries(typeConfig).filter(([k]) => k !== 'blocked').map(([type, c]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-[1px]" style={{ background: c.noteBg }} />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>{c.label}</span>
            </div>
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
                    {d.note && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{d.note}</p>}
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
