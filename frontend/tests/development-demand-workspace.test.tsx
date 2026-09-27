import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DevelopmentDemandPage from '../src/app/governance/development-demand/page';
import { DevelopmentDemandWorkspace } from '../src/components/governance/DevelopmentDemandWorkspace';
import { DevelopmentDemandMap } from '../src/components/domain/DevelopmentDemandMap';
import { UserRole, UserStatus } from '@civicpulse/shared';

// 1. Mock Next.js Navigation
let currentPathname = '/governance/development-demand';
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// 2. Mock MapLibre GL
vi.mock('maplibre-gl', () => {
  return {
    default: {
      Map: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        once: vi.fn(),
        remove: vi.fn(),
        addSource: vi.fn(),
        getSource: vi.fn(),
        addLayer: vi.fn(),
        isStyleLoaded: vi.fn().mockReturnValue(true),
        getCanvas: vi.fn().mockReturnValue({ style: {} }),
        flyTo: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        getZoom: vi.fn().mockReturnValue(12),
        fitBounds: vi.fn(),
      })),
      Marker: vi.fn().mockImplementation(() => ({
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn().mockReturnThis(),
      })),
      LngLatBounds: vi.fn().mockImplementation(() => ({
        extend: vi.fn().mockReturnThis(),
        isEmpty: vi.fn().mockReturnValue(false),
      })),
    },
  };
});

// 3. Mock Auth State
let mockAuthState = {
  user: { id: 'usr_admin_01', email: 'admin@bhubaneswar.gov.in' } as any,
  userProfile: {
    id: 'usr_admin_01',
    display_name: 'Municipal Administrator',
    email: 'admin@bhubaneswar.gov.in',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  } as any,
  isDemoMode: true,
  isConfigured: true,
  loading: false,
  signOut: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  getIdToken: vi.fn().mockResolvedValue('demo-token-admin'),
  refreshProfile: vi.fn(),
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// 4. Mock API Client
const mockOverviewData = {
  total_active_demands: 4,
  total_demand_signals: 18,
  top_sectors: [
    { category: 'drinking_water', count: 5, composite_index_avg: 59 },
    { category: 'drainage_flood_stormwater', count: 5, composite_index_avg: 64 },
  ],
  ward_demand_summary: [
    { ward_id: 'WARD-018', demand_count: 5, top_category: 'drinking_water' },
    { ward_id: 'WARD-027', demand_count: 5, top_category: 'drainage_flood_stormwater' },
  ],
  is_demo: true,
  generated_at: '2026-03-24T12:00:00.000Z',
};

const mockClustersData = {
  clusters: [
    {
      id: 'dclust_demo_water_w18',
      title: 'Drinking Water Pipeline & Low Pressure Deficit — Ward 18 (Khandagiri)',
      category: 'drinking_water',
      ward_ids: ['WARD-018'],
      locality_names: ['Khandagiri Sector 4'],
      centroid: { lat: 20.255, lng: 85.782 },
      signal_count: 5,
      first_signal_at: '2026-02-15T08:30:00.000Z',
      last_signal_at: '2026-03-12T14:45:00.000Z',
      duration_days: 25.3,
      is_demo: true,
      created_at: '2026-02-15T08:30:00.000Z',
    },
  ],
  total_count: 1,
  is_demo: true,
};

const mockMapData = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[85.78, 20.25], [85.79, 20.25], [85.79, 20.26], [85.78, 20.26], [85.78, 20.25]]] },
      properties: {
        entity_id: 'ward_boundary_WARD-018',
        entity_type: 'WARD_HEAT',
        category: 'drinking_water',
        demand_intensity: 59,
        ward_id: 'WARD-018',
        signal_count: 5,
        is_demo: true,
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [85.782, 20.255] },
      properties: {
        entity_id: 'dclust_demo_water_w18',
        entity_type: 'DEMAND_CLUSTER',
        category: 'drinking_water',
        demand_intensity: 59,
        ward_id: 'WARD-018',
        signal_count: 5,
        is_demo: true,
      },
    },
  ],
  metadata: {
    total_features: 2,
    is_demo: true,
    generated_at: '2026-03-24T12:00:00.000Z',
  },
};

