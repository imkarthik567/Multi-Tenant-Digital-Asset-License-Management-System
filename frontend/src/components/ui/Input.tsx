import React, { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  rightAction?: React.ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
  showPasswordToggle?: boolean;
}

const sizeStyles = {
  sm: 'text-xs h-8 px-3 rounded-lg',
  md: 'text-xs h-9 px-3.5 rounded-lg',
  lg: 'text-sm h-11 px-4 rounded-lg',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      id,
      label,
      helperText,
      error,
      iconLeft,
      iconRight,
      rightAction,
      inputSize = 'md',
      showPasswordToggle,
      disabled,
      type,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const hasError = Boolean(error);

    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const isPasswordField = type === 'password';
    const canTogglePassword = isPasswordField && (showPasswordToggle ?? true);

    const effectiveType = canTogglePassword
      ? isPasswordVisible
        ? 'text'
        : 'password'
      : type;

    const passwordToggleNode =
      canTogglePassword && !rightAction && !iconRight ? (
        <button
          type="button"
          onClick={() => setIsPasswordVisible((prev) => !prev)}
          className="p-1 -mr-1 text-slate-500 hover:text-slate-200 focus:outline-none rounded-md transition-colors cursor-pointer"
          title={isPasswordVisible ? 'Hide password' : 'Show password'}
          aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {isPasswordVisible ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      ) : null;

    const rightSlot = rightAction || iconRight || passwordToggleNode;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-slate-300 select-none"
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {iconLeft && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-500">
              {iconLeft}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={hasError ? 'true' : undefined}
            aria-describedby={
              hasError
                ? `${inputId}-error`
                : helperText
                ? `${inputId}-helper`
                : undefined
            }
            className={cn(
              'w-full bg-[#030712] text-slate-100 placeholder:text-slate-500 border transition-colors duration-150',
              'focus:outline-none focus:ring-1',
              hasError
                ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/30'
                : 'border-white/[0.08] hover:border-white/[0.15] focus:border-indigo-500 focus:ring-indigo-500/30',
              disabled && 'opacity-50 cursor-not-allowed bg-slate-900/50',
              sizeStyles[inputSize],
              iconLeft ? 'pl-9' : '',
              rightSlot ? 'pr-9' : '',
              className
            )}
            type={effectiveType}
            {...props}
          />

          {rightSlot && (
            <div className="absolute right-2.5 flex items-center text-slate-500">
              {rightSlot}
            </div>
          )}
        </div>

        {hasError && (
          <p id={`${inputId}-error`} className="text-xs text-rose-400 font-medium">
            {error}
          </p>
        )}

        {!hasError && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
