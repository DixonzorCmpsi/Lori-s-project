import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useCalls, callLabel, localISO } from '@/hooks/useCalls';
import { useProduction } from '@/components/theater/BackstageLayout';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader, Panel, Pill, MiniButton, Empty } from '@/components/ui/page';
import {
  listReports, getReport, getReportTemplate, createReport, updateReport, deleteReport, sendReport,
  acknowledgeReport, getAttendanceSnapshot, type Report, type ReportSummary,
} from '@/services/reports';
import { formatDate, formatRelativeTime } from '@/utils/format';
import { ApiRequestError } from '@/services/api';
import { PageGuide } from '@/components/PageGuide';
import { PageTour } from '@/tours/PageTour';
import { reportsTourSteps } from '@/tours/pageTours';

type View = { kind: 'list' } | { kind: 'edit'; id: string | null } | { kind: 'read'; id: string };

export function ReportsPage() {
  usePageTitle('Rehearsal reports');
  const { id } = useParams<{ id: string }>();
  const { userRole } = useProduction();
  const isStaff = userRole === 'director' || userRole === 'staff';
  const [view, setView] = useState<View>({ kind: 'list' });
  const list = useApi(() => listReports(id!), [id]);

  const back = () => { setView({ kind: 'list' }); list.refetch(); };

  if (view.kind === 'edit') return <Editor productionId={id!} reportId={view.id} onDone={back} onCancel={() => setView(view.id ? { kind: 'read', id: view.id } : { kind: 'list' })} />;
  if (view.kind === 'read') return <Reader productionId={id!} reportId={view.id} isStaff={isStaff} onBack={back} onEdit={() => setView({ kind: 'edit', id: view.id })} />;

  return (
    <div>
      <PageHeader
        title="Rehearsal reports"
        subtitle={isStaff ? 'End-of-day notes for every department, sent to a distribution list.' : 'Reports you were included on.'}
        actions={isStaff && <span data-tour="reports-new"><Button size="sm" onClick={() => setView({ kind: 'edit', id: null })}>New report</Button></span>}
      />
      {isStaff && <PageTour tourId="page-reports" steps={reportsTourSteps} />}
      <PageGuide page="reports" />
      {list.isLoading ? <Skeleton className="h-40 w-full" /> : !list.data || list.data.length === 0 ? (
        <Empty title="No reports yet">{isStaff ? 'Write the first one after your next rehearsal.' : 'Reports you are sent will appear here.'}</Empty>
      ) : (
        <div data-tour="reports-list" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map(r => <ReportCard key={r.id} report={r} onOpen={() => setView({ kind: 'read', id: r.id })} />)}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report, onOpen }: { report: ReportSummary; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="text-left cursor-pointer">
      <Panel className="h-full">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm" style={{ color: 'var(--t-subtle-text-bright)' }}>{report.title}</p>
          <Pill tone={report.status === 'sent' ? 'good' : 'warn'}>{report.status === 'sent' ? 'Sent' : 'Draft'}</Pill>
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--t-subtle-text)' }}>{formatDate(report.report_date)}</p>
        <p className="mt-3 text-xs" style={{ color: 'var(--t-subtle-text)' }}>
          {report.recipient_count} {report.recipient_count === 1 ? 'recipient' : 'recipients'}
          {report.author_name ? ` · by ${report.author_name}` : ''}
          {report.sent_at ? ` · sent ${formatRelativeTime(report.sent_at)}` : ''}
        </p>
      </Panel>
    </button>
  );
}

