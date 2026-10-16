import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useCalls, callLabel, CALL_TYPE_LABELS } from '@/hooks/useCalls';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader, Panel, Pill, MiniButton, Stat, Empty } from '@/components/ui/page';
import {
  getCallSheet, checkIn, markAttendance, clearAttendance, sendNotice, withdrawNotice, getAttendanceByMember,
  type AttendanceStatus, type CalledPerson, type CallSheet,
} from '@/services/attendance';
import { updateDate } from '@/services/schedule';
import { formatDate, formatTime } from '@/utils/format';
import { ApiRequestError } from '@/services/api';
import { describeDoubleBooking } from '@/utils/doubleBooking';
import { PageGuide } from '@/components/PageGuide';
import { PageTour } from '@/tours/PageTour';
import { callSheetStaffTourSteps, callSheetCastTourSteps } from '@/tours/pageTours';

const STATUSES: { id: AttendanceStatus; label: string; tone: 'good' | 'warn' | 'bad' | 'accent' }[] = [
  { id: 'present', label: 'Present', tone: 'good' },
  { id: 'late', label: 'Late', tone: 'warn' },
  { id: 'absent', label: 'Absent', tone: 'bad' },
  { id: 'excused', label: 'Excused', tone: 'accent' },
];

export function CallSheetPage() {
  usePageTitle('Call sheet');
  const { id } = useParams<{ id: string }>();
  const { userRole } = useProduction();
  const isStaff = userRole === 'director' || userRole === 'staff';
  const { calls, defaultCall, isLoading: callsLoading } = useCalls(id);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'sheet' | 'report'>('sheet');

  const selectedId = params.get('date') ?? defaultCall?.id ?? '';
  const select = (dateId: string) => setParams({ date: dateId }, { replace: true });
  const index = calls.findIndex(c => c.id === selectedId);

  if (callsLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <PageTour tourId={`page-callsheet-${isStaff ? 'staff' : 'cast'}`} steps={isStaff ? callSheetStaffTourSteps : callSheetCastTourSteps} />
      <PageHeader
        title="Call sheet"
        subtitle="Who is called, who is here, and who has told you they will be late."
        actions={isStaff && (
          <div className="flex gap-1" role="tablist" data-tour="callsheet-tabs">
            <MiniButton active={tab === 'sheet'} tone="accent" onClick={() => setTab('sheet')}>Call sheet</MiniButton>
            <MiniButton active={tab === 'report'} tone="accent" onClick={() => setTab('report')}>Attendance report</MiniButton>
          </div>
        )}
      />

      <PageGuide page="callsheet" />

      {tab === 'report' && isStaff ? (
        <AttendanceReport productionId={id!} />
      ) : calls.length === 0 ? (
        <Empty title="No calls scheduled yet">
          {isStaff ? <>Build the schedule first on the <Link to={`/production/${id}/schedule`} className="underline">Schedule</Link> page.</> : 'Your director has not posted a schedule yet.'}
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2 mb-4">
            <div className="flex-1 min-w-[220px] max-w-md" data-tour="callsheet-picker">
              <Select label="Call" value={selectedId} onChange={e => select(e.target.value)}>
                {calls.map(c => (
                  <option key={c.id} value={c.id}>{callLabel(c)}{c.is_cancelled ? ' (cancelled)' : ''}</option>
                ))}
              </Select>
            </div>
            <Button variant="secondary" size="sm" disabled={index <= 0} onClick={() => select(calls[index - 1].id)}>← Earlier</Button>
            <Button variant="secondary" size="sm" disabled={index < 0 || index >= calls.length - 1} onClick={() => select(calls[index + 1].id)}>Later →</Button>
          </div>
          {selectedId && <CallDetail key={selectedId} productionId={id!} dateId={selectedId} isStaff={isStaff} />}
        </>
      )}
    </div>
  );
}

