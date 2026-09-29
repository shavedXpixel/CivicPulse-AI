'use client';

import React, { useState, forwardRef, InputHTMLAttributes } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  showToggle?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className = '',
      placeholder = '••••••••',
      disabled,
      showToggle = true,
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
      <div className="relative">
        <Lock className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={ref}
          type={isVisible ? 'text' : 'password'}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-9 ${showToggle ? 'pr-10' : 'pr-3'} py-2 text-xs rounded-sm border border-ink-border bg-canvas-subtle/50 focus:bg-canvas-card focus:outline-none focus:border-civic-terracotta transition-colors text-ink-primary font-mono ${className}`}
          {...props}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setIsVisible((prev) => !prev)}
            disabled={disabled}
            aria-label={isVisible ? 'Hide password' : 'Show password'}
            title={isVisible ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary transition-colors focus:outline-none disabled:opacity-50 flex items-center justify-center cursor-pointer"
          >
            {isVisible ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