const mockClusterDetail = {
  cluster: mockClustersData.clusters[0],
  signals: [
    {
      id: 'dsig_w18_01',
      normalized_text: 'Ward 18 Khandagiri faces irregular drinking water supply with low pressure.',
      source_channel: 'WHATSAPP_MESSAGING',
      ward_id: 'WARD-018',
      is_demo: true,
    },
  ],
  opportunities: [
    {
      id: 'opp_demo_water_w18',
      title: 'Piped Water Network Augmentation & Distribution Feeder — Ward 18 (Khandagiri)',
      category: 'drinking_water',
      ward_id: 'WARD-018',
      demand_cluster_id: 'dclust_demo_water_w18',
      priority_band: 'HIGH',
      metrics: {
        demand_volume_score: 11,
        recurrence_score: 14,
        geographic_concentration_score: 10,
        population_exposure_score: 10,
        infrastructure_deficit_score: 9,
        investment_gap_score: 5,
        composite_demand_index: 59,
      },
      narrative_justification: 'Supported by available evidence indicating low distribution pressure.',
      uncertainty_notes: ['WATCO pipe feeder survey dated 2025.'],
      status: 'PROPOSED',
      is_demo: true,
      created_at: '2026-02-15T08:30:00.000Z',
    },
  ],
  is_demo: true,
};

vi.mock('../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/overview')) return Promise.resolve({ data: mockOverviewData });
      if (url.includes('/clusters/dclust_demo_water_w18')) return Promise.resolve({ data: mockClusterDetail });
      if (url.includes('/clusters')) return Promise.resolve({ data: mockClustersData });
      if (url.includes('/map')) return Promise.resolve({ data: mockMapData });
      if (url.includes('/indicators')) return Promise.resolve({ data: { indicators: [] } });
      if (url.includes('/investment-context')) return Promise.resolve({ data: { investments: [] } });
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/analyze')) {
        return Promise.resolve({
          opportunity_id: 'opp_demo_water_w18',
          category: 'drinking_water',
          ward_id: 'WARD-018',
          observed_facts: {
            total_signals: 5,
            first_detected: '2026-02-15T08:30:00.000Z',
            last_detected: '2026-03-12T14:45:00.000Z',
            intake_channels: ['WHATSAPP_MESSAGING'],
            sample_narratives: [{ content: 'Sample narrative', trust: 'untrusted_user_content' }],
          },
          metrics: (mockClusterDetail.opportunities as any)[0].metrics,
          evidence_citations: {
            signal_ids: ['dsig_w18_01'],
            indicator_sources: ['WATCO'],
            investment_references: ['AMRUT 2.0'],
          },
          advisory_interpretation: {
            summary: 'Infrastructure reinforcement candidate.',
            need_justification: 'Low pressure in morning hours.',
            tradeoffs_and_considerations: ['Requires road excavation.'],
          },
          uncertainty: {
            confidence: 0.9,
            limitations: ['Pipe pressure sensors not yet connected.'],
          },
        });
      }
      return Promise.resolve({});
    }),
  },
}));

