import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { useProduction } from '@/components/layout/ProductionLayout';
import { useToast } from '@/components/ui/Toast';
import { getSchedule, generateSchedule, updateDate, cancelDate, deleteDate, type ScheduleWizardInput } from '@/services/schedule';
import { formatDate, formatTime } from '@/utils/format';
import { SCHEDULE_COLORS } from '@/utils/constants';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import type { RehearsalDate } from '@/types';
import { format, parseISO } from 'date-fns';

function isStaff(role: string | null) {
  return role === 'director' || role === 'staff';
}

export function SchedulePage() {
  const { id } = useParams<{ id: string }>();
  const { userRole } = useProduction();
  const { toast } = useToast();
  const { data: dates, isLoading, refetch } = useApi(() => getSchedule(id!), [id]);
  const [showWizard, setShowWizard] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editNote, setEditNote] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    if (!dates) return {};
    const sorted = [...dates].filter(d => !d.is_deleted).sort((a, b) => a.date.localeCompare(b.date));
    const groups: Record<string, RehearsalDate[]> = {};
    for (const d of sorted) {
      const key = format(parseISO(d.date), 'MMMM yyyy');
      (groups[key] ??= []).push(d);
    }
    return groups;
  }, [dates]);

  const canEdit = isStaff(userRole);

  async function handleEditSave() {
    if (!editId || !id) return;
    setBusy(true);
    try {
      await updateDate(id, editId, { start_time: editStart, end_time: editEnd, note: editNote || undefined });
      toast('Date updated');
      setEditId(null);
      refetch();
    } catch { toast('Failed to update', 'error'); }
    finally { setBusy(false); }
  }

  async function handleCancel(dateId: string) {
    if (!id) return;
    setBusy(true);
    try { await cancelDate(id, dateId); toast('Date cancelled'); refetch(); }
    catch { toast('Failed to cancel', 'error'); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!deleteId || !id) return;
    setBusy(true);
    try { await deleteDate(id, deleteId, true); toast('Date deleted'); setDeleteId(null); refetch(); }
    catch { toast('Failed to delete', 'error'); }
    finally { setBusy(false); }
  }

  if (isLoading) return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  const empty = !dates || dates.filter(d => !d.is_deleted).length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
        {canEdit && <Button onClick={() => setShowWizard(v => !v)}>{showWizard ? 'Close Wizard' : 'Generate Schedule'}</Button>}
      </div>

      {showWizard && canEdit && <WizardForm productionId={id!} onDone={() => { setShowWizard(false); refetch(); }} />}

      {empty && !showWizard && (
        <EmptyState title="No dates yet" description="Generate a schedule to get started." action={canEdit ? { label: 'Generate Schedule', onClick: () => setShowWizard(true) } : undefined} />
      )}

      {Object.entries(grouped).map(([month, items]) => (
        <div key={month} className="mb-6">
          <h2 className="text-lg font-semibold text-accent mb-3">{month}</h2>
          <div className="space-y-2">
            {items.map(d => {
              const color = SCHEDULE_COLORS[d.type];
              return (
                <div key={d.id} className={`flex items-center gap-3 p-3 rounded-md bg-surface border border-border ${d.is_cancelled ? 'opacity-50' : ''}`}>
                  <div className="min-w-[90px]">
                    <span className={d.is_cancelled ? 'line-through text-muted' : 'text-foreground font-medium'}>{formatDate(d.date)}</span>
                  </div>
                  <span className="text-muted text-sm">{formatTime(d.start_time)} - {formatTime(d.end_time)}</span>
                  <Badge className={`${color.bg} ${color.text}`}>{color.label}</Badge>
                  {d.is_cancelled && <Badge variant="destructive">Cancelled</Badge>}
                  {d.note && <span className="text-muted text-sm truncate max-w-[200px]">{d.note}</span>}
                  {canEdit && !d.is_cancelled && (
                    <div className="ml-auto flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditId(d.id); setEditStart(d.start_time); setEditEnd(d.end_time); setEditNote(d.note || ''); }}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCancel(d.id)}>Cancel</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(d.id)}>Delete</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

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
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
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
    <div className="bg-surface-raised border border-border rounded-lg p-5 mb-6 space-y-4">
      <h3 className="font-semibold text-foreground">Generate Schedule</h3>
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Rehearsal Days</label>
        <div className="flex flex-wrap gap-2">
          {days.map(d => (
            <button key={d} type="button" onClick={() => toggleDay(d)}
              className={`px-3 py-1.5 rounded-md text-sm capitalize ${form.selected_days.includes(d) ? 'bg-accent text-background' : 'bg-surface border border-border text-muted'}`}>
              {d}
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
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={form.tech_week_enabled} onChange={e => setForm(f => ({ ...f, tech_week_enabled: e.target.checked }))} className="accent-accent" />
          Tech Week
        </label>
        {form.tech_week_enabled && (
          <Input type="number" min={1} max={7} value={form.tech_week_days} onChange={e => setForm(f => ({ ...f, tech_week_days: Number(e.target.value) }))} className="w-20" />
        )}
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={form.dress_rehearsal_enabled} onChange={e => setForm(f => ({ ...f, dress_rehearsal_enabled: e.target.checked }))} className="accent-accent" />
          Dress Rehearsal
        </label>
      </div>
      <Button onClick={submit} isLoading={busy} disabled={form.selected_days.length === 0}>Generate</Button>
    </div>
  );
}
