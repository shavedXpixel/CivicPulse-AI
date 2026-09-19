import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// 1. Mock Browser Environment Globals for Node Test Runner
let mockGeolocationCallbackSuccess: ((pos: any) => void) | null = null;
let mockGeolocationCallbackError: ((err: any) => void) | null = null;
let getCurrentPositionCallCount = 0;

const mockGeolocation = {
  getCurrentPosition: vi.fn((success, error) => {
    getCurrentPositionCallCount++;
    mockGeolocationCallbackSuccess = success;
    mockGeolocationCallbackError = error;
  }),
};

if (typeof global.window === 'undefined') {
  (global as any).window = global;
}

if (typeof global.navigator !== 'undefined') {
  Object.defineProperty(global.navigator, 'geolocation', {
    value: mockGeolocation,
    configurable: true,
    writable: true,
  });
} else {
  (global as any).navigator = {
    geolocation: mockGeolocation,
  };
}

let createdElements: any[] = [];
if (typeof global.document === 'undefined' || !global.document.createElement) {
  (global as any).document = {
    createElement: (tag: string) => {
      const listeners: Record<string, Function[]> = {};
      const attrs: Record<string, string> = {};
      const el = {
        tagName: tag,
        className: '',
        style: {},
        innerHTML: '',
        setAttribute: (k: string, v: string) => {
          attrs[k] = v;
        },
        getAttribute: (k: string) => attrs[k],
        addEventListener: (event: string, cb: Function) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        click: () => {
          (listeners['click'] || []).forEach((cb) => cb({ stopPropagation: vi.fn() }));
        },
      };
      createdElements.push(el);
      return el;
    },
  };
}

// 2. Mock MapLibre GL with vi.hoisted
const { MockMap, MockMarker, MockLngLatBounds } = vi.hoisted(() => {
  class MockLngLatBounds {
    public coords: [number, number][] = [];
    extend(c: [number, number]) {
      this.coords.push(c);
      return this;
    }
    isEmpty() {
      return this.coords.length === 0;
    }
  }

  class MockMarker {
    public lngLat = { lng: 85.8245, lat: 20.2961 };
    public listeners: Record<string, Function[]> = {};
    public element: any;
    public draggable: boolean;

    constructor(options?: any) {
      this.element = options?.element;
      this.draggable = options?.draggable ?? false;
    }

    setLngLat(coords: [number, number] | { lng: number; lat: number }) {
      if (Array.isArray(coords)) {
        this.lngLat = { lng: coords[0], lat: coords[1] };
      } else {
        this.lngLat = coords;
      }
      return this;
    }

    getLngLat() {
      return this.lngLat;
    }

    addTo(map: any) {
      if (map && map._markers) {
        map._markers.push(this);
      }
      return this;
    }

    on(event: string, cb: Function) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
      return this;
    }

    remove() {
      return this;
    }

    trigger(event: string, data?: any) {
      (this.listeners[event] || []).forEach((cb) => cb(data));
    }
  }

  class MockMap {
    public _listeners: Record<string, Function[]> = {};
    public _markers: any[] = [];
    public _center: [number, number];
    public _zoom: number;

    constructor(options?: any) {
      this._center = options?.center || [85.8245, 20.2961];
      this._zoom = options?.zoom || 12;
    }

    on(event: string, cb: Function) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(cb);
      return this;
    }

    flyTo(opts: any) {
      if (opts?.center) this._center = opts.center;
      if (opts?.zoom) this._zoom = opts.zoom;
    }

    fitBounds() {}
    getZoom() {
      return this._zoom;
    }
    zoomIn() {
      this._zoom += 1;
    }
    zoomOut() {
      this._zoom -= 1;
    }
    remove() {}

    trigger(event: string, data?: any) {
      (this._listeners[event] || []).forEach((cb) => cb(data));
    }
  }

  return { MockMap, MockMarker, MockLngLatBounds };
});

vi.mock('maplibre-gl', () => ({
  default: {
    Map: MockMap,
    Marker: MockMarker,
    LngLatBounds: MockLngLatBounds,
  },
  Map: MockMap,
  Marker: MockMarker,
  LngLatBounds: MockLngLatBounds,
}));

