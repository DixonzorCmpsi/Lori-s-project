import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  maxLength?: number;
}

export function Textarea({ label, error, maxLength, id, value, className = '', ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const currentLength = typeof value === 'string' ? value.length : 0;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        value={value}
        className={`
          w-full px-3 py-2 rounded-md bg-surface-raised border border-border
          text-foreground placeholder-muted resize-y min-h-[80px]
          focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
          ${error ? 'border-destructive ring-1 ring-destructive' : ''}
          ${className}
        `}
        {...props}
      />
      <div className="flex justify-between">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {maxLength && (
          <p className={`text-xs ml-auto ${currentLength > maxLength ? 'text-destructive' : 'text-muted'}`}>
            {currentLength}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
}
