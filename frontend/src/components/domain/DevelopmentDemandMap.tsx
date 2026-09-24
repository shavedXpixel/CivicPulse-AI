'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { ZoomIn, ZoomOut, Compass, Layers, ShieldCheck } from 'lucide-react';
import type { DevelopmentDemandMapResponse } from '@civicpulse/shared';


export interface DevelopmentDemandMapProps {
  mapData: DevelopmentDemandMapResponse | null;
  selectedClusterId?: string;
  onSelectCluster?: (clusterId: string) => void;
  selectedWardId?: string;
  onSelectWard?: (wardId: string) => void;
  height?: string;
  isLoading?: boolean;
}

const BHUBANESWAR_CENTER: [number, number] = [85.8245, 20.2961];
const DEFAULT_ZOOM = 11.8;

export function DevelopmentDemandMap({
  mapData,
  selectedClusterId,
  onSelectCluster,
  selectedWardId,
  onSelectWard,
  height = 'h-[500px]',
  isLoading = false
}: DevelopmentDemandMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [hoveredWard, setHoveredWard] = useState<{ id: string; intensity: number; count: number } | null>(null);


  const tileUrl =
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_MAP_TILE_URL
      ? process.env.NEXT_PUBLIC_MAP_TILE_URL
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'osm-raster': {
              type: 'raster',
              tiles: [tileUrl],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors | BMC Spatial GIS'
            }
          },
          layers: [
            {
              id: 'osm-raster-layer',
              type: 'raster',
              source: 'osm-raster',
              minzoom: 0,
              maxzoom: 19
            }
          ]
        },
        center: BHUBANESWAR_CENTER,
        zoom: DEFAULT_ZOOM,
        dragRotate: false,
        touchPitch: false
      });

      mapRef.current = map;
    } catch (e) {
      console.warn('MapLibre initialization deferred (headless / test environment):', e);
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [tileUrl]);

  // Separate features into Wards and Cluster Centroids
  const { wardFeatures, clusterFeatures } = useMemo(() => {
    if (!mapData || !Array.isArray(mapData.features)) {
      return { wardFeatures: [], clusterFeatures: [] };
    }
    const wards = mapData.features.filter((f) => f.properties?.entity_type === 'WARD_HEAT');
    const clusters = mapData.features.filter((f) => f.properties?.entity_type === 'DEMAND_CLUSTER');
    return { wardFeatures: wards, clusterFeatures: clusters };
  }, [mapData]);

  // Render ward polygons GeoJSON layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = 'bmc-wards-demand-source';
    const fillLayerId = 'bmc-wards-demand-fill';
    const lineLayerId = 'bmc-wards-demand-line';

    const onStyleReady = () => {
      if (!map.isStyleLoaded()) return;

      const wardCollection = {
        type: 'FeatureCollection',
        features: wardFeatures
      };

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(wardCollection as any);
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: wardCollection as any
        });

        // Choropleth fill based on demand intensity
        map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', 'demand_intensity'],
              0, 'rgba(244, 240, 234, 0.1)',
              20, 'rgba(217, 119, 6, 0.2)',
              50, 'rgba(200, 90, 50, 0.35)',
              80, 'rgba(200, 90, 50, 0.65)'
            ],
            'fill-opacity': 0.75
          }
        });

        // 1px architectural boundary lines (selected ward highlighted with 2.5px terracotta line)
        map.addLayer({
          id: lineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'ward_id'], selectedWardId || ''],
              '#C85A32',
              '#1A1816'
            ],
            'line-width': [
              'case',
              ['==', ['get', 'ward_id'], selectedWardId || ''],
              2.5,
              1
            ],
            'line-opacity': 0.6
          }
        });

        // Hover & click listeners for wards
        map.on('mousemove', fillLayerId, (e: any) => {
          if (e.features && e.features.length > 0) {
            const props = e.features[0].properties;
            setHoveredWard({
              id: props.ward_id,
              intensity: props.demand_intensity || 0,
              count: props.signal_count || 0
            });
            map.getCanvas().style.cursor = 'pointer';
          }
        });

        map.on('mouseleave', fillLayerId, () => {
          setHoveredWard(null);
          map.getCanvas().style.cursor = '';
        });

        map.on('click', fillLayerId, (e: any) => {
          if (e.features && e.features.length > 0) {
            const wardId = e.features[0].properties.ward_id;
            if (wardId) onSelectWard?.(wardId);
          }
        });
      }
    };

    if (map.isStyleLoaded()) {
      onStyleReady();
    } else {
      map.once('load', onStyleReady);
    }
  }, [wardFeatures, selectedWardId, onSelectWard]);


  // Synchronize Cluster Centroid Markers (NO citizen pins, NO residential coordinates)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = new maplibregl.LngLatBounds();

    clusterFeatures.forEach((feat) => {
      if (feat.geometry.type !== 'Point' || !Array.isArray(feat.geometry.coordinates)) return;
      const coords: [number, number] = [feat.geometry.coordinates[0], feat.geometry.coordinates[1]];
      bounds.extend(coords);

      const clusterId = feat.properties.entity_id;
      const isSelected = selectedClusterId === clusterId;
      const score = Math.round(feat.properties.demand_intensity || 0);
      const signalCount = feat.properties.signal_count || 0;

      const el = document.createElement('div');

      el.className = 'civicpulse-cluster-marker group cursor-pointer transition-transform duration-150';
      el.setAttribute('data-cluster-id', clusterId);
      el.setAttribute('data-testid', `cluster-marker-${clusterId}`);

      el.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 2px;
          background: ${isSelected ? '#C85A32' : '#1A1816'};
          color: #FCFAF7;
          border: 1px solid ${isSelected ? '#FCFAF7' : '#DDD7CD'};
          box-shadow: 0 2px 6px rgba(26,24,22,0.25);
          font-family: monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          transform: ${isSelected ? 'scale(1.12)' : 'scale(1)'};
        ">
          <span style="
            display: inline-block;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: ${score >= 70 ? '#FCFAF7' : '#D97706'};
          "></span>
          <span>CDI ${score}</span>
          <span style="opacity: 0.6; font-size: 10px;">(${signalCount}s)</span>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectCluster?.(clusterId);
        map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 13), essential: true });
      });

      try {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(coords)
          .addTo(map);
        markersRef.current.push(marker);
      } catch (err) {
        // Fallback in headless mock
      }
    });
  }, [clusterFeatures, selectedClusterId, onSelectCluster]);


  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetCenter = () => {
    mapRef.current?.flyTo({ center: BHUBANESWAR_CENTER, zoom: DEFAULT_ZOOM, essential: true });
  };

  return (
    <div className={`relative border border-[#DDD7CD] bg-[#F4F0EA] ${height} overflow-hidden font-sans`}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" data-testid="governance-maplibre-container" />

      {/* Top Map Monospace Status Bar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-[#FCFAF7] border border-[#DDD7CD] px-3 py-1.5 text-xs font-mono text-[#1A1816] shadow-sm">
        <ShieldCheck className="w-3.5 h-3.5 text-[#C85A32]" />
        <span className="font-bold">BMC OFFICIAL 67 WARDS</span>
        <span className="text-[#948F86]">|</span>
        <span className="text-[#5C5852]">CENTROID AGGREGATION ONLY</span>
        <span className="text-[#948F86]">|</span>
        <span className="text-[#2E6F40] font-bold">ZERO RESIDENTIAL GPS</span>
      </div>

      {/* Hovered Ward Floating Indicator */}
      {hoveredWard && (
        <div className="absolute top-12 left-3 z-10 bg-[#1A1816] text-[#FCFAF7] border border-[#DDD7CD] px-3 py-2 text-xs font-mono shadow-md">
          <div className="font-bold text-[#C85A32]">{hoveredWard.id}</div>
          <div className="text-[11px] text-[#ECE7DF]">
            Demand Intensity: <span className="font-bold">{hoveredWard.intensity} / 100</span>
          </div>
          <div className="text-[10px] text-[#948F86]">Signals: {hoveredWard.count} registered</div>
        </div>
      )}

      {/* Map Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          className="w-8 h-8 bg-[#FCFAF7] border border-[#DDD7CD] flex items-center justify-center text-[#1A1816] hover:bg-[#ECE7DF] transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          className="w-8 h-8 bg-[#FCFAF7] border border-[#DDD7CD] flex items-center justify-center text-[#1A1816] hover:bg-[#ECE7DF] transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleResetCenter}
          aria-label="Reset orientation"
          title="Reset Center"
          className="w-8 h-8 bg-[#FCFAF7] border border-[#DDD7CD] flex items-center justify-center text-[#1A1816] hover:bg-[#ECE7DF] transition-colors"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Layer Toggle & Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-[#FCFAF7] border border-[#DDD7CD] p-2.5 text-xs shadow-sm max-w-xs">
        <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#DDD7CD]">
          <span className="font-mono text-[11px] font-bold text-[#1A1816] uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#C85A32]" /> Demand Intensity Scale
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px] text-[#5C5852]">
          <span className="px-1.5 py-0.5 bg-[rgba(244,240,234,0.6)] border border-[#DDD7CD]">0–20 None</span>
          <span className="px-1.5 py-0.5 bg-[rgba(217,119,6,0.3)] border border-[#DDD7CD]">21–50 Moderate</span>
          <span className="px-1.5 py-0.5 bg-[rgba(200,90,50,0.6)] text-white border border-[#DDD7CD]">70+ Critical</span>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-[#F4F0EA]/80 flex items-center justify-center">
          <div className="bg-[#FCFAF7] border border-[#DDD7CD] px-4 py-3 font-mono text-xs text-[#1A1816] shadow-sm flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-[#C85A32] border-t-transparent animate-spin" />
            <span>Compiling municipal demand spatial layers…</span>
          </div>
        </div>
      )}
    </div>
  );
}
