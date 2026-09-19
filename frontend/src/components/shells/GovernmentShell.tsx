'use client';

import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  AlertOctagon,
  Map,
  Building2,
  TrendingUp,
  Brain,
  Search,
  Menu,
  X,
  Bell,
  LogOut,
  Sliders,
  ShieldCheck,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api-client';

export interface GovernmentShellProps {
  children: ReactNode;
  problemCount?: number;
}

export function GovernmentShell({ children, problemCount }: GovernmentShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [resolvedCount, setResolvedCount] = useState<number | null>(null);

  React.useEffect(() => {
    let active = true;
    if (problemCount === undefined) {
      apiClient
        .get<{ data: any[] }>('/api/v1/problems')
        .then((res) => {
          if (active && res?.data && Array.isArray(res.data)) {
            setResolvedCount(res.data.length);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [problemCount]);

  const effectiveProblemCount =
    problemCount !== undefined
      ? problemCount
      : resolvedCount !== null
      ? resolvedCount
      : 0;

  const navigation = [
    { name: 'Command Center', href: '/dashboard', icon: LayoutDashboard },
    {
      name: 'Problems',
      href: '/dashboard/problems',
      icon: AlertOctagon,
      badge: String(effectiveProblemCount),
    },
    { name: 'Map Workspace', href: '/dashboard/map', icon: Map },
    { name: 'Departments', href: '/dashboard/departments', icon: Building2 },
    { name: 'Trends & Velocity', href: '/dashboard/trends', icon: TrendingUp },
    { name: 'Governance AI', href: '/dashboard/ai', icon: Brain, isAI: true },
    { name: 'Intervention Simulator', href: '/dashboard/simulation', icon: Sliders, badge: 'Advisory' },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink-primary flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 border-r border-ink-border bg-canvas-card shrink-0 sticky top-0 h-screen">
        {/* Brand */}
        <div className="h-14 px-6 border-b border-ink-border flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-ink-primary flex items-center justify-center text-canvas-card font-mono font-bold text-xs">
              CP
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-ink-primary">
                CivicPulse <span className="text-civic-terracotta font-mono text-xs">GOV</span>
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">Operations Command</span>
            </div>
          </Link>
          <span className="w-2 h-2 rounded-full bg-civic-emerald" title="Live Connection" />
        </div>

        {/* Navigation items */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] uppercase tracking-widest font-mono font-semibold text-ink-tertiary">
            Intelligence Layer
          </div>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-civic-blueLight text-civic-blueDark font-semibold border-l-2 border-civic-terracotta'
                    : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-civic-terracotta' : 'text-ink-tertiary'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.2 rounded-sm text-[10px] font-mono font-bold bg-canvas-subtle border border-ink-border text-ink-primary">
                    {item.badge}
                  </span>
                )}
                {item.isAI && (
                  <span className="px-1.5 py-0.2 rounded-sm text-[9px] font-mono font-bold bg-civic-blueLight text-civic-blueDark">
                    ANALYTICS
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* User / Session Footer */}
        <div className="p-4 border-t border-ink-border bg-canvas-subtle/40 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="min-w-0 pr-2">
              <div className="font-semibold text-ink-primary truncate">
                {userProfile?.display_name || user?.displayName || user?.email || 'Operations Officer'}
              </div>
              <div className="text-[10px] font-mono text-ink-tertiary truncate flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-civic-terracotta shrink-0" />
                <span>
                  {userProfile?.role === 'ADMIN'
                    ? 'Citywide Admin • Bhubaneswar'
                    : userProfile?.role === 'DEPARTMENT_OFFICER'
                    ? `${userProfile.department_id || 'WATCO'} Supervisor • Bhubaneswar`
                    : user?.email || 'Operations Command'}
                </span>
              </div>
            </div>
            <button
              onClick={async () => {
                await signOut();
                router.push('/login');
              }}
              className="text-ink-tertiary hover:text-ink-primary p-1 rounded hover:bg-canvas transition-colors shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-14 bg-canvas-card/95 backdrop-blur-sm border-b border-ink-border px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-ink-secondary hover:bg-canvas-subtle"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search Bar */}
            <div className="relative w-48 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-tertiary" />
              <input
                type="text"
                placeholder="Search wards, signals, problems..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-ink-border bg-canvas focus:bg-white focus:outline-none focus:ring-2 focus:ring-civic-blue/30 focus:border-civic-blue transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono bg-canvas-subtle border border-ink-border text-ink-secondary">
              <span className="w-2 h-2 rounded-full bg-civic-blue" />
              <span>REAL_MODE: Live Operations Command</span>
            </div>

            <button
              className="relative p-2 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-civic-rose" />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="relative w-64 max-w-full bg-white border-r border-ink-border h-full flex flex-col z-10 shadow-elevated">
              <div className="h-16 px-5 border-b border-ink-border flex items-center justify-between">
                <span className="font-bold text-sm text-ink-primary">CivicPulse GOV</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded text-ink-tertiary hover:text-ink-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${
                        isActive
                          ? 'bg-civic-blueLight text-civic-blueDark font-semibold'
                          : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-civic-roseLight text-civic-rose">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              <div className="p-4 border-t border-ink-border flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-ink-primary truncate">
                    {userProfile?.display_name || user?.displayName || user?.email || 'Officer'}
                  </div>
                  <div className="text-[10px] text-ink-tertiary truncate">
                    {userProfile?.role || 'Government'}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await signOut();
                    router.push('/login');
                  }}
                  className="text-xs font-medium text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 p-1 rounded hover:bg-canvas-subtle transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
