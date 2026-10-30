import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverElevation?: boolean;
  glass?: boolean;
  variant?: 'default' | 'glass';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      hoverElevation = false,
      glass = false,
      variant = 'default',
      children,
      ...props
    },
    ref
  ) => {
    const isGlass = glass || variant === 'glass';

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border transition-colors duration-150 overflow-hidden',
          isGlass
            ? 'bg-[#0b1120]/85 backdrop-blur-md border-white/[0.08]'
            : 'bg-[#0b1120] border-white/[0.07]',
          hoverElevation && 'hover:border-white/[0.14]',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between px-5 py-4 border-b border-white/[0.06]',
          className
        )}
        {...props}
      >
        <div className="space-y-0.5 flex-1">{children}</div>
        {action && <div className="shrink-0 ml-4">{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('p-5', className)} {...props}>
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

export const CardContent = CardBody;

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between px-5 py-3.5 bg-white/[0.015] border-t border-white/[0.06] text-xs text-slate-400',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';
