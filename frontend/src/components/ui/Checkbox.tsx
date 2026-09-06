import React, { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = '', id, ...props }, ref) => {
    const checkboxId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex items-start gap-2.5">
        <input
          id={checkboxId}
          ref={ref}
          type="checkbox"
          className={`h-4 w-4 mt-0.5 rounded border-ink-border text-civic-blue focus:ring-civic-blue/30 focus:ring-offset-0 disabled:opacity-50 cursor-pointer ${className}`}
          {...props}
        />
        {(label || description) && (
          <div className="text-xs">
            {label && (
              <label htmlFor={checkboxId} className="font-medium text-ink-primary cursor-pointer select-none">
                {label}
              </label>
            )}
            {description && <p className="text-ink-secondary pt-0.5">{description}</p>}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
