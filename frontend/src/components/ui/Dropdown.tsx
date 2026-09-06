import React, { ReactNode, useState, useRef, useEffect } from 'react';

export interface DropdownItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  isDanger?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export function Dropdown({ trigger, items, align = 'right' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <div onClick={() => setIsOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-48 rounded-lg border border-ink-border bg-white shadow-elevated py-1 text-xs focus:outline-none animate-in fade-in duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                item.isDanger
                  ? 'text-civic-rose hover:bg-civic-roseLight'
                  : 'text-ink-primary hover:bg-canvas-subtle'
              }`}
            >
              {item.icon && <span className="text-ink-tertiary">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
