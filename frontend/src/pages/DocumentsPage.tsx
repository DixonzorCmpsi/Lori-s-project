import { lazy, Suspense, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
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
  listDocuments, uploadDocument, deleteDocument, downloadDocument, formatBytes, DOCUMENT_CATEGORIES, type DocumentItem,
} from '@/services/documents';
import {
  listForms, getForm, createForm, updateForm, deleteForm, signForm, getSignatures, remindUnsigned,
  type FormListItem, type FormDetail, type SignatureStatus,
} from '@/services/forms';
import { ApiRequestError } from '@/services/api';

const DocumentViewer = lazy(() => import('@/components/DocumentViewer'));
import { formatDate, formatRelativeTime } from '@/utils/format';
import { PageGuide } from '@/components/PageGuide';
import { PageTour } from '@/tours/PageTour';
import { documentsTourSteps, formsTourSteps } from '@/tours/pageTours';

export function DocumentsPage() {
  usePageTitle('Documents');
  const { id } = useParams<{ id: string }>();
  const { userRole } = useProduction();
  const isStaff = userRole === 'director' || userRole === 'staff';
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'forms' ? 'forms' : 'files';

  return (
    <div>
      <PageTour tourId={`page-documents-${tab}`} steps={tab === 'files' ? documentsTourSteps : formsTourSteps} />
      <PageHeader
        title="Documents"
        subtitle="Scripts, music and handbooks, plus forms to sign."
        actions={
          <div className="flex gap-1" role="tablist" data-tour="docs-tabs">
            <MiniButton active={tab === 'files'} tone="accent" onClick={() => setParams({}, { replace: true })}>Files</MiniButton>
            <MiniButton active={tab === 'forms'} tone="accent" onClick={() => setParams({ tab: 'forms' }, { replace: true })}>Forms</MiniButton>
          </div>
        }
      />
      <PageGuide page={tab === 'files' ? 'files' : 'forms'} />
      {tab === 'files' ? <Files productionId={id!} isStaff={isStaff} /> : <Forms productionId={id!} isStaff={isStaff} />}
    </div>
  );
}

// ── Files ─────────────────────────────────────────────────────────────

