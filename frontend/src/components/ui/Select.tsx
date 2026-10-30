import React, { forwardRef, useId } from 'react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: SelectOption[];
  selectSize?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'text-xs h-8 pl-2.5 pr-8 rounded-lg',
  md: 'text-xs h-9 pl-3 pr-9 rounded-lg',
  lg: 'text-sm h-11 pl-3.5 pr-10 rounded-lg',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      id,
      label,
      helperText,
      error,
      options,
      selectSize = 'md',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const hasError = Boolean(error);

    return (
      <div className={cn('flex flex-col gap-1.5', label ? 'w-full' : 'w-full sm:w-auto')}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-medium text-slate-400 select-none"
          >
            {label}
          </label>
        )}

        <div className="relative inline-flex items-center w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={hasError ? 'true' : undefined}
            aria-describedby={
              hasError
                ? `${selectId}-error`
                : helperText
                ? `${selectId}-helper`
                : undefined
            }
            className={cn(
              'w-full appearance-none cursor-pointer bg-[#0b1120] text-slate-100 border transition-colors',
              'focus:outline-none focus:border-indigo-500/70',
              hasError
                ? 'border-rose-500/70 focus:border-rose-500'
                : 'border-white/[0.08] hover:border-white/[0.15]',
              disabled && 'opacity-50 cursor-not-allowed bg-slate-900/50',
              sizeStyles[selectSize],
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="bg-[#0b1120] text-slate-100 py-1"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute right-2.5 pointer-events-none flex items-center text-slate-400">
            <svg
              className="w-3.5 h-3.5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>

        {hasError && (
          <p id={`${selectId}-error`} className="text-xs text-rose-400 font-medium">
            {error}
          </p>
        )}

        {!hasError && helperText && (
          <p id={`${selectId}-helper`} className="text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
