'use client';

import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AlertOctagon,
  Map,
  Building2,
  TrendingUp,
  Brain,
  ShieldAlert,
  Settings,
  Users,
  Database,
  Sliders,
  Menu,
  X,
  LogOut,
  Bell,
} from 'lucide-react';

export interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const mainNav = [
    { name: 'Command Center', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Problems', href: '/dashboard/problems', icon: AlertOctagon },
    { name: 'Map Workspace', href: '/dashboard/map', icon: Map },
    { name: 'Departments', href: '/dashboard/departments', icon: Building2 },
    { name: 'Trends & Velocity', href: '/dashboard/trends', icon: TrendingUp },
    { name: 'Governance AI', href: '/dashboard/ai', icon: Brain },
    { name: 'Intervention Simulator', href: '/dashboard/simulation', icon: Sliders },
  ];

  const adminNav = [
    { name: 'System Administration', href: '/admin', icon: Settings },
    { name: 'DPI Connectors & APIs', href: '#dpi', icon: Database },
    { name: 'User & Role Access', href: '#users', icon: Users },
    { name: 'Audit & Compliance Logs', href: '#audit', icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink-primary flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 border-r border-ink-border bg-white shrink-0 sticky top-0 h-screen">
        {/* Brand */}
        <div className="h-16 px-6 border-b border-ink-border flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-ink-primary flex items-center justify-center text-white font-bold text-xs">
              AD
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-ink-primary">
                CivicPulse <span className="text-purple-600 font-mono text-xs">ADMIN</span>
              </span>
              <span className="text-[10px] text-ink-tertiary">Platform Controls</span>
            </div>
          </Link>
          <span className="w-2 h-2 rounded-full bg-purple-500" title="Superadmin Mode" />
        </div>

        {/* Navigation items */}
        <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {/* Main Section */}
          <div className="space-y-1">
            <div className="px-3 pb-2 text-[10px] uppercase tracking-wider font-semibold text-ink-tertiary">
              Operational Workspace
            </div>
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-civic-blueLight text-civic-blueDark font-semibold'
                      : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
                  }`}
                >
                  <Icon className="w-4 h-4 text-ink-tertiary" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Admin Dedicated Section */}
          <div className="space-y-1 pt-2 border-t border-ink-border/60">
            <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-purple-700 font-semibold">
              Administration & DPI
            </div>
            {adminNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-purple-50 text-purple-900 font-semibold'
                      : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
                  }`}
                >
                  <Icon className="w-4 h-4 text-purple-600" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Admin Footer */}
        <div className="p-4 border-t border-ink-border bg-canvas-subtle/40 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-ink-primary">System Administrator</div>
              <div className="text-[11px] text-ink-tertiary">DPI Infrastructure Lead</div>
            </div>
            <Link
              href="/login"
              className="text-ink-tertiary hover:text-ink-primary p-1 rounded hover:bg-canvas"
              title="Switch Role"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-ink-border px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-ink-secondary hover:bg-canvas-subtle"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-medium text-ink-secondary">
              System Console • Root Partition
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200">
              AUDIT ACTIVE
            </span>
            <button
              className="p-2 rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
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
                <span className="font-bold text-sm text-ink-primary">CivicPulse ADMIN</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded text-ink-tertiary hover:text-ink-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
                <div className="space-y-1">
                  {mainNav.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-ink-secondary hover:bg-canvas-subtle"
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Link>
                  ))}
                </div>
                <div className="space-y-1 pt-2 border-t border-ink-border">
                  {adminNav.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-purple-900 hover:bg-purple-50"
                    >
                      <item.icon className="w-4 h-4 text-purple-600" />
                      <span>{item.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
