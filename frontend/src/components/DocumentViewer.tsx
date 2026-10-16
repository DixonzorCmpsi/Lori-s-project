import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Markdown } from '@/components/ui/Markdown';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { parseCsv } from '@/utils/csv';
import { fetchDocumentBlob, saveBlob, viewKind, formatBytes, type DocumentItem } from '@/services/documents';

type Content =
  | { type: 'url'; url: string }
  | { type: 'text'; text: string }
  | { type: 'html'; html: string }
  | { type: 'table'; sheets: { name: string; rows: string[][] }[] }
  | { type: 'none' };

const MAX_TABLE_ROWS = 500;

/** Opens a file in a pop-up: PDF, Word (.docx), Excel (.xlsx), CSV, Markdown, text, images, audio and video. */
export default function DocumentViewer({ productionId, doc, onClose }: { productionId: string; doc: DocumentItem; onClose: () => void }) {
  const { toast } = useToast();
  const kind = useMemo(() => viewKind(doc.filename), [doc.filename]);
  const [content, setContent] = useState<Content | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        if (kind === 'none') { setContent({ type: 'none' }); return; }
        const raw = await fetchDocumentBlob(productionId, doc);
        if (cancelled) return;
        setBlob(raw);
        const typed = new Blob([raw], { type: doc.content_type });

        if (kind === 'pdf' || kind === 'image' || kind === 'audio' || kind === 'video') {
          objectUrl = URL.createObjectURL(typed);
          setContent({ type: 'url', url: objectUrl });
        } else if (kind === 'text' || kind === 'markdown') {
          setContent({ type: 'text', text: await raw.text() });
        } else if (kind === 'csv') {
          const rows = parseCsv(await raw.text());
          setContent({ type: 'table', sheets: [{ name: 'Sheet 1', rows: rows.slice(0, MAX_TABLE_ROWS) }] });
        } else if (kind === 'docx') {
          const [{ default: mammoth }, { default: DOMPurify }] = await Promise.all([import('mammoth'), import('dompurify')]);
          const result = await mammoth.convertToHtml({ arrayBuffer: await raw.arrayBuffer() });
          if (!cancelled) setContent({ type: 'html', html: DOMPurify.sanitize(result.value) });
        } else if (kind === 'xlsx') {
          const { default: readXlsxFile } = await import('read-excel-file/browser');
          const sheets = await readXlsxFile(raw);
          if (!cancelled) {
            setContent({
              type: 'table',
              sheets: sheets.map(s => ({
                name: s.sheet,
                rows: s.data.slice(0, MAX_TABLE_ROWS).map(r => r.map(c => (c === null || c === undefined ? '' : c instanceof Date ? c.toLocaleDateString() : String(c)))),
              })),
            });
          }
        }
      } catch {
        if (!cancelled) setError('We could not open a preview of this file. You can still download it.');
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [productionId, doc, kind]);

  async function download() {
    try { saveBlob(blob ?? await fetchDocumentBlob(productionId, doc), doc.filename); }
    catch { toast('Could not download that file', 'error'); }
  }

  const actions = (
    <>
      {content?.type === 'url' && kind === 'pdf' && (
        <a href={content.url} target="_blank" rel="noopener noreferrer" className="text-sm underline text-accent px-2">Open in a new tab</a>
      )}
      <Button size="sm" variant="secondary" onClick={download}>Download</Button>
    </>
  );

  const current = content?.type === 'table' ? content.sheets[Math.min(sheet, content.sheets.length - 1)] : null;

  return (
    <Modal open onClose={onClose} title={doc.title} subtitle={`${doc.filename} · ${formatBytes(doc.size_bytes)}`} actions={actions}>
      {error ? (
        <Fallback message={error} />
      ) : !content ? (
        <div className="p-6 space-y-3"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></div>
      ) : content.type === 'none' ? (
        <Fallback message="This type of file can’t be previewed here. Use Download to open it on your device." />
      ) : content.type === 'url' && kind === 'pdf' ? (
        <iframe title={doc.title} src={content.url} className="w-full h-full border-0 bg-white" />
      ) : content.type === 'url' && kind === 'image' ? (
        <div className="p-4 flex justify-center"><img src={content.url} alt={doc.title} className="max-w-full max-h-[78vh] object-contain rounded-lg" /></div>
      ) : content.type === 'url' && kind === 'audio' ? (
        <div className="p-8"><audio controls src={content.url} className="w-full" /></div>
      ) : content.type === 'url' && kind === 'video' ? (
        <div className="p-4 flex justify-center"><video controls src={content.url} className="max-w-full max-h-[78vh] rounded-lg" /></div>
      ) : content.type === 'html' ? (
        <article className="doc-html mx-auto max-w-3xl px-6 py-6" dangerouslySetInnerHTML={{ __html: content.html }} />
      ) : content.type === 'text' ? (
        <div className="mx-auto max-w-3xl px-6 py-6">
          {kind === 'markdown' ? <Markdown source={content.text} /> : <pre className="whitespace-pre-wrap text-sm font-mono">{content.text}</pre>}
        </div>
      ) : current ? (
        <div className="p-4">
          {content.type === 'table' && content.sheets.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-3" role="tablist">
              {content.sheets.map((s, i) => (
                <button key={s.name} role="tab" aria-selected={i === sheet} onClick={() => setSheet(i)}
                  className="px-3 py-1 rounded-md text-xs font-medium cursor-pointer"
                  style={{ background: i === sheet ? 'var(--t-tab-active-bg)' : 'transparent', color: i === sheet ? 'var(--t-tab-active-text)' : 'var(--t-muted)', border: '1px solid var(--t-border)' }}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-auto rounded-lg" style={{ border: '1px solid var(--t-border)' }}>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {current.rows.map((r, ri) => (
                  <tr key={ri} style={{ background: ri === 0 ? 'var(--t-subtle-bg)' : undefined, fontWeight: ri === 0 ? 600 : 400 }}>
                    {r.map((c, ci) => <td key={ci} className="px-3 py-1.5 align-top" style={{ borderBottom: '1px solid var(--t-border)' }}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {current.rows.length >= MAX_TABLE_ROWS && <p className="mt-2 text-xs text-muted">Showing the first {MAX_TABLE_ROWS} rows. Download the file to see everything.</p>}
        </div>
      ) : null}
    </Modal>
  );
}

function Fallback({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center p-8 text-center">
      <p className="max-w-sm text-sm text-muted">{message}</p>
    </div>
  );
}
