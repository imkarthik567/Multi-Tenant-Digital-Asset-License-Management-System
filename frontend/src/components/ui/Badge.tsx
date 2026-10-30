import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
  default: {
    badge: 'bg-white/[0.04] text-slate-300 border border-white/[0.08]',
    dot: 'bg-slate-400',
  },
  success: {
    badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    dot: 'bg-amber-400',
  },
  danger: {
    badge: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    dot: 'bg-rose-400',
  },
  info: {
    badge: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20',
    dot: 'bg-indigo-400',
  },
  outline: {
    badge: 'bg-transparent text-slate-400 border border-white/[0.1]',
    dot: 'bg-slate-500',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-2 py-0.5 gap-1.5 min-h-[20px]',
  md: 'text-xs px-2.5 py-0.5 gap-1.5 min-h-[22px]',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      dot = false,
      children,
      ...props
    },
    ref
  ) => {
    const { badge: badgeStyle, dot: dotStyle } = variantStyles[variant];

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center font-medium rounded-md select-none leading-none transition-colors',
          badgeStyle,
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotStyle)}
            aria-hidden="true"
          />
        )}
        <span>{children}</span>
      </span>
    );
  }
);

Badge.displayName = 'Badge';
