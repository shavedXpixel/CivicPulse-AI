import React, { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  prefixIcon?: ReactNode;
  suffixIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      prefixIcon,
      suffixIcon,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[11px] font-mono uppercase tracking-wider text-ink-secondary">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixIcon && (
            <div className="absolute left-3 text-ink-tertiary pointer-events-none flex items-center">
              {prefixIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-md border bg-canvas-card px-3 py-2 text-xs sm:text-sm text-ink-primary placeholder:text-ink-tertiary transition-colors focus:outline-none focus:ring-1 focus:ring-civic-terracotta focus:border-civic-terracotta disabled:opacity-50 disabled:bg-canvas-subtle ${
              prefixIcon ? 'pl-9' : ''
            } ${suffixIcon ? 'pr-9' : ''} ${
              error ? 'border-civic-rose focus:ring-civic-rose/30 focus:border-civic-rose' : 'border-ink-border'
            } ${className}`}
            {...props}
          />
          {suffixIcon && (
            <div className="absolute right-3 text-ink-tertiary flex items-center">
              {suffixIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-civic-rose">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-ink-tertiary">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
