import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const variants = {
  default: 'bg-surface-raised text-muted',
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
  destructive: 'bg-destructive/20 text-destructive',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
