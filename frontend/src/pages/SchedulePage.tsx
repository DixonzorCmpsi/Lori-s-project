import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
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

// Chalk colors for each rehearsal type
const chalkColors: Record<string, { circle: string; text: string; label: string }> = {
  regular:     { circle: 'rgba(255, 255, 255, 0.15)', text: 'rgba(255, 255, 255, 0.85)', label: 'Rehearsal' },
  tech:        { circle: 'rgba(100, 180, 255, 0.2)',  text: 'rgba(140, 200, 255, 0.9)',  label: 'Tech' },
  dress:       { circle: 'rgba(200, 140, 255, 0.2)',  text: 'rgba(210, 170, 255, 0.9)',  label: 'Dress' },
  performance: { circle: 'rgba(255, 140, 100, 0.2)',  text: 'rgba(255, 180, 140, 0.9)',  label: 'Show' },
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
  const [selectedDate, setSelectedDate] = useState<RehearsalDate | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editNote, setEditNote] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canEdit = isStaffRole(userRole);

  // Build calendar grid for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth]);

  // Map dates to their calendar day
  const dateMap = useMemo(() => {
    const map: Record<number, RehearsalDate[]> = {};
    if (!dates) return map;
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    for (const d of dates) {
      if (d.is_deleted) continue;
      const dt = new Date(d.date + 'T00:00:00');
      if (dt.getFullYear() === year && dt.getMonth() === month) {
        const day = dt.getDate();
        (map[day] ??= []).push(d);
      }
    }
    return map;
  }, [dates, currentMonth]);

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() {
    setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  async function handleEditSave() {
    if (!editId || !id) return;
    setBusy(true);
    try {
      await updateDate(id, editId, { start_time: editStart, end_time: editEnd, note: editNote || undefined });
      toast('Date updated'); setEditId(null); refetch();
    } catch { toast('Failed to update', 'error'); }
    finally { setBusy(false); }
  }

  async function handleCancel(dateId: string) {
    if (!id) return;
    setBusy(true);
    try { await cancelDate(id, dateId); toast('Date cancelled'); setSelectedDate(null); refetch(); }
    catch { toast('Failed to cancel', 'error'); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!deleteId || !id) return;
    setBusy(true);
    try { await deleteDate(id, deleteId, true); toast('Date deleted'); setDeleteId(null); setSelectedDate(null); refetch(); }
    catch { toast('Failed to delete', 'error'); }
    finally { setBusy(false); }
  }

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentMonth.getFullYear() && today.getMonth() === currentMonth.getMonth();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <ChalkText size="lg">Schedule</ChalkText>
        {canEdit && (
          <button
            onClick={() => setShowWizard(v => !v)}
            className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded cursor-pointer"
            style={{ background: 'rgba(255,220,100,0.1)', color: 'rgba(255,220,100,0.8)', border: '1px solid rgba(255,220,100,0.15)' }}
          >
            {showWizard ? 'Close' : 'Generate Schedule'}
          </button>
        )}
      </div>

      {showWizard && canEdit && <WizardForm productionId={id!} onDone={() => { setShowWizard(false); refetch(); }} />}

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-6 mb-6">
        <button onClick={prevMonth} className="cursor-pointer px-2 py-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          &lt;
        </button>
        <h2 style={{
          color: 'rgba(255, 255, 255, 0.8)',
          fontFamily: '"Playfair Display", serif',
          fontSize: '1.5rem',
          textShadow: '0 0 8px rgba(255,255,255,0.06)',
          letterSpacing: '0.05em',
        }}>
          {monthName}
        </h2>
        <button onClick={nextMonth} className="cursor-pointer px-2 py-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          &gt;
        </button>
      </div>

      {/* Day headers — chalk style */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_HEADERS.map(day => (
          <div key={day} className="text-center py-1"
            style={{
              color: 'rgba(255, 255, 255, 0.45)',
              fontSize: '11px',
              fontFamily: '"Libre Franklin", sans-serif',
              fontWeight: 300,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Chalk line under headers */}
      <div className="mb-3 mx-2" style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15) 10%, rgba(255,255,255,0.12) 90%, transparent)',
      }} />

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {calendarDays.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;

          const events = dateMap[day] || [];
          const hasEvent = events.length > 0;
          const isToday = isCurrentMonth && day === today.getDate();
          const topEvent = events[0];
          const chalk = topEvent ? chalkColors[topEvent.type] || chalkColors.regular : null;
          const isCancelled = topEvent?.is_cancelled;

          return (
            <button
              key={day}
              onClick={() => { if (hasEvent) setSelectedDate(topEvent); }}
              className="relative flex flex-col items-center py-2 rounded-sm cursor-pointer transition-all group"
              style={{
                background: hasEvent && !isCancelled ? chalk!.circle : 'transparent',
              }}
            >
              {/* Day number */}
              <span style={{
                color: isCancelled ? 'rgba(255,100,100,0.4)'
                  : hasEvent ? chalk!.text
                  : isToday ? 'rgba(255,220,100,0.9)'
                  : 'rgba(255, 255, 255, 0.55)',
                fontSize: '15px',
                fontFamily: '"Libre Franklin", sans-serif',
                fontWeight: isToday ? 600 : 300,
                textDecoration: isCancelled ? 'line-through' : 'none',
                textShadow: hasEvent ? '0 0 6px rgba(255,255,255,0.06)' : 'none',
              }}>
                {day}
              </span>

              {/* Event indicator dot */}
              {hasEvent && !isCancelled && (
                <div className="flex gap-0.5 mt-0.5">
                  {events.filter(e => !e.is_cancelled).slice(0, 3).map((e, j) => (
                    <div key={j} className="w-1 h-1 rounded-full"
                      style={{ background: (chalkColors[e.type] || chalkColors.regular).text }}
                    />
                  ))}
                </div>
              )}

              {/* Today marker */}
              {isToday && (
                <div className="absolute -bottom-0.5 w-4 h-[2px] rounded-full"
                  style={{ background: 'rgba(255,220,100,0.5)' }}
                />
              )}

              {/* Hover tooltip */}
              {hasEvent && !isCancelled && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap px-2 py-1 rounded"
                  style={{ background: 'rgba(0,0,0,0.8)', color: 'rgba(255,255,255,0.8)', fontSize: '10px' }}>
                  {formatTime(topEvent.start_time)} — {chalk!.label}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 justify-center mt-6 flex-wrap">
        {Object.entries(chalkColors).map(([type, c]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: c.text }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'capitalize' }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <div className="mt-6 p-4 rounded-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-2">
            <ChalkText size="md">
              {new Date(selectedDate.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </ChalkText>
            <button onClick={() => setSelectedDate(null)} className="cursor-pointer" style={{ color: 'rgba(255,255,255,0.3)', fontSize: '18px' }}>x</button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontFamily: '"JetBrains Mono", monospace' }}>
              {formatTime(selectedDate.start_time)} - {formatTime(selectedDate.end_time)}
            </span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm"
              style={{ background: (chalkColors[selectedDate.type] || chalkColors.regular).circle, color: (chalkColors[selectedDate.type] || chalkColors.regular).text }}>
              {(chalkColors[selectedDate.type] || chalkColors.regular).label}
            </span>
          </div>
          {selectedDate.note && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{selectedDate.note}</p>}
          {canEdit && !selectedDate.is_cancelled && (
            <div className="flex gap-2 mt-3">
              <button className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-sm cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)' }}
                onClick={() => { setEditId(selectedDate.id); setEditStart(selectedDate.start_time); setEditEnd(selectedDate.end_time); setEditNote(selectedDate.note || ''); }}>
                Edit
              </button>
              <button className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-sm cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)' }}
                onClick={() => handleCancel(selectedDate.id)}>
                Cancel
              </button>
              <button className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-sm cursor-pointer" style={{ color: 'rgba(255,150,150,0.6)', background: 'rgba(255,80,80,0.06)' }}
                onClick={() => setDeleteId(selectedDate.id)}>
                Delete
              </button>
            </div>
          )}
        </div>
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
      toast('Schedule generated');
      onDone();
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
          <input type="number" min={1} max={7} value={form.tech_week_days} onChange={e => setForm(f => ({ ...f, tech_week_days: Number(e.target.value) }))}
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