function Files({ productionId, isStaff }: { productionId: string; isStaff: boolean }) {
  const { toast } = useToast();
  const docs = useApi(() => listDocuments(productionId), [productionId]);
  const [category, setCategory] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('script');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [deleting, setDeleting] = useState<DocumentItem | null>(null);
  const [viewing, setViewing] = useState<DocumentItem | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const shown = (docs.data ?? []).filter(d => category === 'all' || d.category === category);

  async function upload() {
    if (!file) { toast('Choose a file first', 'warning'); return; }
    if (!title.trim()) { toast('Give the file a title', 'warning'); return; }
    setUploading(true);
    try {
      await uploadDocument(productionId, file, { title: title.trim(), category: cat, description });
      toast('File uploaded');
      setTitle(''); setDescription(''); setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      docs.refetch();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-4">
      {isStaff && (
        <div data-tour="docs-upload"><Panel title="Add a file">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label htmlFor="doc-file" className="block text-sm font-medium text-foreground mb-1">File</label>
              <input
                id="doc-file" ref={fileInput} type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.markdown,.rtf,.csv,.png,.jpg,.jpeg,.gif,.mp3,.m4a,.wav,.mp4"
                onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '')); }}
                className="block w-full text-sm" style={{ color: 'var(--t-subtle-text-bright)' }}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--t-subtle-text)' }}>Up to 10 MB. PDF, Word, Excel, PowerPoint, text, Markdown, images, audio or MP4.</p>
            </div>
            <Input label="Title" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} />
            <Select label="Category" value={cat} onChange={e => setCat(e.target.value)}>
              {DOCUMENT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
            <div className="md:col-span-3"><Input label="Description (optional)" value={description} maxLength={1000} onChange={e => setDescription(e.target.value)} /></div>
            <div className="flex items-end"><Button onClick={upload} isLoading={uploading}>Upload</Button></div>
          </div>
        </Panel></div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <MiniButton active={category === 'all'} tone="accent" onClick={() => setCategory('all')}>All</MiniButton>
        {DOCUMENT_CATEGORIES.map(c => <MiniButton key={c.id} active={category === c.id} tone="accent" onClick={() => setCategory(c.id)}>{c.label}</MiniButton>)}
      </div>

      {docs.isLoading ? <Skeleton className="h-32 w-full" /> : shown.length === 0 ? (
        <Empty title="No files here yet">{isStaff ? 'Upload the script or a handbook above.' : 'Files your director shares will appear here.'}</Empty>
      ) : (
        <div data-tour="docs-list" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(d => (
            <Panel key={d.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm break-words" style={{ color: 'var(--t-subtle-text-bright)' }}>{d.title}</p>
                <Pill tone="accent">{DOCUMENT_CATEGORIES.find(c => c.id === d.category)?.label ?? d.category}</Pill>
              </div>
              {d.description && <p className="mt-1 text-sm" style={{ color: 'var(--t-subtle-text)' }}>{d.description}</p>}
              <p className="mt-2 text-xs flex-1" style={{ color: 'var(--t-subtle-text)' }}>
                {d.filename} · {formatBytes(d.size_bytes)} · {formatRelativeTime(d.created_at)}{d.uploaded_by_name ? ` by ${d.uploaded_by_name}` : ''}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => setViewing(d)}>View</Button>
                <Button size="sm" variant="secondary" onClick={() => downloadDocument(productionId, d).catch(e => toast(e.message, 'error'))}>Download</Button>
                {isStaff && <MiniButton tone="bad" onClick={() => setDeleting(d)}>Delete</MiniButton>}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {viewing && (
        <Suspense fallback={null}>
          <DocumentViewer productionId={productionId} doc={viewing} onClose={() => setViewing(null)} />
        </Suspense>
      )}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title={`Delete “${deleting?.title}”?`} confirmLabel="Delete" confirmVariant="destructive"
        onConfirm={async () => {
          const d = deleting!; setDeleting(null);
          try { await deleteDocument(productionId, d.id); toast('File deleted'); docs.refetch(); }
          catch (e) { toast(e instanceof ApiRequestError ? e.message : 'Could not delete', 'error'); }
        }}>
        Everyone loses access to this file.
      </Dialog>
    </div>
  );
}

// ── Forms ─────────────────────────────────────────────────────────────

function Forms({ productionId, isStaff }: { productionId: string; isStaff: boolean }) {
  const forms = useApi(() => listForms(productionId), [productionId]);
  const [creating, setCreating] = useState(false);
  const [signing, setSigning] = useState<string | null>(null);
  const [tracking, setTracking] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const visible = (forms.data ?? []).filter(f => showArchived || f.is_active);
  const todo = visible.filter(f => f.applies_to_me && !f.signed && f.is_active);
  const trackedForm = tracking ? forms.data?.find(f => f.id === tracking) : undefined;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm" style={{ color: 'var(--t-subtle-text)' }}>
          {todo.length > 0 ? `${todo.length} ${todo.length === 1 ? 'form needs' : 'forms need'} your signature.` : 'You are all caught up.'}
        </p>
        <div className="flex gap-2">
          {isStaff && <MiniButton active={showArchived} onClick={() => setShowArchived(v => !v)}>Show archived</MiniButton>}
          {isStaff && <span data-tour="forms-new"><Button size="sm" onClick={() => setCreating(true)}>New form</Button></span>}
        </div>
      </div>

      {forms.isLoading ? <Skeleton className="h-32 w-full" /> : visible.length === 0 ? (
        <Empty title="No forms yet">{isStaff ? 'Create a permission slip, waiver or policy for people to sign.' : 'Forms your director sends will appear here.'}</Empty>
      ) : (
        <div data-tour="forms-list" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(f => (
            <Panel key={f.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm" style={{ color: 'var(--t-subtle-text-bright)' }}>{f.title}</p>
                {!f.is_active ? <Pill>Archived</Pill> : !f.applies_to_me ? <Pill>Not for you</Pill> : f.signed ? <Pill tone="good">Signed</Pill> : <Pill tone="warn">To sign</Pill>}
              </div>
              <p className="mt-1 text-xs flex-1" style={{ color: 'var(--t-subtle-text)' }}>
                {f.audience === 'cast' ? 'Cast only' : 'Everyone'}{f.requires_guardian ? ' · guardian signature for under 18' : ''}
              </p>
              {isStaff && f.signed_count !== undefined && (
                <p className="mt-2 text-xs" style={{ color: 'var(--t-subtle-text-bright)' }}>{f.signed_count} of {f.required_count} signed</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSigning(f.id)}>{f.signed || !f.applies_to_me || !f.is_active ? 'Read' : 'Read and sign'}</Button>
                {isStaff && <MiniButton onClick={() => setTracking(f.id)}>Who signed</MiniButton>}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {creating && <NewForm productionId={productionId} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); forms.refetch(); }} />}
      {signing && <SignDialog productionId={productionId} formId={signing} onClose={() => setSigning(null)} onSigned={() => { forms.refetch(); }} />}
      {trackedForm && <Tracker productionId={productionId} form={trackedForm} onClose={() => setTracking(null)} onChanged={forms.refetch} />}
    </div>
  );
}

function NewForm({ productionId, onClose, onCreated }: { productionId: string; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [guardian, setGuardian] = useState(true);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open onClose={onClose} title="New form" confirmLabel="Publish" isLoading={busy}
      onConfirm={async () => {
        if (!title.trim() || !body.trim()) { toast('Add a title and the form text', 'warning'); return; }
        setBusy(true);
        try { await createForm(productionId, { title, body, requires_guardian: guardian, audience }); toast('Form published'); onCreated(); }
        catch (e) { toast(e instanceof ApiRequestError ? e.message : 'Could not publish', 'error'); }
        finally { setBusy(false); }
      }}>
      <div className="grid gap-3 text-foreground">
        <Input label="Title" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} placeholder="Photo and video release" />
        <Textarea label="Form text" rows={8} value={body} maxLength={20000} onChange={e => setBody(e.target.value)}
          placeholder="Write exactly what people are agreeing to. Once someone signs, the text can no longer be changed." />
        <Select label="Who signs" value={audience} onChange={e => setAudience(e.target.value)}>
          <option value="all">Everyone in the production</option>
          <option value="cast">Cast only</option>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={guardian} onChange={e => setGuardian(e.target.checked)} style={{ accentColor: 'var(--color-accent)' }} />
          Ask a parent or guardian to sign for members under 18
        </label>
      </div>
    </Dialog>
  );
}

function SignDialog({ productionId, formId, onClose, onSigned }: { productionId: string; formId: string; onClose: () => void; onSigned: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: form, isLoading } = useApi<FormDetail>(() => getForm(productionId, formId), [productionId, formId]);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [gName, setGName] = useState('');
  const [gEmail, setGEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const minor = user?.age_range === '13-17';
  const canSign = !!form && form.is_active && form.applies_to_me && !form.my_signature;

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await signForm(productionId, formId, { signed_name: name, agree, guardian_name: gName || undefined, guardian_email: gEmail || undefined });
      toast('Signed. Thank you!');
      onSigned();
      onClose();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not sign');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={form?.title ?? 'Form'} confirmLabel={canSign ? 'Sign' : undefined} isLoading={busy} onConfirm={canSign ? submit : undefined}>
      {isLoading || !form ? <Skeleton className="h-24 w-full" /> : (
        <div className="grid gap-3">
          <div className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm rounded-md p-3" style={{ background: 'var(--t-subtle-bg)', color: 'var(--t-subtle-text-bright)' }}>{form.body}</div>
          {form.my_signature ? (
            <p className="text-sm text-foreground">Signed by {form.my_signature.signed_name} on {formatDate(form.my_signature.signed_at.slice(0, 10))}.
              {form.my_signature.guardian_name ? ` Guardian: ${form.my_signature.guardian_name}.` : ''}</p>
          ) : !canSign ? (
            <p className="text-sm text-foreground">{form.is_active ? 'This form is not for your role.' : 'This form is archived and no longer open.'}</p>
          ) : (
            <div className="grid gap-3 text-foreground">
              <Input label={`Type your full name to sign (${user?.name})`} value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
              {minor && form.requires_guardian && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input label="Parent or guardian name" value={gName} onChange={e => setGName(e.target.value)} />
                  <Input label="Parent or guardian email" type="email" value={gEmail} onChange={e => setGEmail(e.target.value)} />
                </div>
              )}
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5" style={{ accentColor: 'var(--color-accent)' }} />
                I have read this form and agree to it.
              </label>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function Tracker({ productionId, form, onClose, onChanged }: { productionId: string; form: FormListItem; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useApi<SignatureStatus>(() => getSignatures(productionId, form.id), [productionId, form.id]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function act(fn: () => Promise<unknown>, success: string, closeAfter = false) {
    try { await fn(); toast(success); onChanged(); refetch(); if (closeAfter) onClose(); }
    catch (e) { toast(e instanceof ApiRequestError ? e.message : 'Something went wrong', 'error'); }
  }

  return (
    <Dialog open onClose={onClose} title={form.title}>
      {isLoading || !data ? <Skeleton className="h-24 w-full" /> : (
        <div className="grid gap-3 text-foreground max-h-[60vh] overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {data.pending.length > 0 && form.is_active && (
              <Button size="sm" variant="secondary" onClick={() => act(async () => { const r = await remindUnsigned(productionId, form.id); toast(`Reminded ${r.emailed} of ${r.pending}`); }, 'Reminder sent')}>
                Remind {data.pending.length} unsigned
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => act(() => updateForm(productionId, form.id, { is_active: !form.is_active }), form.is_active ? 'Form archived' : 'Form reopened', true)}>
              {form.is_active ? 'Archive' : 'Reopen'}
            </Button>
            {(form.signed_count ?? 0) === 0 && <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Button>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--t-subtle-text)' }}>Signed ({data.signed.length})</p>
            {data.signed.length === 0 ? <p className="text-sm text-muted">No one yet.</p> : (
              <ul className="space-y-1 text-sm">
                {data.signed.map(s => (
                  <li key={s.user_id}>{s.name} <span className="text-xs text-muted">{formatRelativeTime(s.signed_at)}{s.guardian_name ? ` · guardian ${s.guardian_name} (${s.guardian_email})` : ''}</span></li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--t-subtle-text)' }}>Still to sign ({data.pending.length})</p>
            {data.pending.length === 0 ? <p className="text-sm text-muted">Everyone has signed.</p> : (
              <ul className="space-y-1 text-sm">
                {data.pending.map(p => <li key={p.user_id}>{p.name} {p.is_minor && <Pill tone="accent">Under 18</Pill>}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this form?" confirmLabel="Delete" confirmVariant="destructive"
        onConfirm={() => { setConfirmDelete(false); act(() => deleteForm(productionId, form.id), 'Form deleted', true); }}>
        No one has signed it yet, so nothing is lost.
      </Dialog>
    </Dialog>
  );
}
