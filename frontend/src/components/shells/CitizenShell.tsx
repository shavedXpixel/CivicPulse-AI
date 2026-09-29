'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  PlusCircle,
  FileText,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../context/LanguageContext';
import { LanguageSelector } from '../ui/LanguageSelector';

export interface CitizenShellProps {
  children: ReactNode;
}

export function CitizenShell({ children }: CitizenShellProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { t } = useTranslation();

  const navItems = [
    { label: t('common.home'), href: '/citizen', icon: Home },
    { label: t('common.reportIssue'), href: '/citizen/report', icon: PlusCircle, isHighlight: true },
    { label: t('common.myReports'), href: '/citizen/issues', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink-primary flex flex-col pb-20 md:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-canvas-card/95 backdrop-blur-sm border-b border-ink-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link href="/citizen" className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-sm bg-ink-primary flex items-center justify-center text-canvas-card font-mono font-bold text-xs">
              CP
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-ink-primary">
                CivicPulse <span className="font-normal text-xs text-ink-secondary">{t('common.citizenPortal')}</span>
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden sm:flex items-center gap-1.5 text-xs font-medium" aria-label="Citizen Navigation">
            <Link
              href="/citizen"
              className={`px-3 py-1.5 rounded-sm transition-colors ${
                pathname === '/citizen'
                  ? 'bg-canvas-subtle text-ink-primary font-semibold border border-ink-border'
                  : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
              }`}
            >
              {t('common.home')}
            </Link>
            <Link
              href="/citizen/report"
              className={`px-3 py-1.5 rounded-sm transition-colors flex items-center gap-1.5 ${
                pathname === '/citizen/report'
                  ? 'bg-civic-terracotta text-white font-semibold shadow-none'
                  : 'text-civic-terracotta hover:bg-civic-blueLight font-semibold'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{t('common.reportIssue')}</span>
            </Link>
            <Link
              href="/citizen/issues"
              className={`px-3 py-1.5 rounded-sm transition-colors ${
                pathname === '/citizen/issues'
                  ? 'bg-canvas-subtle text-ink-primary font-semibold border border-ink-border'
                  : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
              }`}
            >
              {t('common.myReports')}
            </Link>
          </nav>

          {/* Language Selector & Switcher / Auth Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <LanguageSelector />
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-ink-secondary hidden sm:inline">
                  {user.email?.split('@')[0]}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-xs font-medium text-ink-tertiary hover:text-civic-rose flex items-center gap-1"
                  title={t('common.signOut')}
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden sm:inline">{t('common.signOut')}</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-xs font-semibold text-civic-terracotta hover:underline"
              >
                {t('common.signIn')}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-canvas-card/95 backdrop-blur-md border-t border-ink-border sm:hidden"
        aria-label="Mobile Citizen Navigation"
      >
        <div className="grid grid-cols-3 h-16 max-w-md mx-auto items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (item.isHighlight) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex flex-col items-center justify-center -mt-4"
                >
                  <div className="w-11 h-11 rounded-full bg-civic-terracotta text-white flex items-center justify-center shadow-none hover:bg-civic-terracottaDark transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold text-civic-terracotta mt-1">
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 transition-colors ${
                  isActive ? 'text-civic-terracotta font-semibold' : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Footer */}
      <footer className="hidden sm:block py-6 border-t border-ink-border bg-canvas-card text-xs text-ink-tertiary">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`hover:text-ink-primary transition-colors ${
                  pathname === item.href ? 'text-civic-terracotta font-semibold' : 'text-ink-secondary'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <span className="font-mono text-[11px]">{t('common.dpdpFooter')}</span>
        </div>
      </footer>
    </div>
  );
}
