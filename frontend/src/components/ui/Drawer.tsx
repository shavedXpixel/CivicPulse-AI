import React, { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  position?: 'right' | 'bottom';
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  position = 'right',
}: DrawerProps) {
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      {position === 'right' ? (
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <div className="w-screen max-w-md bg-white border-l border-ink-border shadow-elevated flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-ink-border">
              <h3 className="text-base font-semibold text-ink-primary">{title}</h3>
              <button
                onClick={onClose}
                className="text-ink-tertiary hover:text-ink-primary p-1 rounded-md hover:bg-canvas-subtle transition-colors"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 max-h-[85vh] bg-white border-t border-ink-border rounded-t-2xl shadow-elevated flex flex-col">
          <div className="w-12 h-1 bg-ink-border rounded-full mx-auto mt-3" />
          <div className="flex items-center justify-between p-5 border-b border-ink-border">
            <h3 className="text-base font-semibold text-ink-primary">{title}</h3>
            <button
              onClick={onClose}
              className="text-ink-tertiary hover:text-ink-primary p-1 rounded-md hover:bg-canvas-subtle transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </div>
      )}
    </div>
  );
}
