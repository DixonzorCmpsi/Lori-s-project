import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { getSchedule, generateSchedule, updateDate, cancelDate, deleteDate, type ScheduleWizardInput } from '@/services/schedule';
import { formatTime } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { ChalkText } from '@/components/theater/Chalkboard';
import type { RehearsalDate } from '@/types';

function isStaffRole(role: string | null) {
  return role === 'director' || role === 'staff';
}

const chalkColors: Record<string, { bg: string; border: string; text: string; label: string; noteBg: string; noteText: string }> = {
  regular:     { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.8)', label: 'Rehearsal', noteBg: 'hsl(48, 90%, 85%)', noteText: 'hsl(35, 40%, 20%)' },
  tech:        { bg: 'rgba(100,180,255,0.1)', border: 'rgba(100,180,255,0.2)', text: 'rgba(140,200,255,0.9)', label: 'Tech', noteBg: 'hsl(210, 70%, 88%)', noteText: 'hsl(210, 30%, 22%)' },
  dress:       { bg: 'rgba(200,140,255,0.1)', border: 'rgba(200,140,255,0.2)', text: 'rgba(210,170,255,0.9)', label: 'Dress', noteBg: 'hsl(280, 60%, 88%)', noteText: 'hsl(280, 30%, 25%)' },
  performance: { bg: 'rgba(255,140,100,0.1)', border: 'rgba(255,140,100,0.2)', text: 'rgba(255,180,140,0.9)', label: 'Show', noteBg: 'hsl(340, 80%, 88%)', noteText: 'hsl(340, 30%, 25%)' },
};

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SchedulePage() {
  usePageTitle('Schedule');
  const { id } = useParams<{ id: string }>();
  const { userRole } = useProduction();
  const { toast } = useToast();
  const { data: dates, isLoading, refetch } = useApi(() => getSchedule(id!), [id]);
  const [showWizard, setShowWizard] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editNote, setEditNote] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canEdit = isStaffRole(userRole);

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

  // Selected day's events
  const selectedEvents = selectedDay ? (dateMap[selectedDay] || []) : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <ChalkText size="lg">Schedule</ChalkText>
        {canEdit && (
          <button onClick={() => setShowWizard(v => !v)}
            className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded cursor-pointer"
            style={{ background: 'rgba(255,220,100,0.1)', color: 'rgba(255,220,100,0.8)', border: '1px solid rgba(255,220,100,0.15)' }}>
            {showWizard ? 'Close' : 'Generate Schedule'}
          </button>
        )}
      </div>

      {showWizard && canEdit && <WizardForm productionId={id!} onDone={() => { setShowWizard(false); refetch(); }} />}

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

      {/* Calendar grid with sticky notes */}
      <div className="grid grid-cols-7 gap-[2px]">
        {calendarDays.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="min-h-[80px]" />;

          const events = dateMap[day] || [];
          const hasEvent = events.length > 0;
          const isToday = isCurrentMonth && day === today.getDate();
          const isSelected = selectedDay === day;
          const topEvent = events.find(e => !e.is_cancelled) || events[0];
          const chalk = topEvent ? chalkColors[topEvent.type] || chalkColors.regular : null;
          const isCancelled = events.length > 0 && events.every(e => e.is_cancelled);

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className="relative flex flex-col items-center rounded-sm cursor-pointer transition-all min-h-[80px] p-1"
              style={{
                background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}
            >
              {/* Day number */}
              <span style={{
                color: isCancelled ? 'rgba(255,100,100,0.4)'
                  : isToday ? 'rgba(255,220,100,0.9)'
                  : hasEvent ? 'rgba(255,255,255,0.75)'
                  : 'rgba(255,255,255,0.4)',
                fontSize: '12px',
                fontWeight: isToday ? 600 : 300,
                textDecoration: isCancelled ? 'line-through' : 'none',
              }}>
                {day}
              </span>

              {/* Sticky note for events */}
              {hasEvent && !isCancelled && chalk && (
                <motion.div
                  className="mt-1 w-full rounded-[2px] px-1.5 py-1 text-left"
                  style={{
                    background: chalk.noteBg,
                    color: chalk.noteText,
                    boxShadow: '1px 2px 4px rgba(0,0,0,0.15)',
                    transform: `rotate(${(day % 3 - 1) * 0.5}deg)`,
                    fontSize: '9px',
                    lineHeight: '1.3',
                  }}
                  whileHover={{ scale: 1.05, boxShadow: '2px 3px 8px rgba(0,0,0,0.25)' }}
                >
                  <span className="font-bold block truncate">{chalk.label}</span>
                  <span className="opacity-60 block truncate">{formatTime(topEvent.start_time)}</span>
                  {topEvent.note && <span className="opacity-50 block truncate">{topEvent.note}</span>}
                </motion.div>
              )}

              {/* Multiple events indicator */}
              {events.filter(e => !e.is_cancelled).length > 1 && (
                <div className="mt-0.5 flex gap-0.5">
                  {events.filter(e => !e.is_cancelled).slice(1, 3).map((e, j) => (
                    <div key={j} className="w-1 h-1 rounded-full" style={{ background: (chalkColors[e.type] || chalkColors.regular).text }} />
                  ))}
                </div>
              )}

              {/* Today underline */}
              {isToday && <div className="absolute bottom-0.5 w-3 h-[2px] rounded-full" style={{ background: 'rgba(255,220,100,0.5)' }} />}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 justify-center mt-5 flex-wrap">
        {Object.entries(chalkColors).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-[1px]" style={{ background: c.noteBg }} />
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Selected day detail panel */}
      {selectedDay !== null && (
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
                const c = chalkColors[d.type] || chalkColors.regular;
                return (
                  <div key={d.id} className={`px-4 py-3 ${d.is_cancelled ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-3 mb-1">
                      {/* Mini sticky note badge */}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-[2px]"
                        style={{ background: c.noteBg, color: c.noteText }}>
                        {c.label}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace' }}>
                        {formatTime(d.start_time)} - {formatTime(d.end_time)}
                      </span>
                      {d.is_cancelled && <span className="text-[9px] px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(255,80,80,0.1)', color: 'rgba(255,150,150,0.7)' }}>Cancelled</span>}
                    </div>
                    {d.note && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{d.note}</p>}

                    {/* Director actions */}
                    {canEdit && !d.is_cancelled && (
                      <div className="flex gap-2 mt-2">
                        <button className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm cursor-pointer"
                          style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}
                          onClick={() => { setEditId(d.id); setEditStart(d.start_time); setEditEnd(d.end_time); setEditNote(d.note || ''); }}>
                          Edit
                        </button>
                        <button className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm cursor-pointer"
                          style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)' }}
                          onClick={() => handleCancel(d.id)}>
                          Cancel
                        </button>
                        <button className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm cursor-pointer"
                          style={{ color: 'rgba(255,150,150,0.5)', background: 'rgba(255,80,80,0.04)' }}
                          onClick={() => setDeleteId(d.id)}>
                          Delete
                        </button>
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

function WizardForm({ productionId, onDone }: { productionId: string; onDone: () => void }) {
  const { toast } = useToast();
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const [form, setForm] = useState<ScheduleWizardInput>({
    selected_days: [], start_time: '18:00', end_time: '21:00',
    blocked_dates: [], tech_week_enabled: false, tech_week_days: 5, dress_rehearsal_enabled: false,
  });
  const [blocked, setBlocked] = useState('');
  const [busy, setBusy] = useState(false);

  function toggleDay(day: string) {
    setForm(f => ({ ...f, selected_days: f.selected_days.includes(day) ? f.selected_days.filter(d => d !== day) : [...f.selected_days, day] }));
  }

  async function submit() {
    setBusy(true);
    try {
      const blockedArr = blocked.split(',').map(s => s.trim()).filter(Boolean);
      await generateSchedule(productionId, { ...form, blocked_dates: blockedArr });
      toast('Schedule generated'); onDone();
    } catch { toast('Failed to generate', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-sm p-4 mb-6 space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <ChalkText size="md">Generate Schedule</ChalkText>
      <div>
        <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>Rehearsal Days</p>
        <div className="flex flex-wrap gap-1.5">
          {dayNames.map(d => (
            <button key={d} type="button" onClick={() => toggleDay(d)}
              className="px-2.5 py-1 rounded-sm text-xs capitalize cursor-pointer transition-colors"
              style={{
                background: form.selected_days.includes(d) ? 'rgba(255,220,100,0.15)' : 'rgba(255,255,255,0.04)',
                color: form.selected_days.includes(d) ? 'rgba(255,220,100,0.9)' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${form.selected_days.includes(d) ? 'rgba(255,220,100,0.2)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Start Time" type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
        <Input label="End Time" type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
      </div>
      <Input label="Blocked Dates (comma-separated YYYY-MM-DD)" value={blocked} onChange={e => setBlocked(e.target.value)} placeholder="2026-04-10, 2026-04-17" />
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <input type="checkbox" checked={form.tech_week_enabled} onChange={e => setForm(f => ({ ...f, tech_week_enabled: e.target.checked }))} style={{ accentColor: 'hsl(38, 70%, 50%)' }} />
          Tech Week
        </label>
        {form.tech_week_enabled && (
          <input type="number" min={1} max={14} value={form.tech_week_days} onChange={e => setForm(f => ({ ...f, tech_week_days: Number(e.target.value) }))}
            className="w-16 px-2 py-1 rounded-sm text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }} />
        )}
        <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <input type="checkbox" checked={form.dress_rehearsal_enabled} onChange={e => setForm(f => ({ ...f, dress_rehearsal_enabled: e.target.checked }))} style={{ accentColor: 'hsl(38, 70%, 50%)' }} />
          Dress Rehearsal
        </label>
      </div>
      <Button onClick={submit} isLoading={busy} disabled={form.selected_days.length === 0} size="sm">Generate</Button>
    </div>
  );
}
