'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { SupportedLanguage, SUPPORTED_LANGUAGES, TranslationDictionary } from '../i18n/types';
import { en } from '../i18n/locales/en';
import { hi } from '../i18n/locales/hi';
import { or } from '../i18n/locales/or';

const STORAGE_KEY = 'civicpulse_lang';

const dictionaries: Record<SupportedLanguage, TranslationDictionary> = {
  en,
  hi,
  or,
};

export interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  speechCode: string;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function detectInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';

  try {
    const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
    if (saved && (saved === 'en' || saved === 'hi' || saved === 'or')) {
      return saved;
    }

    const browserLang = (navigator.language || (navigator as any).userLanguage || '').toLowerCase();
    if (browserLang.startsWith('hi')) return 'hi';
    if (browserLang.startsWith('or') || browserLang.startsWith('ory')) return 'or';
    if (browserLang.startsWith('en')) return 'en';
  } catch {
    // LocalStorage or navigator might throw in restricted environments
  }

  return 'en';
}

function resolveNestedKey(obj: any, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');

  useEffect(() => {
    const detected = detectInitialLanguage();
    setLanguageState(detected);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = detected;
    }
  }, []);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // In case localStorage is blocked
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, []);

  const speechCode = useMemo(() => {
    const opt = SUPPORTED_LANGUAGES.find((l) => l.code === language);
    return opt ? opt.speechCode : 'en-IN';
  }, [language]);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const activeDict = dictionaries[language] || dictionaries.en;
      let val = resolveNestedKey(activeDict, path);

      // Fallback to English if missing in target dictionary
      if (val === undefined) {
        val = resolveNestedKey(dictionaries.en, path);
      }

      if (val === undefined) {
        return path;
      }

      if (params) {
        return Object.entries(params).reduce((acc, [k, v]) => {
          return acc.replaceAll(`{${k}}`, String(v));
        }, val);
      }

      return val;
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        speechCode,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    // Non-throwing fallback for isolated components or static markup tests
    return {
      language: 'en',
      setLanguage: () => {},
      speechCode: 'en-IN',
      t: (path: string, params?: Record<string, string | number>) => {
        let val = resolveNestedKey(dictionaries.en, path) ?? path;
        if (params && typeof val === 'string') {
          return Object.entries(params).reduce((acc, [k, v]) => {
            return acc.replaceAll(`{${k}}`, String(v));
          }, val);
        }
        return val;
      },
    };
  }
  return context;
}
