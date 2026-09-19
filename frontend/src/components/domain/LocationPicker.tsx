'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Navigation, Loader2, AlertCircle, CheckCircle2, MapPin, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { Button } from '../ui/Button';

export interface LocationPickerValue {
  lat: number;
  lng: number;
  source: 'GPS' | 'MANUAL';
  accuracy_m?: number;
}

export interface LocationPickerProps {
  initialValue?: LocationPickerValue | null;
  onChange?: (value: LocationPickerValue) => void;
  onConfirm?: (value: LocationPickerValue) => void;
  disabled?: boolean;
}

// Canonical Bhubaneswar map-view center fallback (Visual camera center only)
// NOTE: This visual center is NOT treated as an authoritative citizen location.
// It serves strictly as the initial visual viewport center for the map canvas.
const MAP_VIEW_CENTER_FALLBACK: [number, number] = [85.8245, 20.2961]; // [lng, lat]
const DEFAULT_ZOOM = 14;

export function LocationPicker({
  initialValue,
  onChange,
  onConfirm,
  disabled = false,
}: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [location, setLocation] = useState<LocationPickerValue>(() => {
    if (initialValue) return initialValue;
    return {
      lat: MAP_VIEW_CENTER_FALLBACK[1],
      lng: MAP_VIEW_CENTER_FALLBACK[0],
      source: 'MANUAL',
    };
  });

  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Configurable Map Tile URL (Defaults to OpenStreetMap HTTPS)
  const tileUrl =
    process.env.NEXT_PUBLIC_MAP_TILE_URL ||
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialLng = MAP_VIEW_CENTER_FALLBACK[0];
    const initialLat = MAP_VIEW_CENTER_FALLBACK[1];

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
      center: [initialLng, initialLat],
      zoom: DEFAULT_ZOOM,
      dragRotate: false,
      touchPitch: false,
    });

    // Custom Editorial Pin Element
    const el = document.createElement('div');
    el.className = 'location-picker-marker';
    el.style.cursor = 'grab';
    el.innerHTML = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(0, -50%);">
        <div style="background-color: #C85A32; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="width: 8px; height: 8px; background-color: #FFFFFF; border-radius: 50%; transform: rotate(45deg);"></div>
        </div>
        <div style="width: 8px; height: 3px; background-color: rgba(26,24,22,0.3); border-radius: 50%; margin-top: -2px;"></div>
      </div>
    `;

    const marker = new maplibregl.Marker({
      element: el,
      draggable: !disabled,
    })
      .setLngLat([initialLng, initialLat])
      .addTo(map);

    // Marker Drag End Listener
    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      const updated: LocationPickerValue = {
        lat: Number(lngLat.lat.toFixed(6)),
        lng: Number(lngLat.lng.toFixed(6)),
        source: 'MANUAL',
      };
      setLocation(updated);
      setIsConfirmed(false);
      onChangeRef.current?.(updated);
    });

    // Map Click Listener (Click to reposition pin)
    map.on('click', (e) => {
      if (disabled) return;
      marker.setLngLat(e.lngLat);
      const updated: LocationPickerValue = {
        lat: Number(e.lngLat.lat.toFixed(6)),
        lng: Number(e.lngLat.lng.toFixed(6)),
        source: 'MANUAL',
      };
      setLocation(updated);
      setIsConfirmed(false);
      onChangeRef.current?.(updated);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [tileUrl, disabled]);

  // Synchronize pin position if initialValue changes externally
  useEffect(() => {
    if (!initialValue) return;
    setLocation((prev) => {
      if (prev.lat === initialValue.lat && prev.lng === initialValue.lng) return prev;
      if (markerRef.current) {
        markerRef.current.setLngLat([initialValue.lng, initialValue.lat]);
      }
      if (mapRef.current) {
        mapRef.current.flyTo({ center: [initialValue.lng, initialValue.lat], zoom: DEFAULT_ZOOM });
      }
      return initialValue;
    });
  }, [initialValue]);

  // Explicit GPS Request Handler — Only executes on button click
  const handleUseCurrentLocation = useCallback(() => {
    if (disabled) return;
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Your device could not determine your location. Please place the pin manually.');
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const accuracy_m = position.coords.accuracy ? Math.round(position.coords.accuracy) : undefined;

        const updated: LocationPickerValue = {
          lat,
          lng,
          source: 'GPS',
          accuracy_m,
        };

        setLocation(updated);
        setIsConfirmed(false);
        onChange?.(updated);

        // Center map and marker on acquired GPS point
        if (markerRef.current) {
          markerRef.current.setLngLat([lng, lat]);
        }
        if (mapRef.current) {
          mapRef.current.flyTo({
            center: [lng, lat],
            zoom: 16,
            essential: true,
          });
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError(
            'Location permission was denied. Your device could not determine your location. Please place the pin manually.'
          );
        } else {
          setGpsError(
            'Your device could not determine your location. Please place the pin manually.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }, [disabled, onChange]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleConfirm = () => {
    setIsConfirmed(true);
    onConfirm?.(location);
  };

  return (
    <div className="space-y-3 bg-canvas-card border border-ink-border p-4 sm:p-5 shadow-xs">
      {/* HEADER WITH LABEL & EXPLICIT GPS ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-ink-border">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-civic-terracotta shrink-0" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-ink-primary">
            LOCATION
          </span>
          <span className="text-ink-muted text-xs">{'//'}</span>
          <span className="text-[10px] font-mono text-ink-muted uppercase">
            {location.source === 'GPS' ? 'GPS Acquired' : 'Manual Placement'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={disabled || isLocating}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase rounded-sm border border-ink-border bg-canvas-subtle hover:bg-canvas text-ink-primary hover:border-civic-terracotta transition-colors disabled:opacity-50"
        >
          {isLocating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-civic-terracotta" />
              <span>Acquiring GPS…</span>
            </>
          ) : (
            <>
              <Navigation className="w-3.5 h-3.5 text-civic-terracotta" />
              <span>Use my current location</span>
            </>
          )}
        </button>
      </div>

      {/* GPS FEEDBACK / FALLBACK ERROR NOTICE */}
      {gpsError && (
        <div className="p-3 bg-amber-50/60 border border-amber-300 text-amber-900 text-xs flex items-start gap-2 rounded-sm">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-950">{gpsError}</p>
            <p className="text-[11px] text-amber-800">
              Drag the terracotta pin or tap anywhere on the map to set the incident location.
            </p>
          </div>
        </div>
      )}

      {/* INTERACTIVE REAL MAP CONTAINER */}
      <div className="relative w-full h-[280px] sm:h-[340px] border border-ink-border bg-canvas-subtle overflow-hidden">
        <div
          ref={mapContainerRef}
          className="absolute inset-0 w-full h-full"
          style={{ minHeight: '100%' }}
        />

        {/* MAP ZOOM CONTROLS */}
        <div className="absolute top-3 right-3 z-10 flex flex-col bg-canvas-card border border-ink-border shadow-xs">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle border-b border-ink-border transition-colors"
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
        </div>

        {/* INTERACTION HINT & MAP ATTRIBUTION OVERLAYS */}
        <div className="absolute bottom-2 left-2 z-10 bg-canvas-card/90 backdrop-blur-xs px-2 py-1 border border-ink-border text-[10px] font-mono text-ink-secondary pointer-events-none">
          Drag pin or tap map to position
        </div>
        <div className="absolute bottom-2 right-2 z-10 bg-canvas-card/90 backdrop-blur-xs px-2 py-0.5 border border-ink-border text-[9px] font-mono text-ink-muted pointer-events-auto">
          &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink-primary">OpenStreetMap contributors</a>
        </div>
      </div>

      {/* COORDINATES & SOURCE DISPLAY */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div>
            <span className="text-ink-muted uppercase mr-1">Latitude:</span>
            <span className="font-bold text-ink-primary">{location.lat.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-ink-muted uppercase mr-1">Longitude:</span>
            <span className="font-bold text-ink-primary">{location.lng.toFixed(6)}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-canvas-subtle border border-ink-border text-[10px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                location.source === 'GPS' ? 'bg-civic-emerald' : 'bg-civic-terracotta'
              }`}
            />
            <span className="uppercase font-semibold">
              {location.source}
              {location.accuracy_m ? ` (±${location.accuracy_m}m)` : ''}
            </span>
          </div>
        </div>

        {/* CONFIRM LOCATION BUTTON */}
        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-civic-emerald font-semibold">
              <Check className="w-3.5 h-3.5" />
              <span>Location Set</span>
            </span>
          ) : null}

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={disabled}
            className="text-xs font-mono uppercase"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirm Location</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
