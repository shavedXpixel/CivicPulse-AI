'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Briefcase,
  AlertTriangle,
  History,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface OfficerShellProps {
  children: ReactNode;
}

export function OfficerShell({ children }: OfficerShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile, signOut } = useAuth();

  interface NavItem {
    name: string;
    href: string;
    icon: any;
    badge?: string;
  }

  const navigation: NavItem[] = [
    {
      name: 'My Work / Officer Queue',
      href: '/officer',
      icon: Briefcase,
    },
    {
      name: 'Assigned Problems',
      href: '/officer',
      icon: AlertTriangle,
    },
    { name: 'Priority Problems', href: '/dashboard/problems', icon: History },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink-primary flex flex-col pb-16 md:pb-0">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-canvas-card border-b border-ink-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/officer" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-ink-primary flex items-center justify-center text-canvas-card font-mono font-bold text-xs">
              FO
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-ink-primary">
                CivicPulse <span className="text-xs font-mono font-semibold text-civic-terracotta">Field Ops</span>
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
                {userProfile?.department_id || 'WATCO'} Field Division • Bhubaneswar
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
                    isActive ? 'text-civic-terracotta font-semibold' : 'hover:text-ink-primary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-canvas-subtle border border-ink-border text-ink-primary">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-ink-secondary">
              <ShieldCheck className="w-3.5 h-3.5 text-civic-terracotta" />
              <span className="font-semibold text-ink-primary">
                {userProfile?.display_name || user?.displayName || user?.email || 'Field Officer'}
              </span>
            </div>
            <button
              onClick={async () => {
                await signOut();
                router.push('/login');
              }}
              className="text-xs font-medium text-ink-tertiary hover:text-ink-primary p-1 rounded hover:bg-canvas transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Field Ops Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-canvas-card border-t border-ink-border md:hidden"
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
                  isActive ? 'text-civic-terracotta font-semibold' : 'text-ink-secondary hover:text-ink-primary'
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
