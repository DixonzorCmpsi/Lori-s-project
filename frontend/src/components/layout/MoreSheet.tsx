import { AnimatePresence, motion } from 'framer-motion';
import type { ShellNavItem } from './AppShell';

/** Phone-only sheet listing every page, opened from the "More" tab. Uses theme tokens so it fits both styles. */
export function MoreSheet({ open, onClose, items, isActive, onNavigate, extra }: {
  open: boolean;
  onClose: () => void;
  items: ShellNavItem[];
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
  extra?: { label: string; onClick: () => void }[];
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[80]"
            style={{ background: 'var(--t-drawer-backdrop)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label="All pages"
            className="fixed inset-x-0 bottom-0 z-[85] rounded-t-2xl p-4 max-h-[75vh] overflow-y-auto"
            style={{
              background: 'var(--t-surface)',
              borderTop: '1px solid var(--t-border)',
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
              color: 'var(--t-foreground)',
            }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--t-border)' }} />
            <div className="grid grid-cols-3 gap-2">
              {items.map(item => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => { onClose(); onNavigate(item.path); }}
                    aria-current={active ? 'page' : undefined}
                    className="flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-medium cursor-pointer"
                    style={{
                      background: active ? 'var(--t-nav-active-bg)' : 'var(--t-subtle-bg)',
                      color: active ? 'var(--t-nav-active-text)' : 'var(--t-foreground)',
                    }}
                  >
                    <span className="text-base" aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
            {extra && extra.length > 0 && (
              <div className="mt-3 grid gap-1">
                {extra.map(e => (
                  <button key={e.label} onClick={() => { onClose(); e.onClick(); }}
                    className="rounded-lg px-3 py-2.5 text-sm text-left cursor-pointer"
                    style={{ color: 'var(--t-nav-inactive-text)' }}>
                    {e.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
