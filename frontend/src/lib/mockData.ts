/**
 * STATIC UI PLACEHOLDER DATA
 * 
 * Used STRICTLY for visual development and component layout during Phase 1.
 * Centered on the approved synthetic civic scenario:
 * Bhubaneswar / Odisha / India (English, Hindi, Odia).
 * 
 * Reflects the authoritative 7-factor impact model (Section 6.2) and
 * canonical problem lifecycle statuses (docs/06_DATA_MODEL.md).
 * 
 * This file is completely isolated from production APIs and will be replaced
 * by domain services and database providers in subsequent phases.
 */

export interface MockProblem {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  wardId: string;
  wardName: string;
  impactScore: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  signalCount: number;
  status:
    | 'NEW'
    | 'TRIAGED'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'AWAITING_VERIFICATION'
    | 'RESOLVED'
    | 'CLOSED'
    | 'REOPENED';
  department: string;
  createdAt: string;
  updatedAt: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  impactBreakdown: {
    severity: number;      // Max 25 (25%)
    population: number;    // Max 20 (20%)
    duration: number;      // Max 15 (15%)
    concentration: number; // Max 15 (15%)
    facilities: number;    // Max 10 (10%)
    recurrence: number;    // Max 10 (10%)
    evidence: number;      // Max 5  (5%)
    total: number;
  };
  aiSummary: string;
  whyThisMatters: string[];
  isDemo?: boolean;
  is_demo?: boolean;
  supporting_media_count?: number;
}

export const DEMO_PROBLEMS: MockProblem[] = [
  {
    id: 'PRB-2026-0819',
    title: 'Water Supply Disruption — Nayapalli Ward 18',
    category: 'WATER_SUPPLY',
    subcategory: 'Pipeline Burst',
    wardId: 'WARD-018',
    wardName: 'Ward 18 (Nayapalli, Bhubaneswar)',
    impactScore: 92,
    severity: 'CRITICAL',
    signalCount: 327,
    supporting_media_count: 42,
    isDemo: true,
    is_demo: true,
    status: 'IN_PROGRESS',
    department: 'Water Corporation of Odisha (WATCO)',
    createdAt: '2026-09-04T08:00:00Z',
    updatedAt: '2026-09-07T00:30:00Z',
    location: {
      lat: 20.2961,
      lng: 85.8245,
      address: 'VIP Road, Jayadev Vihar Crossing, Nayapalli, Bhubaneswar',
    },
    impactBreakdown: {
      severity: 24,
      population: 18,
      duration: 14,
      concentration: 14,
      facilities: 9,
      recurrence: 8,
      evidence: 5,
      total: 92,
    },
    aiSummary:
      'High-pressure main transmission line rupture causing street inundation and water outage across Nayapalli corridor. Backup water reserves depleted.',
    whyThisMatters: [
      'Estimated 18,400 residents affected by potable water supply disruption across Nayapalli corridor.',
      'Active water supply outage duration of 72 hours (3 days) exceeding statutory SLA remediation targets.',
      'Critical facility exposure: DAV Public School located directly within affected distribution zone.',
    ],
  },
  {
    id: 'PRB-2026-0820',
    title: 'Feeder Line Tripping & Transformer Sparking',
    category: 'ELECTRICITY',
    subcategory: 'Transformer Sparking',
    wardId: 'WARD-004',
    wardName: 'Ward 04 (Saheed Nagar, Bhubaneswar)',
    impactScore: 86,
    severity: 'HIGH',
    signalCount: 184,
    status: 'ASSIGNED',
    department: 'TP Central Odisha Distribution Limited (TPCODL)',
    createdAt: '2026-09-05T14:15:00Z',
    updatedAt: '2026-09-06T10:30:00Z',
    location: {
      lat: 20.2882,
      lng: 85.8436,
      address: 'Janpath, Block B, Saheed Nagar, Bhubaneswar',
    },
    impactBreakdown: {
      severity: 23,
      population: 18,
      duration: 13,
      concentration: 13,
      facilities: 9,
      recurrence: 6,
      evidence: 4,
      total: 86,
    },
    aiSummary:
      'Heavy arcing on 11kV distribution pole threatening adjacent commercial buildings and market vendors.',
    whyThisMatters: [
      'Commercial market area with high pedestrian footfall.',
      'Frequent voltage spikes reported burning household appliances.',
      'Proximity to Government High School, Saheed Nagar.',
    ],
  },
  {
    id: 'PRB-2026-0821',
    title: 'Arterial Road Cavity & Sewer Collapse',
    category: 'ROADS',
    subcategory: 'Sewer Sinkhole',
    wardId: 'WARD-022',
    wardName: 'Ward 22 (Patia, Bhubaneswar)',
    impactScore: 74,
    severity: 'HIGH',
    signalCount: 92,
    status: 'TRIAGED',
    department: 'Works Department / BMC Road Division',
    createdAt: '2026-09-06T02:00:00Z',
    updatedAt: '2026-09-06T11:45:00Z',
    location: {
      lat: 20.3533,
      lng: 85.8193,
      address: 'KIIT Road, Chandrasekharpur - Patia Corridor, Bhubaneswar',
    },
    impactBreakdown: {
      severity: 20,
      population: 15,
      duration: 11,
      concentration: 11,
      facilities: 7,
      recurrence: 6,
      evidence: 4,
      total: 74,
    },
    aiSummary:
      'Subsurface storm sewer erosion created an 8-foot cavity under the left lane of an arterial bus route.',
    whyThisMatters: [
      'Critical transit route connecting Infocity to Bhubaneswar city center.',
      'Sewer backflow contaminating nearby stormwater drains.',
    ],
  },
  {
    id: 'PRB-2026-0822',
    title: 'Streetlight Blackout Corridor on School Zone',
    category: 'STREETLIGHTS',
    subcategory: 'Circuit Fault',
    wardId: 'WARD-012',
    wardName: 'Ward 12 (Old Town, Bhubaneswar)',
    impactScore: 58,
    severity: 'MEDIUM',
    signalCount: 48,
    status: 'IN_PROGRESS',
    department: 'TP Central Odisha Distribution Limited (TPCODL)',
    createdAt: '2026-09-05T19:00:00Z',
    updatedAt: '2026-09-06T08:00:00Z',
    location: {
      lat: 20.2405,
      lng: 85.8342,
      address: 'Rath Road, Near Lingaraj Temple Area, Old Town, Bhubaneswar',
    },
    impactBreakdown: {
      severity: 15,
      population: 12,
      duration: 9,
      concentration: 8,
      facilities: 6,
      recurrence: 5,
      evidence: 3,
      total: 58,
    },
    aiSummary:
      '1.2 km stretch of LED streetlights inactive due to severed underground feeder cable.',
    whyThisMatters: [
      'Zero evening visibility along historic heritage school crossing zone.',
      'Citizen safety concerns for evening pilgrims and commuters.',
    ],
  },
  {
    id: 'PRB-2026-0823',
    title: 'Solid Waste Dump at Storm Drain Culvert',
    category: 'SANITATION',
    subcategory: 'Drain Blockage',
    wardId: 'WARD-009',
    wardName: 'Ward 09 (Khandagiri, Bhubaneswar)',
    impactScore: 42,
    severity: 'LOW',
    signalCount: 29,
    status: 'RESOLVED',
    department: 'BMC Solid Waste & Sanitation',
    createdAt: '2026-09-04T08:00:00Z',
    updatedAt: '2026-09-06T09:30:00Z',
    location: {
      lat: 20.2589,
      lng: 85.7876,
      address: 'Near Khandagiri Square, NH-16 Service Road, Bhubaneswar',
    },
    impactBreakdown: {
      severity: 11,
      population: 8,
      duration: 6,
      concentration: 6,
      facilities: 5,
      recurrence: 4,
      evidence: 2,
      total: 42,
    },
    aiSummary:
      'Illegal debris dumping blocking secondary storm outlet. Cleared and verified by BMC sanitary inspection crew.',
    whyThisMatters: [
      'Risk of localized waterlogging during evening monsoon showers.',
    ],
  },
];