function CallDetail({ productionId, dateId, isStaff }: { productionId: string; dateId: string; isStaff: boolean }) {
  const { toast } = useToast();
  const { data: sheet, isLoading, refetch, error } = useApi<CallSheet>(() => getCallSheet(productionId, dateId), [productionId, dateId]);

  if (isLoading && !sheet) return <Skeleton className="h-48 w-full" />;
  if (error || !sheet) return <Empty title="Could not load this call">{error?.message}</Empty>;

  const { date } = sheet;
  return (
    <div className="grid gap-4">
      <div data-tour="callsheet-details">
      <Panel title="Details">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold" style={{ color: 'var(--t-subtle-text-bright)' }}>
              {formatDate(date.date)} · {formatTime(date.start_time)} – {formatTime(date.end_time)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Pill tone="accent">{CALL_TYPE_LABELS[date.type] ?? date.type}</Pill>
              {date.is_cancelled && <Pill tone="bad">Cancelled</Pill>}
              <Pill>{sheet.full_company ? 'Full company' : `${sheet.called.length} called`}</Pill>
              {date.location && <span className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>📍 {date.location}</span>}
            </div>
            {date.note && <p className="mt-2 text-sm" style={{ color: 'var(--t-subtle-text)' }}>{date.note}</p>}
          </div>
          {isStaff && <EditDetails productionId={productionId} date={date} onSaved={refetch} />}
        </div>
        {isStaff && sheet.warnings && sheet.warnings.length > 0 && (
          <div className="mt-3 rounded-md p-3 text-sm" style={{ background: 'rgb(var(--c-251-191-36) / 0.14)', color: 'var(--t-subtle-text-bright)' }}>
            <p className="font-semibold mb-1">Double-booking warning</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {sheet.warnings.map((w, i) => <li key={i}>{describeDoubleBooking(w)}</li>)}
            </ul>
          </div>
        )}
      </Panel>
      </div>

      {isStaff ? (
        <StaffList productionId={productionId} sheet={sheet} onChanged={refetch} onError={m => toast(m, 'error')} />
      ) : (
        <CastView productionId={productionId} sheet={sheet} onChanged={refetch} />
      )}
    </div>
  );
}

function EditDetails({ productionId, date, onSaved }: { productionId: string; date: CallSheet['date']; onSaved: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState(date.location ?? '');
  const [note, setNote] = useState(date.note ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateDate(productionId, date.id, { location, note });
      toast('Call details saved');
      setOpen(false);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit location and note</Button>;
  return (
    <div className="w-full sm:w-80 space-y-2">
      <Input label="Location" value={location} maxLength={200} onChange={e => setLocation(e.target.value)} placeholder="Studio B" />
      <Textarea label="Note for this call" value={note} maxLength={1000} onChange={e => setNote(e.target.value)} />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={save} isLoading={saving}>Save</Button>
      </div>
    </div>
  );
}

function StaffList({ productionId, sheet, onChanged, onError }: {
  productionId: string; sheet: CallSheet; onChanged: () => void; onError: (m: string) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const s = sheet.summary!;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); onChanged(); } catch (e) { onError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); }
  }

  const unmarked = sheet.called.filter(p => !p.status);

  return (
    <div data-tour="callsheet-list"><Panel
      title="Who is called"
      action={unmarked.length > 0 && (
        <MiniButton
          disabled={busy}
          onClick={() => run(async () => {
            await Promise.all(unmarked.map(p => markAttendance(productionId, sheet.date.id, p.user_id, 'present')));
            toast(`Marked ${unmarked.length} present`);
          })}
        >
          Mark everyone not yet marked as present
        </MiniButton>
      )}
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <Stat label="Called" value={s.called} />
        <Stat label="Present" value={s.present} tone="good" />
        <Stat label="Late" value={s.late} tone="warn" />
        <Stat label="Absent" value={s.absent} tone="bad" />
        <Stat label="Excused" value={s.excused} tone="accent" />
        <Stat label="Not marked" value={s.unmarked} />
      </div>
      {sheet.called.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>No cast are called for this date.</p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--t-section-border)' }}>
          {sheet.called.map(p => (
            <PersonRow key={p.user_id} person={p} busy={busy}
              onMark={status => run(() => markAttendance(productionId, sheet.date.id, p.user_id, status))}
              onClear={() => run(() => clearAttendance(productionId, sheet.date.id, p.user_id))}
            />
          ))}
        </ul>
      )}
    </Panel></div>
  );
}

