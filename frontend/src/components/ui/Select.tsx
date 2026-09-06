import React, { forwardRef, SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      options = [],
      children,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-ink-secondary">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            className={`w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-9 text-sm text-ink-primary transition-colors focus:outline-none focus:ring-2 focus:ring-civic-blue/30 focus:border-civic-blue disabled:opacity-50 disabled:bg-canvas-subtle cursor-pointer ${
              error ? 'border-civic-rose focus:ring-civic-rose/30 focus:border-civic-rose' : 'border-ink-border'
            } ${className}`}
            {...props}
          >
            {options.length > 0
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute right-3 text-ink-tertiary pointer-events-none flex items-center">
            <ChevronDown className="w-4 h-4" />
          </div>
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

Select.displayName = 'Select';
