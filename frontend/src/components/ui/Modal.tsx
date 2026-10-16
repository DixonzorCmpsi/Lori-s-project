import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Buttons shown at the right of the header (download, open in a tab, ...). */
  actions?: ReactNode;
  children: ReactNode;
}

/** A large dialog for reading things: nearly full screen, scrolls inside, closes on Escape or the backdrop. */
export function Modal({ open, onClose, title, subtitle, actions, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={e => { if (e.target === ref.current) onClose(); }}
      aria-label={title}
      className="m-auto p-0 rounded-xl border border-border bg-surface text-foreground w-[min(1100px,96vw)] h-[min(88vh,900px)] max-w-none max-h-none backdrop:bg-black/60 backdrop:backdrop-blur-sm overflow-hidden"
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">{title}</h2>
            {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 rounded-lg cursor-pointer text-muted hover:text-foreground hover:bg-surface-raised"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">{children}</div>
      </div>
    </dialog>
  );
}