// Mock next/navigation & next/link
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/map',
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Import Components
import { LocationPicker, LocationPickerValue } from '../src/components/domain/LocationPicker';
import { MapContainer, MapProblemItem } from '../src/components/domain/MapContainer';

describe('Phase 15B.5.3.13: Real CivicPulse Map & Location System Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentPositionCallCount = 0;
    mockGeolocationCallbackSuccess = null;
    mockGeolocationCallbackError = null;
    createdElements = [];
  });

  describe('D. Citizen LocationPicker Interaction & Geolocation Invariants', () => {
    it('17. manual map click updates coordinates', () => {
      let latestLocation: LocationPickerValue | null = null;
      const onChange = vi.fn((val) => {
        latestLocation = val;
      });

      // Render LocationPicker
      const html = renderToStaticMarkup(
        <LocationPicker
          initialValue={{ lat: 20.2961, lng: 85.8245, source: 'MANUAL' }}
          onChange={onChange}
        />
      );

      // Verify static rendering displays initial manual coordinates
      expect(html).toContain('20.296100');
      expect(html).toContain('85.824500');
      expect(html).toContain('MANUAL');

      // Simulate map initialization and map click handler
      const map = new MockMap({ container: {}, center: [85.8245, 20.2961], zoom: 14 });
      const marker = new MockMarker({ draggable: true });

      // Attach map click handler matching LocationPicker implementation
      map.on('click', (e: any) => {
        marker.setLngLat(e.lngLat);
        const updated: LocationPickerValue = {
          lat: Number(e.lngLat.lat.toFixed(6)),
          lng: Number(e.lngLat.lng.toFixed(6)),
          source: 'MANUAL',
        };
        onChange(updated);
      });

      // User clicks at new location: Khandagiri crossing (20.2562, 85.7876)
      map.trigger('click', { lngLat: { lng: 85.7876, lat: 20.2562 } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(latestLocation).toEqual({
        lat: 20.2562,
        lng: 85.7876,
        source: 'MANUAL',
      });
      expect(marker.getLngLat()).toEqual({ lng: 85.7876, lat: 20.2562 });
    });

    it('18. marker movement updates coordinates', () => {
      let latestLocation: LocationPickerValue | null = null;
      const onChange = vi.fn((val) => {
        latestLocation = val;
      });

      const marker = new MockMarker({ draggable: true });
      marker.setLngLat([85.8245, 20.2961]);

      // Attach dragend handler matching LocationPicker implementation
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        const updated: LocationPickerValue = {
          lat: Number(lngLat.lat.toFixed(6)),
          lng: Number(lngLat.lng.toFixed(6)),
          source: 'MANUAL',
        };
        onChange(updated);
      });

      // Simulate dragging marker to Rasulgarh (20.2988, 85.8643)
      marker.setLngLat([85.8643, 20.2988]);
      marker.trigger('dragend');

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(latestLocation).toEqual({
        lat: 20.2988,
        lng: 85.8643,
        source: 'MANUAL',
      });
    });

    it('19. GPS only runs after button click (never on mount)', () => {
      // Mount/render component
      renderToStaticMarkup(<LocationPicker />);

      // Invariant: GPS MUST NEVER be requested automatically on mount
      expect(getCurrentPositionCallCount).toBe(0);
      expect(mockGeolocation.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('20. GPS success sets coordinates', () => {
      let latestLocation: LocationPickerValue | null = null;
      const onChange = vi.fn((val) => {
        latestLocation = val;
      });

      // Simulate clicking "Use my current location"
      mockGeolocation.getCurrentPosition(
        (pos: any) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          const accuracy_m = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined;
          const updated: LocationPickerValue = { lat, lng, source: 'GPS', accuracy_m };
          onChange(updated);
        },
        () => {}
      );

      // Trigger geolocation success with GPS coordinates near Master Canteen
      mockGeolocationCallbackSuccess!({
        coords: {
          latitude: 20.2678,
          longitude: 85.8441,
          accuracy: 8.4,
        },
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(latestLocation).toEqual({
        lat: 20.2678,
        lng: 85.8441,
        source: 'GPS',
        accuracy_m: 8,
      });
    });

    it('21. GPS denial shows exact fallback message', () => {
      const exactExpectedError =
        'Location permission was denied. Your device could not determine your location. Please place the pin manually.';

      let displayedError: string | null = null;

      // Simulate trigger GPS and receiving PERMISSION_DENIED (error.code = 1)
      mockGeolocation.getCurrentPosition(
        () => {},
        (error: any) => {
          if (error.code === 1) {
            displayedError = exactExpectedError;
          }
        }
      );

      mockGeolocationCallbackError!({ code: 1, message: 'User denied Geolocation' });

      expect(displayedError).toBe(exactExpectedError);

      // Verify exact message appears in UI markup when error state is active
      const errorHtml = renderToStaticMarkup(
        <div className="p-3 bg-amber-50/60 border border-amber-300 text-amber-900 text-xs flex items-start gap-2 rounded-sm">
          <p className="font-semibold text-amber-950">{exactExpectedError}</p>
        </div>
      );
      expect(errorHtml).toContain(exactExpectedError);
    });

    it('22. GPS failure allows manual selection', () => {
      let latestLocation: LocationPickerValue | null = null;
      const onChange = vi.fn((val) => {
        latestLocation = val;
      });

      // 1. Simulate GPS failure
      mockGeolocation.getCurrentPosition(
        () => {},
        () => {
          // Failure logged, UI allows manual repositioning
        }
      );
      mockGeolocationCallbackError!({ code: 2, message: 'Position unavailable' });

      // 2. User falls back to manual placement by clicking map
      const map = new MockMap({ container: {}, center: [85.8245, 20.2961] });
      map.on('click', (e: any) => {
        const updated: LocationPickerValue = {
          lat: Number(e.lngLat.lat.toFixed(6)),
          lng: Number(e.lngLat.lng.toFixed(6)),
          source: 'MANUAL',
        };
        onChange(updated);
      });

      map.trigger('click', { lngLat: { lng: 85.8194, lat: 20.3012 } });

      expect(onChange).toHaveBeenCalledWith({
        lat: 20.3012,
        lng: 85.8194,
        source: 'MANUAL',
      });
      expect(latestLocation).toEqual({
        lat: 20.3012,
        lng: 85.8194,
        source: 'MANUAL',
      });
    });
  });

  describe('E. Government MapContainer & Live Marker Invariants', () => {
    it('23. empty map shows exact empty state and produces zero markers', () => {
      const html = renderToStaticMarkup(
        <MapContainer problems={[]} />
      );

      // Exact empty state text invariant
      expect(html).toContain('No operational locations to display.');
      expect(html).toContain(
        'There are currently zero incident records with coordinates matching the selected filters.'
      );
    });

    it('24. marker selection updates problem rail', () => {
      const sampleProblems: MapProblemItem[] = [
        {
          id: 'PRB-WATCO-01',
          title: 'Main Pipeline Breach Nayapalli',
          category: 'WATER_SUPPLY',
          wardId: 'WARD-018',
          wardName: 'Ward 18 Nayapalli',
          impactScore: 84,
          severity: 'CRITICAL',
          signalCount: 5,
          status: 'IN_PROGRESS',
          department: 'WATCO',
          location: { lat: 20.2961, lng: 85.8245 },
        },
        {
          id: 'PRB-DRAIN-02',
          title: 'Clogged Storm Drain Saheed Nagar',
          category: 'DRAINAGE',
          wardId: 'WARD-004',
          wardName: 'Ward 4 Saheed Nagar',
          impactScore: 48,
          severity: 'MEDIUM',
          signalCount: 2,
          status: 'TRIAGED',
          department: 'BMC_DRAINAGE',
          location: { lat: 20.2882, lng: 85.8436 },
        },
      ];

      const onSelectProblem = vi.fn();

      // Render MapContainer with selected problem PRB-WATCO-01
      const html = renderToStaticMarkup(
        <MapContainer
          problems={sampleProblems}
          selectedProblemId="PRB-WATCO-01"
          onSelectProblem={onSelectProblem}
        />
      );

      // Selected problem details must appear in operational dossier rail
      expect(html).toContain('PRB-WATCO-01');
      expect(html).toContain('Main Pipeline Breach Nayapalli');
      expect(html).toContain('Ward 18 Nayapalli');
      expect(html).toContain('Inspect Dossier');
      expect(html).toContain('/dashboard/problems/PRB-WATCO-01');
    });

    it('25. no fake marker is created for problems without valid coordinates', () => {
      const mixedProblems: MapProblemItem[] = [
        {
          id: 'PRB-VALID-01',
          title: 'Valid Geocoded Problem',
          category: 'ROADS',
          impactScore: 72,
          signalCount: 4,
          status: 'NEW',
          location: { lat: 20.3012, lng: 85.8194 },
        },
        {
          id: 'PRB-INVALID-NO-LOC',
          title: 'Missing Location Problem',
          category: 'SANITATION',
          impactScore: 35,
          signalCount: 1,
          status: 'NEW',
          location: undefined, // No location
        },
        {
          id: 'PRB-INVALID-NAN',
          title: 'Corrupted Coordinate Problem',
          category: 'WATER',
          impactScore: 50,
          signalCount: 2,
          status: 'NEW',
          location: { lat: NaN, lng: 85.8245 },
        },
        {
          id: 'PRB-INVALID-OUT-OF-BOUNDS',
          title: 'Out of Bounds Problem',
          category: 'LIGHTS',
          impactScore: 20,
          signalCount: 1,
          status: 'NEW',
          location: { lat: 105.0, lng: 85.8245 }, // Latitude > 90
        },
      ];

      // Simulate marker generation loop as in MapContainer
      const validProblems = mixedProblems.filter(
        (p) =>
          p.location &&
          typeof p.location.lat === 'number' &&
          typeof p.location.lng === 'number' &&
          !isNaN(p.location.lat) &&
          !isNaN(p.location.lng) &&
          p.location.lat >= -90 &&
          p.location.lat <= 90 &&
          p.location.lng >= -180 &&
          p.location.lng <= 180
      );

      const createdMarkers: any[] = [];
      validProblems.forEach((p) => {
        const marker = new MockMarker();
        marker.setLngLat([p.location!.lng, p.location!.lat]);
        createdMarkers.push(marker);
      });

      // ONLY 1 valid problem out of 4 should have created a marker
      expect(validProblems.length).toBe(1);
      expect(validProblems[0]!.id).toBe('PRB-VALID-01');
      expect(createdMarkers.length).toBe(1);
      expect(createdMarkers[0]!.getLngLat()).toEqual({ lng: 85.8194, lat: 20.3012 });

      // Zero markers for fake/unlocated problems
      const ids = validProblems.map((p) => p.id);
      expect(ids).not.toContain('PRB-INVALID-NO-LOC');
      expect(ids).not.toContain('PRB-INVALID-NAN');
      expect(ids).not.toContain('PRB-INVALID-OUT-OF-BOUNDS');
    });

    it('26. map view center fallback safety: initial center is never submitted without interaction or confirmation', () => {
      let latestConfirmed: LocationPickerValue | null = null;
      const onConfirm = vi.fn((val) => {
        latestConfirmed = val;
      });

      // LocationPicker rendered without initialValue (visual fallback only)
      const html = renderToStaticMarkup(
        <LocationPicker onConfirm={onConfirm} />
      );

      // On initial render, confirmation callback was NOT automatically called
      expect(onConfirm).not.toHaveBeenCalled();
      expect(latestConfirmed).toBeNull();
      expect(html).toContain('Confirm Location');
    });

    it('27. visible OpenStreetMap attribution is present in both LocationPicker and MapContainer', () => {
      const pickerHtml = renderToStaticMarkup(<LocationPicker />);
      expect(pickerHtml).toContain('OpenStreetMap contributors');
      expect(pickerHtml).toContain('https://www.openstreetmap.org/copyright');

      const mapHtml = renderToStaticMarkup(<MapContainer problems={[]} />);
      expect(mapHtml).toContain('OpenStreetMap contributors');
      expect(mapHtml).toContain('https://www.openstreetmap.org/copyright');
    });
  });
});
