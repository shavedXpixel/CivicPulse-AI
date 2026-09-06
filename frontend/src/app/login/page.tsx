import React from 'react';
import Link from 'next/link';
import { User, ShieldCheck, Briefcase, Settings, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const roles = [
    {
      role: 'Citizen',
      tagline: 'Public reporting, audio intake, instant plain-language comprehension.',
      href: '/citizen',
      icon: User,
      badge: 'Public Portal',
      badgeColor: 'bg-civic-blueLight text-civic-blueDark',
    },
    {
      role: 'Government Official',
      tagline: 'Citywide command center, priority queues, impact maps, and Governance AI.',
      href: '/dashboard',
      icon: ShieldCheck,
      badge: 'Operations Command',
      badgeColor: 'bg-civic-emeraldLight text-emerald-800',
    },
    {
      role: 'Field Officer',
      tagline: 'Assigned emergency work orders, location navigation, and resolution proof.',
      href: '/officer',
      icon: Briefcase,
      badge: 'Field Ops',
      badgeColor: 'bg-civic-amberLight text-amber-900',
    },
    {
      role: 'System Administrator',
      tagline: 'DPI connector config, ward partitions, DPDP compliance audit logs.',
      href: '/admin',
      icon: Settings,
      badge: 'Platform Root',
      badgeColor: 'bg-purple-50 text-purple-900',
    },
  ];

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-ink-primary flex items-center justify-center text-white font-bold text-sm">
            CP
          </div>
          <span className="font-bold text-xl tracking-tight text-ink-primary">
            CivicPulse <span className="text-civic-blue font-mono text-xs">AI</span>
          </span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-ink-primary">
          Select Demo Persona
        </h2>
        <p className="text-xs text-ink-secondary">
          CivicPulse AI adapts its visual system to the user&apos;s governance role. Choose an application shell to explore.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <div className="space-y-3">
          {roles.map((r) => {
            const Icon = r.icon;
            return (
              <Link
                key={r.role}
                href={r.href}
                className="group flex items-start gap-4 p-5 rounded-xl border border-ink-border bg-white shadow-card hover:border-civic-blue hover:shadow-elevated transition-all"
              >
                <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border group-hover:bg-civic-blueLight/40 group-hover:border-civic-blue/30 transition-colors">
                  <Icon className="w-5 h-5 text-civic-blue" />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-ink-primary group-hover:text-civic-blue transition-colors">
                        {r.role}
                      </span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-mono font-medium ${r.badgeColor}`}>
                        {r.badge}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-ink-tertiary group-hover:text-civic-blue group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-xs text-ink-secondary leading-relaxed">
                    {r.tagline}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-xs font-medium text-ink-secondary hover:text-ink-primary underline underline-offset-4"
          >
            ← Back to Editorial Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