export const DEMO_KPIS = {
  totalSignals: 12842,
  activeProblems: 1284,
  highImpact: 426,
  resolutionRate: '82%',
  medianResponse: '31 hrs',
  signalsToday: 384,
};

export const DEMO_DEPARTMENTS = [
  {
    name: 'Water Corporation of Odisha (WATCO)',
    active: 82,
    highImpact: 17,
    medianResolution: '29 hrs',
    slaRisk: 4,
  },
  {
    name: 'TP Central Odisha Distribution Limited (TPCODL)',
    active: 64,
    highImpact: 11,
    medianResolution: '18 hrs',
    slaRisk: 2,
  },
  {
    name: 'Works Department / BMC Road Division',
    active: 114,
    highImpact: 26,
    medianResolution: '48 hrs',
    slaRisk: 9,
  },
  {
    name: 'BMC Solid Waste & Sanitation',
    active: 52,
    highImpact: 6,
    medianResolution: '14 hrs',
    slaRisk: 1,
  },
  {
    name: 'Public Health & Vector Control',
    active: 38,
    highImpact: 8,
    medianResolution: '22 hrs',
    slaRisk: 3,
  },
];

export const DEMO_AI_BRIEF = {
  headline: 'Water disruptions remain the primary public impact driver across Bhubaneswar North & Central divisions.',
  summary:
    'Ward 18 Nayapalli accounts for 61% of all critical water impact, centering around a main line fracture on VIP Road affecting ~18,400 residents.',
  recommendedAction:
    'Expedite WATCO Valve 4B replacement and coordinate with TPCODL to prevent transformer flooding in adjacent basements.',
  confidence: '94%',
  sourcesCount: 327,
};
