import React, { useState } from 'react';
import { ZoomIn, ZoomOut, Compass, MapPin } from 'lucide-react';
import { MockProblem } from '../../lib/mockData';
import { StatusBadge } from './StatusBadge';
import { ImpactScore } from './ImpactScore';
import Link from 'next/link';

export interface MapContainerProps {
  problems: MockProblem[];
  selectedProblemId?: string;
  onSelectProblem?: (id: string) => void;
  height?: string;
}

export function MapContainer({
  problems,
  selectedProblemId,
  onSelectProblem,
  height = 'h-[500px]',
}: MapContainerProps) {
  const [activeLayer, setActiveLayer] = useState<'clusters' | 'wards' | 'telemetry'>('clusters');
  const [activeProblem, setActiveProblem] = useState<MockProblem | null>(
    problems.find((p) => p.id === selectedProblemId) || problems[0] || null
  );

  const handleMarkerClick = (p: MockProblem) => {
    setActiveProblem(p);
    if (onSelectProblem) onSelectProblem(p.id);
  };

  return (
    <div className={`relative w-full ${height} rounded-xl border border-ink-border bg-canvas-subtle overflow-hidden shadow-card flex flex-col justify-between p-4 select-none`}>
      {/* Background Cartographic Grid Mockup */}
      <div className="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* SVG Map Lines & Ward Boundaries Simulation */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-ink-border/80 fill-none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 50 120 Q 200 80 400 150 T 800 140 T 1200 180" strokeWidth="1.5" strokeDasharray="4 4" />
        <path d="M 120 400 Q 300 350 600 380 T 1100 320" strokeWidth="1.5" />
        <path d="M 300 50 L 320 500" strokeWidth="1" strokeDasharray="6 6" />
        <path d="M 750 40 L 780 480" strokeWidth="1" strokeDasharray="6 6" />
        <circle cx="480" cy="220" r="90" className="fill-civic-blueLight/20 stroke-civic-blue/30" strokeWidth="1" />
        <circle cx="820" cy="260" r="70" className="fill-civic-roseLight/20 stroke-civic-rose/30" strokeWidth="1" />
      </svg>

      {/* Top Bar Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm p-1.5 rounded-lg border border-ink-border shadow-subtle text-xs">
          <button
            onClick={() => setActiveLayer('clusters')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeLayer === 'clusters'
                ? 'bg-ink-primary text-white'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            Problem Clusters
          </button>
          <button
            onClick={() => setActiveLayer('wards')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeLayer === 'wards'
                ? 'bg-ink-primary text-white'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            Ward Boundaries
          </button>
          <button
            onClick={() => setActiveLayer('telemetry')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              activeLayer === 'telemetry'
                ? 'bg-ink-primary text-white'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            Infrastructure Telemetry
          </button>
        </div>

        {/* Map Zoom & Compass */}
        <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-lg border border-ink-border shadow-subtle">
          <button
            className="p-1.5 text-ink-secondary hover:text-ink-primary rounded hover:bg-canvas-subtle"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            className="p-1.5 text-ink-secondary hover:text-ink-primary rounded hover:bg-canvas-subtle"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-ink-border mx-0.5" />
          <div className="p-1.5 text-ink-tertiary">
            <Compass className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Interactive Mock Incident Markers */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {problems.slice(0, 4).map((p, idx) => {
          const positions = [
            'top-1/4 left-1/3',
            'top-1/2 left-2/3',
            'bottom-1/3 left-1/4',
            'top-1/3 right-1/4',
          ];
          const isSelected = activeProblem?.id === p.id;

          const getMarkerColor = (score: number) => {
            if (score >= 80) return 'bg-civic-rose text-white ring-civic-rose/30';
            if (score >= 60) return 'bg-amber-600 text-white ring-amber-600/30';
            return 'bg-civic-blue text-white ring-civic-blue/30';
          };

          return (
            <div
              key={p.id}
              onClick={() => handleMarkerClick(p)}
              className={`absolute ${positions[idx % positions.length]} cursor-pointer transform -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110`}
            >
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold shadow-elevated ring-4 ${getMarkerColor(
                  p.impactScore
                )} ${isSelected ? 'scale-110 ring-8' : ''}`}
              >
                <MapPin className="w-3 h-3" />
                <span>{p.impactScore}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Row: Legend and Selected Problem Overlay */}
      <div className="relative z-10 flex flex-col sm:flex-row items-end justify-between gap-4">
        {/* Concise Legend */}
        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg border border-ink-border shadow-subtle text-[11px] font-mono space-y-1.5">
          <div className="text-ink-tertiary uppercase tracking-wider font-semibold">Impact Encoding</div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-civic-rose" />
              <span>Critical (80+)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>High (60-79)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-civic-blue" />
              <span>Medium (40-59)</span>
            </span>
          </div>
        </div>

        {/* Selected Problem Card Drawer/Overlay */}
        {activeProblem && (
          <div className="w-full sm:w-80 bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-ink-border shadow-elevated space-y-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-ink-tertiary">{activeProblem.id}</span>
              <StatusBadge status={activeProblem.status} size="sm" />
            </div>

            <h4 className="text-xs font-bold text-ink-primary line-clamp-1">
              {activeProblem.title}
            </h4>

            <div className="flex items-center justify-between text-xs text-ink-secondary">
              <span>{activeProblem.wardName}</span>
              <span className="font-mono font-semibold text-ink-primary">{activeProblem.signalCount} signals</span>
            </div>

            <div className="pt-2 border-t border-ink-border flex items-center justify-between">
              <div className="w-28">
                <ImpactScore score={activeProblem.impactScore} size="sm" showBar={false} />
              </div>
              <Link
                href={`/dashboard/problems/${activeProblem.id}`}
                className="text-xs font-semibold text-civic-blue hover:underline"
              >
                Inspect Problem →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
