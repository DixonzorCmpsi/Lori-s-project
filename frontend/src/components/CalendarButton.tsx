import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { getCalendarLink, resetCalendarLink, feedUrl, webcalUrl, type CalendarLink } from '@/services/calendar';
import { getDoubleBookings } from '@/services/attendance';
import { describeDoubleBooking } from '@/utils/doubleBooking';

/** "Add to my calendar": a private link that keeps Google, Apple or Outlook calendar in sync. */
export function CalendarButton({ productionId }: { productionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-tour="schedule-calendar-link"
        onClick={() => setOpen(true)}
        className="text-[10px] uppercase tracking-widest px-3 py-1.5 rounded cursor-pointer"
        style={{ color: 'var(--t-subtle-text-bright)', background: 'var(--t-subtle-bg)', border: '1px solid var(--t-section-border)' }}
      >
        Add to my calendar
      </button>
      {open && <CalendarDialog productionId={productionId} onClose={() => setOpen(false)} />}
    </>
  );
}

function CalendarDialog({ productionId, onClose }: { productionId: string; onClose: () => void }) {
  const { toast } = useToast();
  const { data, refetch } = useApi<CalendarLink>(() => getCalendarLink(productionId), [productionId]);
  const [busy, setBusy] = useState(false);
  const url = data ? feedUrl(data) : '';

  async function copy() {
    try { await navigator.clipboard.writeText(url); toast('Link copied'); }
    catch { toast('Copy failed. Select the link and copy it by hand.', 'warning'); }
  }

  async function reset() {
    setBusy(true);
    try { await resetCalendarLink(productionId); toast('New link created. The old one has stopped working.'); refetch(); }
    catch { toast('Could not reset the link', 'error'); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open onClose={onClose} title="Add my calls to my calendar">
      {!data ? <p>Loading…</p> : (
        <div className="grid gap-3 text-foreground text-sm">
          <p className="text-muted">
            Subscribe once and your calendar always shows your calls, including changes and cancellations. It only lists calls you are in.
          </p>
          <div className="flex gap-2">
            <input readOnly value={url} aria-label="Calendar link" onFocus={e => e.currentTarget.select()}
              className="flex-1 min-w-0 px-3 py-2 rounded-md bg-surface-raised border border-border text-xs" />
            <Button size="sm" onClick={copy}>Copy</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={webcalUrl(data)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-background">Open in my calendar app</a>
          </div>
          <ul className="text-xs text-muted list-disc pl-5 space-y-1">
            <li><b className="text-foreground">Google Calendar:</b> Other calendars → From URL → paste the link.</li>
            <li><b className="text-foreground">Apple Calendar:</b> File → New Calendar Subscription → paste the link.</li>
            <li><b className="text-foreground">Outlook:</b> Add calendar → Subscribe from web → paste the link.</li>
          </ul>
          <p className="text-xs text-muted">Anyone with this link can see your calls. If it leaks, make a new one.</p>
          <div><Button size="sm" variant="ghost" onClick={reset} isLoading={busy}>Make a new link</Button></div>
        </div>
      )}
    </Dialog>
  );
}

/** Staff banner listing rooms, people and sign-ups that clash. Renders nothing when the schedule is clean. */
export function DoubleBookingBanner({ productionId }: { productionId: string }) {
  const { data } = useApi(() => getDoubleBookings(productionId).catch(() => []), [productionId]);
  const [open, setOpen] = useState(false);
  if (!data || data.length === 0) return null;
  return (
    <div className="mb-4 rounded-md p-3 text-sm" role="status"
      style={{ background: 'rgb(var(--c-251-191-36) / 0.14)', border: '1px solid rgb(var(--c-251-191-36) / 0.3)', color: 'var(--t-subtle-text-bright)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{data.length} double-booking{data.length === 1 ? '' : 's'} in the schedule</p>
        <button type="button" className="text-xs underline cursor-pointer" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Show details'}</button>
      </div>
      {open && (
        <ul className="mt-2 list-disc pl-5 space-y-1 text-xs">
          {data.map((w, i) => <li key={i}>{describeDoubleBooking(w)}</li>)}
        </ul>
      )}
    </div>
  );
}
