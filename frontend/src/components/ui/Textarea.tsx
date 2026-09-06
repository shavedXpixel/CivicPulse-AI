import React, { forwardRef, TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  charCount?: number;
  maxCharCount?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      charCount,
      maxCharCount,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={inputId} className="block text-xs font-medium text-ink-secondary">
              {label}
            </label>
          )}
          {maxCharCount !== undefined && charCount !== undefined && (
            <span className="text-[11px] font-mono text-ink-tertiary">
              {charCount}/{maxCharCount}
            </span>
          )}
        </div>
        <textarea
          id={inputId}
          ref={ref}
          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary transition-colors focus:outline-none focus:ring-2 focus:ring-civic-blue/30 focus:border-civic-blue disabled:opacity-50 disabled:bg-canvas-subtle resize-y min-h-[100px] ${
            error ? 'border-civic-rose focus:ring-civic-rose/30 focus:border-civic-rose' : 'border-ink-border'
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-xs text-civic-rose">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-ink-tertiary">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
