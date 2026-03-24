import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-3 py-2 rounded-md bg-surface-raised border border-border
          text-foreground placeholder-muted
          focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
          disabled:opacity-50
          ${error ? 'border-destructive ring-1 ring-destructive' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
