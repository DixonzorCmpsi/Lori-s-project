import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: ReactNode;
}

const variants = {
  primary: 'bg-accent text-background hover:bg-accent-hover',
  secondary: 'bg-surface-raised text-foreground hover:bg-border border border-border',
  destructive: 'bg-destructive text-white hover:bg-destructive/80',
  ghost: 'text-muted hover:text-foreground hover:bg-surface-raised',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 rounded-md font-medium
        min-h-[44px] min-w-[44px] transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
}