describe('Phase 15B.5.3.20-HF7.7 — Development Demand Governance Workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.userProfile = {
      id: 'usr_admin_01',
      display_name: 'Municipal Administrator',
      email: 'admin@bhubaneswar.gov.in',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    };
  });

  describe('1. RBAC & Route Access Control', () => {
    it('renders the governance workspace for ADMIN role', () => {
      const html = renderToStaticMarkup(<DevelopmentDemandPage />);
      expect(html).toContain('DEVELOPMENT DEMAND INTELLIGENCE');
      expect(html).toContain('CIVICPULSE GOVERNANCE');
    });

    it('renders the governance workspace for DEPARTMENT_OFFICER role', () => {
      mockAuthState.userProfile = {
        ...mockAuthState.userProfile,
        role: UserRole.DEPARTMENT_OFFICER,
      };
      const html = renderToStaticMarkup(<DevelopmentDemandPage />);
      expect(html).toContain('DEVELOPMENT DEMAND INTELLIGENCE');
    });

    it('strictly denies CITIZEN role with 403 Forbidden message', () => {
      mockAuthState.userProfile = {
        ...mockAuthState.userProfile,
        role: UserRole.CITIZEN,
      };
      const html = renderToStaticMarkup(<DevelopmentDemandPage />);
      expect(html).toContain('ACCESS RESTRICTED (403 FORBIDDEN)');
      expect(html).toContain('restricted to Municipal Administrators and Department Officers');
    });

    it('strictly denies FIELD_OFFICER role with 403 Forbidden message', () => {
      mockAuthState.userProfile = {
        ...mockAuthState.userProfile,
        role: UserRole.FIELD_OFFICER,
      };
      const html = renderToStaticMarkup(<DevelopmentDemandPage />);
      expect(html).toContain('ACCESS RESTRICTED (403 FORBIDDEN)');
    });
  });

  describe('2. Workspace Overview & Badge Rendering', () => {
    it('renders DEMO MODE badge when in demo mode', () => {
      const html = renderToStaticMarkup(
        <DevelopmentDemandWorkspace initialOverview={mockOverviewData as any} />
      );
      expect(html).toContain('DEMO MODE');
      expect(html).toContain('SYNTHETIC SCENARIO DATASET ACTIVE');
    });

    it('renders analytical macro overview cards', () => {
      const html = renderToStaticMarkup(
        <DevelopmentDemandWorkspace initialOverview={mockOverviewData as any} />
      );
      expect(html).toContain('Total Demand Signals');
      expect(html).toContain('Active Clusters');
      expect(html).toContain('Wards Represented');
      expect(html).toContain('Peak Demand Index');
      expect(html).toContain('Data Coverage');
      expect(html).toContain('18');
      expect(html).toContain('4');
    });
  });

  describe('3. Map & Privacy Boundaries', () => {
    it('initializes MapLibre container without throwing', () => {
      const html = renderToStaticMarkup(
        <DevelopmentDemandMap
          mapData={mockMapData as any}
          selectedClusterId="dclust_demo_water_w18"
        />
      );
      expect(html).toContain('governance-maplibre-container');
      expect(html).toContain('BMC OFFICIAL 67 WARDS');
      expect(html).toContain('ZERO RESIDENTIAL GPS');
    });

    it('ensures zero PII (email, phone, household coordinates) in rendered output', () => {
      const html = renderToStaticMarkup(
        <DevelopmentDemandWorkspace initialOverview={mockOverviewData as any} />
      );
      expect(html).not.toContain('@gmail.com');
      expect(html).not.toContain('+91');
      expect(html).not.toContain('household_pin');
      expect(html).not.toContain('firebase_uid');
    });
  });

  describe('4. Deterministic Metrics & Evidence Lineage', () => {
    it('renders the lineage stepper chain', () => {
      const html = renderToStaticMarkup(
        <DevelopmentDemandWorkspace initialOverview={mockOverviewData as any} />
      );
      expect(html).toContain('EVIDENCE PROVENANCE');
      expect(html).toContain('Citizen Demand');
      expect(html).toContain('Normalization');
      expect(html).toContain('Clustering');
      expect(html).toContain('HF7.5 Metrics');
      expect(html).toContain('Governance AI');
    });

    it('uses consultative and advisory-only language for candidate opportunities', () => {
      const html = renderToStaticMarkup(
        <DevelopmentDemandWorkspace initialOverview={mockOverviewData as any} />
      );
      expect(html).toContain('CANDIDATE DEVELOPMENT OPPORTUNITIES');
      expect(html).not.toContain('Approved by Government');
      expect(html).not.toContain('Government must build');
      expect(html).not.toContain('Project authorized');
    });
  });

});
