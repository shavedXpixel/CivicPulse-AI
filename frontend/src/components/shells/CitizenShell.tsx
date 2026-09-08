'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  PlusCircle,
  FileText,
  Bell,
  User,
  Globe,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface CitizenShellProps {
  children: ReactNode;
}

export function CitizenShell({ children }: CitizenShellProps) {
  const pathname = usePathname();
  const { user, isDemoMode, signOut } = useAuth();

  const navItems = [
    { label: 'Home', href: '/citizen', icon: Home },
    { label: 'Report', href: '/citizen/report', icon: PlusCircle, isHighlight: true },
    { label: 'My Reports', href: '/citizen/issues', icon: FileText },
    { label: 'Notifications', href: '#notifications', icon: Bell },
    { label: 'Profile', href: '#profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink-primary flex flex-col pb-20 md:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-ink-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/citizen" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-ink-primary flex items-center justify-center text-white font-bold text-xs">
              CP
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-ink-primary">
                CivicPulse <span className="font-normal text-xs text-ink-secondary">Citizen</span>
              </span>
            </div>
          </Link>

          {/* Language Selector & Switcher / Auth Actions */}
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 text-xs text-ink-secondary hover:text-ink-primary px-2.5 py-1 rounded-md border border-ink-border bg-canvas-subtle">
              <Globe className="w-3.5 h-3.5 text-civic-blue" />
              <span>English / ଓଡ଼ିଆ / हिंदी</span>
            </button>
            {isDemoMode ? (
              <Link
                href="/login"
                className="text-xs font-medium text-ink-tertiary hover:text-ink-primary"
              >
                Switch Role
              </Link>
            ) : user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-ink-secondary hidden sm:inline">
                  {user.email?.split('@')[0]}
                </span>
                <button
                  onClick={() => signOut()}
                  className="text-xs font-medium text-ink-tertiary hover:text-civic-rose flex items-center gap-1"
                  title="Sign Out"
                >
                  <LogOut className="w-3 h-3" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-xs font-semibold text-civic-blue hover:underline"
              >
                Sign In
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
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-ink-border md:hidden"
        aria-label="Mobile Citizen Navigation"
      >
        <div className="grid grid-cols-5 h-16 max-w-md mx-auto items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (item.isHighlight) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex flex-col items-center justify-center -mt-5"
                >
                  <div className="w-12 h-12 rounded-full bg-civic-blue text-white flex items-center justify-center shadow-elevated hover:bg-civic-blueDark transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-semibold text-civic-blue mt-1">
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
                  isActive ? 'text-civic-blue font-semibold' : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Navigation Links */}
      <footer className="hidden md:block py-6 border-t border-ink-border bg-white text-xs text-ink-tertiary">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`hover:text-ink-primary transition-colors ${
                  pathname === item.href ? 'text-civic-blue font-semibold' : 'text-ink-secondary'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <span>DPDP Act Compliant • PII Redacted</span>
        </div>
      </footer>
    </div>
  );
}
