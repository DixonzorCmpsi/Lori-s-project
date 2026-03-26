import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  isLoading?: boolean;
  children: ReactNode;
}

const variants = {
  primary: 'bg-accent text-background hover:bg-accent/90 shadow-accent/20',
  secondary: 'liquid-glass text-foreground hover:bg-white/5',
  destructive: 'bg-destructive text-white hover:bg-destructive/90',
  ghost: 'text-muted hover:text-foreground hover:bg-white/5',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading: loadingProp = false,
  isLoading: isLoadingProp = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const loading = loadingProp || isLoadingProp;
  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileHover={isDisabled ? {} : { scale: 1.02 }}
      whileTap={isDisabled ? {} : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        min-h-[44px] transition-colors duration-200
        focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none
        disabled:opacity-50 disabled:cursor-not-allowed
        shadow-sm active:shadow-inner
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={isDisabled}
      {...(props as any)}
    >
      {loading && (
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"
          aria-hidden="true"
        />
      )}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
