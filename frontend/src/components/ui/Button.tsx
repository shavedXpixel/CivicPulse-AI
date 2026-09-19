import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-civic-terracotta focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none select-none';

    const sizeStyles = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-xs sm:text-sm px-3.5 py-2 gap-2',
      lg: 'text-sm sm:text-base px-4.5 py-2.5 gap-2.5',
    }[size];

    const variantStyles = {
      primary: 'bg-civic-terracotta text-white hover:bg-civic-terracottaDark shadow-none',
      secondary: 'bg-canvas-card text-ink-primary hover:bg-canvas-subtle border border-ink-border shadow-none',
      outline: 'bg-transparent text-ink-primary hover:bg-canvas-subtle border border-ink-border shadow-none',
      ghost: 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle',
      danger: 'bg-civic-rose text-white hover:bg-red-800 shadow-none',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
