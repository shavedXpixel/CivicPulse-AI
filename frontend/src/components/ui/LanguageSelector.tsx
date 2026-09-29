'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../i18n/types';

interface LanguageSelectorProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export function LanguageSelector({ className = '', variant = 'compact' }: LanguageSelectorProps) {
  const { language, setLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicked outside
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentOption = SUPPORTED_LANGUAGES.find((opt) => opt.code === language) ?? {
    code: 'en' as const,
    label: 'English',
    nativeLabel: 'English',
    speechCode: 'en-IN',
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select language"
        className="flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary px-2.5 py-1 rounded-sm border border-ink-border bg-canvas-card transition-colors hover:border-ink-secondary focus:outline-none focus:ring-1 focus:ring-civic-terracotta"
      >
        <Globe className="w-3.5 h-3.5 text-civic-terracotta shrink-0" />
        <span className="font-medium">
          {variant === 'full'
            ? `${currentOption.nativeLabel} (${currentOption.label})`
            : currentOption.nativeLabel}
        </span>
        <ChevronDown className={`w-3 h-3 text-ink-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Language options"
          className="absolute right-0 mt-1 w-36 rounded-sm bg-canvas-card border border-ink-border shadow-elevated z-50 py-1 text-xs focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {SUPPORTED_LANGUAGES.map((option) => {
            const isSelected = option.code === language;
            return (
              <button
                key={option.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setLanguage(option.code as SupportedLanguage);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                  isSelected
                    ? 'bg-canvas-subtle text-civic-terracotta font-semibold'
                    : 'text-ink-primary hover:bg-canvas-subtle'
                }`}
              >
                <div className="flex flex-col">
                  <span>{option.nativeLabel}</span>
                  <span className="text-[10px] text-ink-tertiary font-normal">{option.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-civic-terracotta shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
