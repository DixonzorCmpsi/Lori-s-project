import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { localISO } from '@/hooks/useCalls';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader, Panel, Pill, MiniButton, Empty } from '@/components/ui/page';
import { listSlots, createSlot, updateSlot, deleteSlot, joinSlot, leaveSlot, removeEntry, type SignupSlot, type SlotInput } from '@/services/signups';
import { ApiRequestError } from '@/services/api';
import { formatTime } from '@/utils/format';
import { PageGuide } from '@/components/PageGuide';
import { PageTour } from '@/tours/PageTour';
import { signupsStaffTourSteps, signupsCastTourSteps } from '@/tours/pageTours';

const emptyForm = (): SlotInput => ({ title: '', description: '', date: localISO(new Date()), start_time: '10:00', end_time: '13:00', location: '', capacity: 4 });

export function SignupsPage() {
  usePageTitle('Crew sign-ups');
  const { id } = useParams<{ id: string }>();
  const { userRole } = useProduction();
  const isStaff = userRole === 'director' || userRole === 'staff';
  const { toast } = useToast();
  const slots = useApi(() => listSlots(id!), [id]);
  const [editing, setEditing] = useState<{ slot: SignupSlot | null } | null>(null);
  const [deleting, setDeleting] = useState<SignupSlot | null>(null);
  const [warning, setWarning] = useState<{ slot: SignupSlot; message: string } | null>(null);
  const [showPast, setShowPast] = useState(false);
  const today = localISO(new Date());

  const groups = useMemo(() => {
    const visible = (slots.data ?? []).filter(s => showPast || s.date >= today);
    const map = new Map<string, SignupSlot[]>();
    visible.forEach(s => map.set(s.date, [...(map.get(s.date) ?? []), s]));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots.data, showPast, today]);

  async function run(fn: () => Promise<unknown>, success?: string) {
    try { await fn(); if (success) toast(success); slots.refetch(); }
    catch (e) { toast(e instanceof ApiRequestError ? e.message : 'Something went wrong', 'error'); }
  }

  async function join(slot: SignupSlot, force = false) {
    try {
      await joinSlot(id!, slot.id, force);
      toast(`You’re signed up for ${slot.title}`);
      setWarning(null);
      slots.refetch();
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'DOUBLE_BOOKED') setWarning({ slot, message: e.message });
      else toast(e instanceof ApiRequestError ? e.message : 'Something went wrong', 'error');
    }
  }

  return (
    <div>
      <PageTour tourId={`page-signups-${isStaff ? 'staff' : 'cast'}`} steps={isStaff ? signupsStaffTourSteps : signupsCastTourSteps} />
      <PageHeader
        title="Crew sign-ups"
        subtitle="Open calls for shifts and jobs. Pick a slot that suits you."
        actions={
          <>
            <MiniButton active={showPast} onClick={() => setShowPast(v => !v)}>Show past</MiniButton>
            {isStaff && <span data-tour="signups-new"><Button size="sm" onClick={() => setEditing({ slot: null })}>New open call</Button></span>}
          </>
        }
      />

      <PageGuide page="signups" />

      <div data-tour="signups-list">
      {slots.isLoading ? <Skeleton className="h-40 w-full" /> : groups.length === 0 ? (
        <Empty title="No open calls">{isStaff ? 'Post a shift, such as strike crew or box office, for people to sign up for.' : 'Nothing is open right now. Check back soon.'}</Empty>
      ) : groups.map(([day, daySlots]) => (
        <div key={day} className="mb-6">
          <h2 className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--t-subtle-text)' }}>
            {new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {daySlots.map(slot => (
              <Panel key={slot.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--t-subtle-text-bright)' }}>{slot.title}</p>
                    <p className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>
                      {formatTime(slot.start_time)} – {formatTime(slot.end_time)}{slot.location ? ` · ${slot.location}` : ''}
                    </p>
                  </div>
                  <Pill tone={slot.full ? 'bad' : slot.filled > 0 ? 'warn' : 'good'} title={`${slot.filled} of ${slot.capacity} spots are taken`}>{slot.full ? 'Full' : `${slot.filled} of ${slot.capacity} filled`}</Pill>
                </div>
                {slot.description && <p className="mt-2 text-sm" style={{ color: 'var(--t-subtle-text)' }}>{slot.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5 flex-1 content-start">
                  {slot.people.length === 0 ? <span className="text-xs" style={{ color: 'var(--t-subtle-text)' }}>No one yet</span> : slot.people.map(p => (
                    <span key={p.user_id} className="inline-flex items-center gap-1">
                      <Pill tone={slot.mine && p.name ? 'neutral' : 'neutral'}>{p.name}</Pill>
                      {isStaff && <button type="button" aria-label={`Remove ${p.name}`} className="text-xs cursor-pointer" style={{ color: 'var(--t-subtle-text)' }}
                        onClick={() => run(() => removeEntry(id!, slot.id, p.user_id), 'Removed')}>✕</button>}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {slot.mine ? (
                    <Button variant="secondary" size="sm" onClick={() => run(() => leaveSlot(id!, slot.id), 'You’re off this slot')}>Withdraw</Button>
                  ) : (
                    <Button size="sm" disabled={slot.full || slot.date < today} onClick={() => join(slot)}>{slot.full ? 'Full' : 'Sign me up'}</Button>
                  )}
                  {isStaff && (
                    <>
                      <MiniButton onClick={() => setEditing({ slot })}>Edit</MiniButton>
                      <MiniButton tone="bad" onClick={() => setDeleting(slot)}>Delete</MiniButton>
                    </>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      ))}
      </div>

      {editing && <SlotDialog key={editing.slot?.id ?? 'new'} slot={editing.slot} onClose={() => setEditing(null)}
        onSave={async data => {
          await run(() => (editing.slot ? updateSlot(id!, editing.slot.id, data) : createSlot(id!, data)), editing.slot ? 'Slot updated' : 'Open call posted');
          setEditing(null);
        }} />}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title={`Delete “${deleting?.title}”?`} confirmLabel="Delete" confirmVariant="destructive"
        onConfirm={async () => { const s = deleting!; setDeleting(null); await run(() => deleteSlot(id!, s.id), 'Slot deleted'); }}>
        Everyone signed up will lose their spot.
      </Dialog>

      <Dialog open={!!warning} onClose={() => setWarning(null)} title="This overlaps something else" confirmLabel="Sign up anyway"
        onConfirm={() => warning && join(warning.slot, true)}>
        {warning?.message} Sign up anyway?
      </Dialog>
    </div>
  );
}

function SlotDialog({ slot, onClose, onSave }: { slot: SignupSlot | null; onClose: () => void; onSave: (d: SlotInput) => Promise<void> }) {
  const [form, setForm] = useState<SlotInput>(slot ? {
    title: slot.title, description: slot.description ?? '', date: slot.date, start_time: slot.start_time,
    end_time: slot.end_time, location: slot.location ?? '', capacity: slot.capacity,
  } : emptyForm());
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SlotInput>(k: K, v: SlotInput[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open onClose={onClose} title={slot ? 'Edit open call' : 'New open call'} confirmLabel={slot ? 'Save' : 'Post'} isLoading={busy}
      onConfirm={async () => { setBusy(true); try { await onSave(form); } finally { setBusy(false); } }}>
      <div className="grid gap-3 text-foreground">
        <Input label="Title" value={form.title} maxLength={200} onChange={e => set('title', e.target.value)} placeholder="Strike crew" />
        <div className="grid grid-cols-3 gap-2">
          <Input label="Date" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          <Input label="Start" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
          <Input label="End" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Location" value={form.location ?? ''} maxLength={200} onChange={e => set('location', e.target.value)} />
          <Input label="Spots" type="number" min={1} max={200} value={form.capacity} onChange={e => set('capacity', Number(e.target.value))} />
        </div>
        <Textarea label="Details" value={form.description ?? ''} maxLength={1000} onChange={e => set('description', e.target.value)} />
      </div>
    </Dialog>
  );
}
