import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'destructive';
  onConfirm?: () => void;
  isLoading?: boolean;
}

export function Dialog({
  open, onClose, title, children,
  confirmLabel, confirmVariant = 'primary', onConfirm, isLoading,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="bg-surface border border-border rounded-lg p-6 max-w-md w-full
        text-foreground backdrop:bg-black/60 backdrop:backdrop-blur-sm
        fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0"
    >
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="mb-6 text-muted">{children}</div>
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        {onConfirm && (
          <Button variant={confirmVariant} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel || 'Confirm'}
          </Button>
        )}
      </div>
    </dialog>
  );
}
