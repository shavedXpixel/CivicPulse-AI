'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  AlertTriangle,
  History,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface OfficerShellProps {
  children: ReactNode;
}

export function OfficerShell({ children }: OfficerShellProps) {
  const pathname = usePathname();
  const { isDemoMode } = useAuth();

  const navigation = [
    { name: 'My Work / Officer Queue', href: '/officer', icon: Briefcase, badge: '3 Active' },
    {
      name: 'Assigned Problems',
      href: isDemoMode ? '/dashboard/problems/PRB-2026-0819' : '/officer',
      icon: AlertTriangle,
      badge: isDemoMode ? 'Golden Demo' : undefined,
    },
    { name: 'Priority Problems', href: '/dashboard/problems', icon: History },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink-primary flex flex-col pb-16 md:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-ink-border">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/officer" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-civic-blue flex items-center justify-center text-white font-bold text-xs">
              FO
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-ink-primary">
                CivicPulse <span className="text-xs font-semibold text-civic-blue">Field Ops</span>
              </span>
              <span className="text-[10px] text-ink-tertiary">
                WATCO Water Division • Ward 18 Nayapalli
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-ink-secondary">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-1.5 transition-colors ${
                    isActive ? 'text-civic-blue font-semibold' : 'hover:text-ink-primary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-civic-blueLight text-civic-blueDark">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-ink-secondary">
              <User className="w-3.5 h-3.5 text-ink-tertiary" />
              <span>Officer Rajesh K.</span>
            </div>
            <Link
              href="/login"
              className="text-xs font-medium text-ink-tertiary hover:text-ink-primary p-1 rounded hover:bg-canvas"
              title="Switch Role"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Field Ops Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-ink-border md:hidden"
        aria-label="Mobile Officer Navigation"
      >
        <div className="grid grid-cols-3 h-16 max-w-md mx-auto items-center">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1 transition-colors ${
                  isActive ? 'text-civic-blue font-semibold' : 'text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-[10px]">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
