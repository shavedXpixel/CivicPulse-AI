'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ZoomIn, ZoomOut, Compass, AlertCircle, ExternalLink } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { ImpactScore } from './ImpactScore';
import Link from 'next/link';

export interface MapProblemItem {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  wardId?: string;
  wardName?: string;
  impactScore: number;
  severity?: string;
  signalCount: number;
  status: string;
  department?: string;
  location?: { lat: number; lng: number };
  createdAt?: string;
}

export interface MapContainerProps {
  problems: MapProblemItem[];
  selectedProblemId?: string;
  onSelectProblem?: (id: string) => void;
  height?: string;
  showDetailDrawer?: boolean;
}

const DEFAULT_CENTER: [number, number] = [85.8245, 20.2961];
const DEFAULT_ZOOM = 12;

export function MapContainer({
  problems,
  selectedProblemId,
  onSelectProblem,
  height = 'h-[540px]',
  showDetailDrawer = true,
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [activeLayer, setActiveLayer] = useState<'clusters' | 'wards'>('clusters');
  const [activeProblem, setActiveProblem] = useState<MapProblemItem | null>(() => {
    return problems.find((p) => p.id === selectedProblemId) || problems[0] || null;
  });

  const tileUrl =
    process.env.NEXT_PUBLIC_MAP_TILE_URL ||
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Initialize MapLibre GL instance
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-raster': {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm-raster-layer',
            type: 'raster',
            source: 'osm-raster',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      dragRotate: false,
      touchPitch: false,
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [tileUrl]);

  // Synchronize Markers with Real Problems
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Filter problems with valid coordinates
    const validProblems = problems.filter(
      (p) =>
        p.location &&
        typeof p.location.lat === 'number' &&
        typeof p.location.lng === 'number' &&
        p.location.lat >= -90 &&
        p.location.lat <= 90 &&
        p.location.lng >= -180 &&
        p.location.lng <= 180
    );

    if (validProblems.length === 0) {
      return;
    }

    const bounds = new maplibregl.LngLatBounds();

    validProblems.forEach((p) => {
      const coords: [number, number] = [p.location!.lng, p.location!.lat];
      bounds.extend(coords);

      const isSelected = activeProblem?.id === p.id;
      const isCritical = p.impactScore >= 80;
      const isHigh = p.impactScore >= 60 && p.impactScore < 80;

      const bgColor = isCritical ? '#C85A32' : isHigh ? '#D97706' : '#1A1816';

      const el = document.createElement('div');
      el.className = 'civicpulse-map-marker cursor-pointer transition-transform hover:scale-110';
      el.setAttribute('data-problem-id', p.id);
      el.innerHTML = `
        <div style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 9999px; background-color: ${bgColor}; color: #FFFFFF; font-family: monospace; font-size: 11px; font-weight: 700; border: 2px solid #FFFFFF; box-shadow: 0 2px 8px rgba(0,0,0,0.25); transform: ${
        isSelected ? 'scale(1.15);' : 'scale(1);'
      }">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #FFFFFF;"></span>
          <span>${Math.round(p.impactScore)}</span>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setActiveProblem(p);
        onSelectProblem?.(p.id);
        map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 13), essential: true });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Fit map bounds if multiple problems exist
    if (validProblems.length > 1 && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
    }
  }, [problems, activeProblem?.id, onSelectProblem]);

  // Keep activeProblem synchronized with selectedProblemId prop
  useEffect(() => {
    if (selectedProblemId) {
      const found = problems.find((p) => p.id === selectedProblemId);
      if (found) {
        setActiveProblem(found);
      }
    }
  }, [selectedProblemId, problems]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleResetView = () => {
    if (problems[0]?.location) {
      mapRef.current?.flyTo({ center: [problems[0].location.lng, problems[0].location.lat], zoom: DEFAULT_ZOOM });
    } else {
      mapRef.current?.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
    }
  };

  return (
    <div className={`relative w-full ${height} border border-ink-border bg-canvas-subtle overflow-hidden flex flex-col justify-between p-3 sm:p-4 select-none shadow-xs`}>
      {/* REAL MAP CONTAINER CANVAS */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full"
        style={{ minHeight: '100%' }}
      />

      {/* TOP CONTROLS BAR */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5 pointer-events-auto">
        {/* Layer Selection Chips */}
        <div className="flex items-center gap-1 bg-canvas-card/95 backdrop-blur-xs p-1 border border-ink-border text-xs font-mono shadow-xs">
          <button
            type="button"
            onClick={() => setActiveLayer('clusters')}
            className={`px-2.5 py-1 text-[10px] uppercase font-bold transition-colors ${
              activeLayer === 'clusters'
                ? 'bg-ink-primary text-canvas-card'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            Operational Incidents ({problems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('wards')}
            className={`px-2.5 py-1 text-[10px] uppercase font-bold transition-colors ${
              activeLayer === 'wards'
                ? 'bg-ink-primary text-canvas-card'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            BMC Ward Boundaries
          </button>
        </div>

        {/* Map Zoom & Compass Tools */}
        <div className="flex items-center gap-1 bg-canvas-card/95 backdrop-blur-xs p-1 border border-ink-border shadow-xs">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-ink-border mx-0.5" />
          <button
            type="button"
            onClick={handleResetView}
            className="p-1.5 text-ink-muted hover:text-ink-primary hover:bg-canvas-subtle transition-colors"
            title="Reset Map View"
            aria-label="Reset Map View"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* HONEST EMPTY STATE BANNER (When zero real database records are found) */}
      {problems.length === 0 && (
        <div className="relative z-10 m-auto max-w-sm w-full p-4 bg-canvas-card/95 backdrop-blur-xs border border-ink-border text-center space-y-2 shadow-xs pointer-events-auto">
          <div className="w-7 h-7 rounded-full bg-canvas-subtle border border-ink-border flex items-center justify-center mx-auto text-ink-muted">
            <AlertCircle className="w-4 h-4" />
          </div>
          <p className="text-xs font-mono font-bold uppercase tracking-wider text-ink-primary">
            No operational locations to display.
          </p>
          <p className="text-[11px] text-ink-secondary leading-relaxed">
            There are currently zero incident records with coordinates matching the selected filters.
          </p>
        </div>
      )}

      {/* BOTTOM RAIL: LEGEND & SELECTED INCIDENT DRAWER */}
      <div className="relative z-10 flex flex-col sm:flex-row items-end justify-between gap-3 pointer-events-auto">
        {/* Editorial Impact Legend */}
        <div className="bg-canvas-card/95 backdrop-blur-xs p-2.5 sm:p-3 border border-ink-border text-[10px] font-mono space-y-1 shadow-xs">
          <div className="text-ink-muted uppercase tracking-wider font-semibold">Impact Encoding</div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-civic-terracotta" />
              <span>Critical (80+)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              <span>High (60-79)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-ink-primary" />
              <span>Medium / Low (&lt;60)</span>
            </span>
          </div>
          <div className="text-[9px] text-ink-muted pt-1 border-t border-ink-border/60">
            &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink-primary">OpenStreetMap contributors</a>
          </div>
        </div>

        {/* Selected Problem Card Drawer (Mobile & Compact View) */}
        {showDetailDrawer && activeProblem && (
          <div className="w-full sm:w-80 bg-canvas-card/95 backdrop-blur-xs p-4 border border-ink-border space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-ink-muted text-[10px] uppercase tracking-wider">
                REF: {activeProblem.id}
              </span>
              <StatusBadge status={activeProblem.status} size="sm" />
            </div>

            <h4 className="text-sm font-serif font-bold text-ink-primary line-clamp-1">
              {activeProblem.title}
            </h4>

            <div className="flex items-center justify-between text-xs text-ink-secondary font-mono">
              <span>{activeProblem.wardName || activeProblem.wardId || 'BMC Area'}</span>
              <span className="font-semibold text-ink-primary">{activeProblem.signalCount} signals</span>
            </div>

            <div className="pt-2 border-t border-ink-border flex items-center justify-between">
              <div className="w-28">
                <ImpactScore score={activeProblem.impactScore} size="sm" showBar={false} />
              </div>
              <Link
                href={`/dashboard/problems/${activeProblem.id}`}
                className="inline-flex items-center gap-1 text-xs font-mono uppercase text-civic-terracotta hover:underline font-bold"
              >
                <span>Inspect Dossier</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
