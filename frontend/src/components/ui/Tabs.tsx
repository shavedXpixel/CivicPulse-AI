import React, { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: ReactNode;
  badge?: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={`border-b border-ink-border ${className}`}>
      <nav className="flex space-x-6" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors cursor-pointer select-none ${
                isActive
                  ? 'border-civic-blue text-civic-blue font-semibold'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary hover:border-ink-border'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-civic-blueLight text-civic-blueDark'
                      : 'bg-canvas-subtle text-ink-tertiary'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
