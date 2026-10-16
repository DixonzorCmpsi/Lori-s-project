import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTourBusy } from '@/hooks/tourSignal';
import { useProduction } from '@/components/theater/BackstageLayout';
import { guideFor, type GuideId } from '@/content/guides';

const STORAGE_KEY = 'dcb-guides-hidden';

function readHidden(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function writeHidden(value: Record<string, boolean>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* storage is optional */ }
}

/** Forget every dismissed guide so they all show again (used by the Help page). */
export function resetGuides() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event('guides-reset'));
}

const ROLE_LABEL: Record<string, string> = { director: 'a Director', staff: 'Staff', cast: 'Cast' };

/**
 * "How this page works": what the page is for, what you can do here, and what you can't.
 * Open the first time, then remembered as closed once dismissed. Always one click away.
 */
export function PageGuide({ page, startHidden = false }: { page: GuideId; startHidden?: boolean }) {
  const { userRole } = useProduction();
  const key = `${page}:${userRole ?? 'cast'}`;
  const [hidden, setHidden] = useState<boolean>(() => {
    const saved = readHidden()[key];
    return saved === undefined ? startHidden : !!saved;
  });
  // While a tour is running (or about to start) the box folds to its small link so the two never overlap
  const tourBusy = useTourBusy();
  const guide = guideFor(page, userRole);
  if (!guide) return null;

  function toggle(next: boolean) {
    setHidden(next);
    const all = readHidden();
    all[key] = next;
    writeHidden(all);
  }

  const collapsed = hidden || tourBusy;

  const link = (
      <button
        type="button"
        onClick={() => toggle(false)}
        className="mb-4 inline-flex items-center gap-1.5 text-xs cursor-pointer"
        style={{ color: 'var(--t-subtle-text)' }}
      >
        <span aria-hidden="true" className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold" style={{ border: '1px solid currentColor' }}>?</span>
        How this page works
      </button>
  );

  const panel = (
    <aside
      aria-label="How this page works"
      className="mb-5 rounded-lg p-4"
      style={{ background: 'var(--t-tab-active-bg)', border: '1px solid var(--t-section-border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest font-bold" style={{ color: 'var(--t-tab-active-text)' }}>
            How this page works{userRole ? ` · you are signed in as ${ROLE_LABEL[userRole] ?? 'a member'}` : ''}
          </p>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--t-subtle-text-bright)' }}>{guide.what}</p>
        </div>
        <button
          type="button"
          onClick={() => toggle(true)}
          className="text-xs underline cursor-pointer shrink-0"
          style={{ color: 'var(--t-subtle-text)' }}
        >
          Hide
        </button>
      </div>

      <div className={`mt-3 grid gap-4 ${guide.cannot && guide.cannot.length > 0 ? 'md:grid-cols-2' : ''}`}>
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--t-subtle-text-bright)' }}>You can</p>
          <ul className="space-y-1">
            {guide.can.map(item => (
              <li key={item} className="flex gap-2 text-sm" style={{ color: 'var(--t-subtle-text-bright)' }}>
                <span aria-hidden="true" style={{ color: 'rgb(var(--c-150-220-150) / 0.95)' }}>✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        {guide.cannot && guide.cannot.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--t-subtle-text-bright)' }}>You can’t</p>
            <ul className="space-y-1">
              {guide.cannot.map(item => (
                <li key={item} className="flex gap-2 text-sm" style={{ color: 'var(--t-subtle-text)' }}>
                  <span aria-hidden="true">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {guide.tip && (
        <p className="mt-3 text-xs" style={{ color: 'var(--t-subtle-text)' }}><b>Tip:</b> {guide.tip}</p>
      )}
    </aside>
  );

  return (
    <AnimatePresence initial={false} mode="wait">
      {collapsed ? (
        <motion.div key="link" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {link}
        </motion.div>
      ) : (
        <motion.div
          key="panel"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{ overflow: 'hidden' }}
        >
          {panel}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
