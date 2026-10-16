import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Panel, Pill, MiniButton } from '@/components/ui/page';
import { CALL_TYPE_LABELS } from '@/hooks/useCalls';
import { getAttention } from '@/services/attention';
import { checkIn } from '@/services/attendance';
import { formatTime } from '@/utils/format';

interface Row {
  key: string;
  tone: 'warn' | 'bad' | 'accent';
  text: string;
  action: string;
  to: string;
}

/** Everything that needs this person's attention, in one place at the top of the dashboard. */
export function AttentionPanel({ productionId, isStaff }: { productionId: string; isStaff: boolean }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, refetch } = useApi(() => getAttention(productionId), [productionId]);
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  const base = `/production/${productionId}`;
  const rows: Row[] = [];
  data.pending_acks.forEach(a => rows.push({ key: `ack-${a.id}`, tone: 'warn', text: `Please confirm you have read “${a.title}”`, action: 'Read and confirm', to: `${base}/bulletin?post=${a.id}` }));
  data.forms_to_sign.forEach(f => rows.push({ key: `form-${f.id}`, tone: 'warn', text: `Sign “${f.title}”`, action: 'Open form', to: `${base}/documents?tab=forms` }));
  if (isStaff) {
    (data.notices ?? []).forEach(n => rows.push({
      key: `notice-${n.user_id}-${n.rehearsal_date_id}`,
      tone: n.kind === 'absent' ? 'bad' : 'warn',
      text: `${n.name} will be ${n.kind === 'absent' ? 'absent' : `${n.minutes_late} min late`} on ${new Date(`${n.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${n.note ? `: ${n.note}` : ''}`,
      action: 'Open call sheet',
      to: `${base}/call-sheet?date=${n.rehearsal_date_id}`,
    }));
    (data.unconfirmed_posts ?? []).forEach(p => rows.push({ key: `unc-${p.id}`, tone: 'accent', text: `${p.pending} of ${p.total} have not confirmed “${p.title}”`, action: 'See who', to: `${base}/bulletin?post=${p.id}` }));
    (data.incomplete_forms ?? []).forEach(f => rows.push({ key: `inc-${f.id}`, tone: 'accent', text: `${f.pending} of ${f.total} have not signed “${f.title}”`, action: 'See who', to: `${base}/documents?tab=forms` }));
    if ((data.double_booking_count ?? 0) > 0) {
      const n = data.double_booking_count!;
      rows.push({ key: 'dbl', tone: 'bad', text: `${n} double-booking${n === 1 ? '' : 's'} in the schedule`, action: 'Review', to: `${base}/schedule` });
    }
  }

  const call = data.next_call;
  if (!call && rows.length === 0) return null;

  async function doCheckIn() {
    if (!call) return;
    setBusy(true);
    try { await checkIn(productionId, call.id); toast('Checked in. Break a leg!'); refetch(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not check in', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <div data-tour="dashboard-attention" className="mb-5 grid gap-4 lg:grid-cols-3">
      {call && (
        <Panel title={call.is_today ? 'Your call today' : 'Your next call'} className="lg:col-span-1">
          <p className="text-base font-semibold" style={{ color: 'var(--t-subtle-text-bright)' }}>
            {new Date(`${call.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <p className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>
            {formatTime(call.start_time)} – {formatTime(call.end_time)} · {CALL_TYPE_LABELS[call.type] ?? call.type}
            {call.location ? ` · ${call.location}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {call.my_status ? (
              <Pill tone={call.my_status === 'present' ? 'good' : 'warn'}>{call.my_status === 'present' ? 'Checked in' : `Marked ${call.my_status}`}</Pill>
            ) : call.my_notice ? (
              <Pill tone="warn">{call.my_notice.kind === 'absent' ? 'You said you can’t make it' : `You said ${call.my_notice.minutes_late} min late`}</Pill>
            ) : !isStaff && call.is_today ? (
              <Button size="sm" onClick={doCheckIn} isLoading={busy}>I’m here</Button>
            ) : null}
            <MiniButton onClick={() => navigate(`${base}/call-sheet?date=${call.id}`)}>{isStaff ? 'Call sheet' : 'Details, running late?'}</MiniButton>
          </div>
        </Panel>
      )}
      {rows.length > 0 && (
        <Panel title={`Needs your attention (${rows.length})`} className={call ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <ul className="grid gap-2 max-h-80 overflow-y-auto pr-1">
            {rows.map(r => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0 text-sm" style={{ color: 'var(--t-subtle-text-bright)' }}>
                  <Pill tone={r.tone}>{r.tone === 'bad' ? 'Urgent' : r.tone === 'warn' ? 'To do' : 'Follow up'}</Pill>
                  <span className="min-w-0">{r.text}</span>
                </span>
                <MiniButton onClick={() => navigate(r.to)}>{r.action}</MiniButton>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
