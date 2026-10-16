import { useId, type SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

/** Native select styled like Input so forms line up. */
export function Select({ label, error, id, className = '', children, ...props }: SelectProps) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          w-full px-3 py-2 rounded-md bg-surface-raised border border-border text-foreground
          focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50
          ${error ? 'border-destructive ring-1 ring-destructive' : ''} ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