function PersonRow({ person, busy, onMark, onClear }: {
  person: CalledPerson; busy: boolean; onMark: (s: AttendanceStatus) => void; onClear: () => void;
}) {
  const notice = person.notice;
  return (
    <li className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ borderColor: 'var(--t-section-border)' }}>
      <div className="min-w-[160px] flex-1">
        <p className="text-sm font-medium" style={{ color: 'var(--t-subtle-text-bright)' }}>{person.name}</p>
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          {notice && (
            <Pill tone={notice.kind === 'absent' ? 'bad' : 'warn'} title={notice.note ?? undefined}>
              {notice.kind === 'absent' ? 'Said: can’t make it' : `Said: ${notice.minutes_late} min late`}
              {notice.note ? ` — ${notice.note}` : ''}
            </Pill>
          )}
          {person.has_conflict && <Pill tone="bad">Submitted a conflict</Pill>}
          {person.checked_in_at && person.status === 'present' && <Pill tone="good">Checked in</Pill>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Mark ${person.name}`}>
        {STATUSES.map(s => (
          <MiniButton key={s.id} tone={s.tone} active={person.status === s.id} disabled={busy} onClick={() => onMark(s.id)}>{s.label}</MiniButton>
        ))}
        {person.status && <MiniButton disabled={busy} onClick={onClear} title="Clear this mark">Clear</MiniButton>}
      </div>
    </li>
  );
}

function CastView({ productionId, sheet, onChanged }: { productionId: string; sheet: CallSheet; onChanged: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [kind, setKind] = useState<'late' | 'absent' | null>(null);
  const [minutes, setMinutes] = useState('15');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const my = sheet.my;

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try { await fn(); toast(success); onChanged(); setKind(null); setNote(''); }
    catch (e) { toast(e instanceof ApiRequestError ? e.message : 'Something went wrong', 'error'); }
    finally { setBusy(false); }
  }

  const when = useMemo(() => new Date(`${sheet.date.date}T00:00:00`), [sheet.date.date]);
  const isPast = when.getTime() < new Date(new Date().toDateString()).getTime() - 24 * 3600 * 1000;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div data-tour="callsheet-mycall"><Panel title="My call">
        {!my.called ? (
          <p className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>You are not called for this date.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {my.status ? (
                <Pill tone={my.status === 'present' ? 'good' : my.status === 'late' ? 'warn' : my.status === 'absent' ? 'bad' : 'accent'}>
                  {my.status === 'present' ? 'Checked in' : `Marked ${my.status}`}
                </Pill>
              ) : <Pill>Not checked in</Pill>}
              {my.notice && (
                <Pill tone={my.notice.kind === 'absent' ? 'bad' : 'warn'}>
                  {my.notice.kind === 'absent' ? 'You told us you can’t make it' : `You told us you’ll be ${my.notice.minutes_late} min late`}
                </Pill>
              )}
            </div>

            {!my.status && !sheet.date.is_cancelled && (
              <Button size="sm" isLoading={busy} onClick={() => run(() => checkIn(productionId, sheet.date.id), 'Checked in. Break a leg!')}>
                I’m here — check in
              </Button>
            )}

            {!isPast && !sheet.date.is_cancelled && (
              <div className="pt-2" style={{ borderTop: '1px solid var(--t-section-border)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--t-subtle-text)' }}>Running late or can’t come? Tell the stage manager now.</p>
                {kind === null ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setKind('late')}>I’ll be late</Button>
                    <Button variant="secondary" size="sm" onClick={() => setKind('absent')}>I can’t make it</Button>
                    {my.notice && <Button variant="ghost" size="sm" isLoading={busy} onClick={() => run(() => withdrawNotice(productionId, sheet.date.id), 'Notice withdrawn')}>Withdraw my notice</Button>}
                  </div>
                ) : (
                  <div className="space-y-2 max-w-sm">
                    {kind === 'late' && (
                      <Input label="Minutes late" type="number" min={1} max={240} value={minutes} onChange={e => setMinutes(e.target.value)} />
                    )}
                    <Textarea label="Note (optional)" value={note} maxLength={500} onChange={e => setNote(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" isLoading={busy}
                        onClick={() => run(
                          () => sendNotice(productionId, { rehearsal_date_id: sheet.date.id, kind, minutes_late: kind === 'late' ? Number(minutes) : undefined, note: note || undefined }),
                          'Stage management has been told',
                        )}>
                        Send
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setKind(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Panel></div>

      <div data-tour="callsheet-called"><Panel title={sheet.full_company ? 'Called: full company' : 'Who is called'}>
        {sheet.called.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>No one is called yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {sheet.called.map(p => (
              <li key={p.user_id}><Pill tone={p.user_id === user?.id ? 'accent' : 'neutral'}>{p.name}{p.user_id === user?.id ? ' (you)' : ''}</Pill></li>
            ))}
          </ul>
        )}
      </Panel></div>
    </div>
  );
}

function AttendanceReport({ productionId }: { productionId: string }) {
  const { data, isLoading } = useApi(() => getAttendanceByMember(productionId), [productionId]);
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data || data.length === 0) return <Empty title="No cast yet" />;
  const hasHistory = data.some(r => r.called > 0);

  return (
    <Panel title="Attendance by person (past calls)">
      {!hasHistory && <p className="text-sm mb-3" style={{ color: 'var(--t-subtle-text)' }}>No rehearsals have happened yet. Totals appear here after the first call.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: 'var(--t-subtle-text)' }}>
              <th className="py-2 pr-3 font-semibold">Name</th>
              <th className="py-2 px-2 font-semibold text-right">Called</th>
              <th className="py-2 px-2 font-semibold text-right">Present</th>
              <th className="py-2 px-2 font-semibold text-right">Late</th>
              <th className="py-2 px-2 font-semibold text-right">Absent</th>
              <th className="py-2 px-2 font-semibold text-right">Excused</th>
              <th className="py-2 px-2 font-semibold text-right">Not marked</th>
              <th className="py-2 pl-3 font-semibold">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {data.map(r => (
              <tr key={r.user_id} style={{ borderTop: '1px solid var(--t-section-border)', color: 'var(--t-subtle-text-bright)' }}>
                <td className="py-2 pr-3">{r.name}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.called}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.present}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.late}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.absent}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.excused}</td>
                <td className="py-2 px-2 text-right tabular-nums">{r.unmarked}</td>
                <td className="py-2 pl-3">
                  {r.rate === null ? <span style={{ color: 'var(--t-subtle-text)' }}>—</span> : (
                    <Pill tone={r.rate >= 90 ? 'good' : r.rate >= 70 ? 'warn' : 'bad'}>{r.rate}%</Pill>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs" style={{ color: 'var(--t-subtle-text)' }}>
        Attendance counts present and late as attending. Excused absences are left out of the percentage.
      </p>
    </Panel>
  );
}
