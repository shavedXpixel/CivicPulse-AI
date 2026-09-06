import React, { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}: DialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full ${widthStyles} bg-white rounded-xl border border-ink-border shadow-elevated p-6 space-y-4`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {title && <h3 className="text-base font-semibold text-ink-primary">{title}</h3>}
            {description && <p className="text-xs text-ink-secondary">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-ink-tertiary hover:text-ink-primary p-1 rounded-md hover:bg-canvas-subtle transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm text-ink-secondary">{children}</div>

        {footer && <div className="pt-3 border-t border-ink-border flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