function Reader({ productionId, reportId, isStaff, onBack, onEdit }: {
  productionId: string; reportId: string; isStaff: boolean; onBack: () => void; onEdit: () => void;
}) {
  const { toast } = useToast();
  const template = useApi(() => getReportTemplate(productionId).catch(() => ({ sections: [] as { key: string; label: string }[] })), [productionId]);
  const { data: report, isLoading, refetch } = useApi<Report>(() => getReport(productionId, reportId), [productionId, reportId]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    template.data?.sections.forEach(s => { map[s.key] = s.label; });
    return map;
  }, [template.data]);

  async function run(fn: () => Promise<unknown>, success: string, after?: () => void) {
    setBusy(true);
    try { await fn(); toast(success); if (after) after(); else refetch(); }
    catch (e) { toast(e instanceof ApiRequestError ? e.message : 'Something went wrong', 'error'); }
    finally { setBusy(false); }
  }

  if (isLoading || !report) return <Skeleton className="h-64 w-full" />;
  const entries = Object.entries(report.sections);
  const a = report.attendance;
  const confirmed = report.recipients?.filter(r => r.acknowledged_at).length ?? 0;

  return (
    <div>
      <PageHeader
        title={report.title}
        subtitle={`${formatDate(report.report_date)}${report.author_name ? ` · by ${report.author_name}` : ''}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={onBack}>← All reports</Button>
            {isStaff && <Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button>}
            {isStaff && report.status === 'draft' && (
              <Button size="sm" isLoading={busy} onClick={() => run(() => sendReport(productionId, reportId), 'Report sent')}>Send report</Button>
            )}
            {isStaff && <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-4 content-start">
          {a && (
            <Panel title="Attendance">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Pill>{a.called} called</Pill>
                <Pill tone="good">{a.present} present</Pill>
                {a.late.length > 0 && <Pill tone="warn">{a.late.length} late</Pill>}
                {a.absent.length > 0 && <Pill tone="bad">{a.absent.length} absent</Pill>}
                {a.excused.length > 0 && <Pill tone="accent">{a.excused.length} excused</Pill>}
                {a.not_marked > 0 && <Pill>{a.not_marked} not marked</Pill>}
              </div>
              <ul className="text-sm space-y-0.5" style={{ color: 'var(--t-subtle-text-bright)' }}>
                {a.late.map(l => <li key={l.name}>Late: {l.name}{l.minutes ? ` (${l.minutes} min)` : ''}</li>)}
                {a.absent.map(n => <li key={n}>Absent: {n}</li>)}
                {a.excused.map(n => <li key={n}>Excused: {n}</li>)}
              </ul>
            </Panel>
          )}
          {entries.length === 0 ? <Panel><p className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>No notes in this report.</p></Panel> : entries.map(([key, text]) => (
            <Panel key={key} title={labels[key] ?? key}>
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--t-subtle-text-bright)' }}>{text}</p>
            </Panel>
          ))}
        </div>
        <div className="grid gap-4 content-start">
          {!isStaff && report.status === 'sent' && (
            <Panel title="Confirm">
              {report.my_acknowledged ? <Pill tone="good">You confirmed you read this</Pill> : (
                <Button size="sm" isLoading={busy} onClick={() => run(() => acknowledgeReport(productionId, reportId), 'Thanks, confirmed')}>I’ve read this</Button>
              )}
            </Panel>
          )}
          {isStaff && report.recipients && (
            <Panel title={`Distribution (${confirmed}/${report.recipients.length} confirmed)`}>
              {report.recipients.length === 0 ? <p className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>No one yet. Edit the report to add people.</p> : (
                <ul className="space-y-1.5">
                  {report.recipients.map(r => (
                    <li key={r.user_id} className="flex items-center justify-between gap-2 text-sm" style={{ color: 'var(--t-subtle-text-bright)' }}>
                      <span>{r.name} <span className="text-xs capitalize" style={{ color: 'var(--t-subtle-text)' }}>{r.role}</span></span>
                      {report.status === 'sent' ? (r.acknowledged_at ? <Pill tone="good">Read</Pill> : <Pill>Not yet</Pill>) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this report?"
        confirmLabel="Delete" confirmVariant="destructive" isLoading={busy}
        onConfirm={() => run(() => deleteReport(productionId, reportId), 'Report deleted', onBack)}>
        This removes the report for everyone it was sent to.
      </Dialog>
    </div>
  );
}

function Editor({ productionId, reportId, onDone, onCancel }: {
  productionId: string; reportId: string | null; onDone: () => void; onCancel: () => void;
}) {
  const { toast } = useToast();
  const { members } = useProduction();
  const { calls, defaultCall } = useCalls(productionId);
  const template = useApi(() => getReportTemplate(productionId), [productionId]);
  const existing = useApi<Report | null>(() => (reportId ? getReport(productionId, reportId) : Promise.resolve(null)), [productionId, reportId]);

  if (template.isLoading || existing.isLoading) return <Skeleton className="h-64 w-full" />;
  return (
    <EditorForm key={reportId ?? 'new'} productionId={productionId} existing={existing.data} sections={template.data?.sections ?? []}
      calls={calls} defaultCallId={defaultCall?.id ?? ''} members={members} onDone={onDone} onCancel={onCancel} toast={toast} />
  );
}

function EditorForm({ productionId, existing, sections, calls, defaultCallId, members, onDone, onCancel, toast }: {
  productionId: string; existing: Report | null; sections: { key: string; label: string }[];
  calls: ReturnType<typeof useCalls>['calls']; defaultCallId: string; members: ReturnType<typeof useProduction>['members'];
  onDone: () => void; onCancel: () => void; toast: (m: string, t?: 'success' | 'error' | 'warning') => void;
}) {
  const staffIds = useMemo(() => members.filter(m => m.role !== 'cast').map(m => m.user_id), [members]);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.report_date ?? localISO(new Date()));
  const [callId, setCallId] = useState(existing?.rehearsal_date_id ?? '');
  const [values, setValues] = useState<Record<string, string>>(existing?.sections ?? {});
  const [dist, setDist] = useState<Set<string>>(new Set(existing?.distribution ?? staffIds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function pickCall(dateId: string) {
    setCallId(dateId);
    const c = calls.find(x => x.id === dateId);
    if (c) {
      setDate(c.date);
      if (!title.trim()) setTitle(`Rehearsal report: ${formatDate(c.date)}`);
    }
  }

  async function insertAttendance() {
    if (!callId) { toast('Pick the rehearsal first', 'warning'); return; }
    try {
      const snap = await getAttendanceSnapshot(productionId, callId);
      const lines: string[] = [];
      if (snap.late?.length) lines.push(`Late: ${snap.late.map(l => `${l.name}${l.minutes ? ` (${l.minutes} min)` : ''}`).join(', ')}`);
      if (snap.absent?.length) lines.push(`Absent: ${snap.absent.join(', ')}`);
      if (snap.excused?.length) lines.push(`Excused: ${snap.excused.join(', ')}`);
      if (lines.length === 0) lines.push('Everyone marked was on time.');
      setValues(v => ({ ...v, cast_notes: [v.cast_notes, lines.join('\n')].filter(Boolean).join('\n\n') }));
      toast('Attendance added to Cast notes');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load attendance', 'error');
    }
  }

  async function save(send: boolean) {
    setError('');
    if (!title.trim()) { setError('Give the report a title.'); return; }
    setSaving(true);
    try {
      const payload = { title, report_date: date, rehearsal_date_id: callId || null, sections: values, distribution: [...dist] };
      const saved = existing ? await updateReport(productionId, existing.id, payload) : await createReport(productionId, payload);
      if (send) {
        const r = await sendReport(productionId, saved.id);
        toast(`Sent to ${r.recipients} ${r.recipients === 1 ? 'person' : 'people'}`);
      } else {
        toast('Draft saved');
      }
      onDone();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not save the report');
    } finally {
      setSaving(false);
    }
  }

  const toggle = (uid: string) => setDist(prev => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });

  return (
    <div>
      <PageHeader title={existing ? 'Edit report' : 'New rehearsal report'} actions={<Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-4 content-start">
          <Panel title="Basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Input label="Title" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} placeholder="Rehearsal report: Act 1 blocking" /></div>
              <Select label="Rehearsal" value={callId} onChange={e => pickCall(e.target.value)}>
                <option value="">Not linked to a rehearsal</option>
                {calls.map(c => <option key={c.id} value={c.id}>{callLabel(c)}</option>)}
              </Select>
              <Input label="Report date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            {!existing && defaultCallId && !callId && (
              <p className="mt-2 text-xs" style={{ color: 'var(--t-subtle-text)' }}>Link a rehearsal to pull in who was late or absent.</p>
            )}
          </Panel>
          {sections.map(s => (
            <Panel key={s.key} title={s.label}
              action={s.key === 'cast_notes' ? <MiniButton onClick={insertAttendance}>Insert late and absent</MiniButton> : undefined}>
              <Textarea aria-label={s.label} rows={3} maxLength={5000} value={values[s.key] ?? ''}
                onChange={e => setValues(v => ({ ...v, [s.key]: e.target.value }))} />
            </Panel>
          ))}
        </div>
        <div className="grid gap-4 content-start lg:sticky lg:top-0">
          <Panel title="Distribution list" action={
            <div className="flex gap-1">
              <MiniButton onClick={() => setDist(new Set(staffIds))}>Staff</MiniButton>
              <MiniButton onClick={() => setDist(new Set(members.map(m => m.user_id)))}>Everyone</MiniButton>
              <MiniButton onClick={() => setDist(new Set())}>Clear</MiniButton>
            </div>
          }>
            <ul className="space-y-1.5 max-h-72 overflow-y-auto">
              {[...members].sort((a, b) => (a.role === 'cast' ? 1 : 0) - (b.role === 'cast' ? 1 : 0) || (a.name ?? '').localeCompare(b.name ?? '')).map(m => (
                <li key={m.user_id}>
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--t-subtle-text-bright)' }}>
                    <input type="checkbox" checked={dist.has(m.user_id)} onChange={() => toggle(m.user_id)} style={{ accentColor: 'var(--color-accent)' }} />
                    <span className="truncate">{m.name ?? 'Member'}</span>
                    <span className="text-[11px] capitalize" style={{ color: 'var(--t-subtle-text)' }}>{m.role}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs" style={{ color: 'var(--t-subtle-text)' }}>{dist.size} selected. People with email on will receive it.</p>
          </Panel>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => save(false)} isLoading={saving}>Save draft</Button>
            <Button onClick={() => save(true)} isLoading={saving}>Save and send</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
