/**
 * STATIC UI PLACEHOLDER DATA
 * 
 * Used STRICTLY for visual development and component layout during Phase 1.
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
  status: 'NEW' | 'TRIAGED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLUTION_SUBMITTED' | 'VERIFIED_RESOLVED' | 'CLOSED';
  department: string;
  createdAt: string;
  updatedAt: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  impactBreakdown: {
    population: number; // 0-30
    severity: number;   // 0-25
    spread: number;     // 0-20
    duration: number;   // 0-15
    facilities: number; // 0-10
    total: number;
  };
  aiSummary: string;
  whyThisMatters: string[];
}

export const DEMO_PROBLEMS: MockProblem[] = [
  {
    id: 'PRB-2026-0819',
    title: 'Ward 18 Main Distribution Rupture & Submersion',
    category: 'WATER_SUPPLY',
    subcategory: 'Pipeline Burst',
    wardId: 'WARD-018',
    wardName: 'Ward 18 (Indiranagar)',
    impactScore: 92,
    severity: 'CRITICAL',
    signalCount: 327,
    status: 'IN_PROGRESS',
    department: 'Water Board (BWSSB)',
    createdAt: '2026-09-05T06:30:00Z',
    updatedAt: '2026-09-06T12:00:00Z',
    location: {
      lat: 12.9784,
      lng: 77.6408,
      address: '4th Cross, 100ft Road, Indiranagar, Bengaluru',
    },
    impactBreakdown: {
      population: 28,
      severity: 24,
      spread: 18,
      duration: 13,
      facilities: 9,
      total: 92,
    },
    aiSummary:
      'High-pressure main transmission line rupture causing street inundation across 4 residential blocks. Backup water reserves depleted.',
    whyThisMatters: [
      'Over 14,200 residents without potable water for 28+ hours.',
      'St. Mary\'s District Clinic located 400m downstream with critical dialysis needs.',
      'Roadway undermining poses structural collapse risk for transit buses.',
    ],
  },
  {
    id: 'PRB-2026-0820',
    title: 'Feeder Line Tripping & Transformer Sparking',
    category: 'ELECTRICITY',
    subcategory: 'Transformer Sparking',
    wardId: 'WARD-004',
    wardName: 'Ward 04 (Malleshwaram)',
    impactScore: 86,
    severity: 'HIGH',
    signalCount: 184,
    status: 'ASSIGNED',
    department: 'Electricity Supply (BESCOM)',
    createdAt: '2026-09-05T14:15:00Z',
    updatedAt: '2026-09-06T10:30:00Z',
    location: {
      lat: 13.0031,
      lng: 77.5643,
      address: '8th Main, Margosa Road, Malleshwaram',
    },
    impactBreakdown: {
      population: 24,
      severity: 23,
      spread: 16,
      duration: 14,
      facilities: 9,
      total: 86,
    },
    aiSummary:
      'Heavy arcing on 11kV distribution pole threatening adjacent commercial buildings and street vendors.',
    whyThisMatters: [
      'Commercial market area with high pedestrian footfall.',
      'Frequent voltage spikes reported burning household appliances.',
      'Proximity to Government Girls High School.',
    ],
  },
  {
    id: 'PRB-2026-0821',
    title: 'Arterial Road Cavity & Sewer Collapse',
    category: 'ROADS',
    subcategory: 'Sewer Sinkhole',
    wardId: 'WARD-022',
    wardName: 'Ward 22 (Koramangala)',
    impactScore: 74,
    severity: 'HIGH',
    signalCount: 92,
    status: 'TRIAGED',
    department: 'Roads & Infrastructure (BBMP)',
    createdAt: '2026-09-06T02:00:00Z',
    updatedAt: '2026-09-06T11:45:00Z',
    location: {
      lat: 12.9352,
      lng: 77.6245,
      address: '80 Feet Road, 4th Block, Koramangala',
    },
    impactBreakdown: {
      population: 20,
      severity: 21,
      spread: 15,
      duration: 11,
      facilities: 7,
      total: 74,
    },
    aiSummary:
      'Subsurface sewer erosion created an 8-foot cavity under the left lane of an arterial bus route.',
    whyThisMatters: [
      'Critical transit route connecting Outer Ring Road to city center.',
      'Sewer backflow contaminating nearby stormwater drains.',
    ],
  },
  {
    id: 'PRB-2026-0822',
    title: 'Streetlight Blackout Corridor on School Zone',
    category: 'STREETLIGHTS',
    subcategory: 'Circuit Fault',
    wardId: 'WARD-012',
    wardName: 'Ward 12 (Rajajinagar)',
    impactScore: 58,
    severity: 'MEDIUM',
    signalCount: 48,
    status: 'IN_PROGRESS',
    department: 'Electricity Supply (BESCOM)',
    createdAt: '2026-09-05T19:00:00Z',
    updatedAt: '2026-09-06T08:00:00Z',
    location: {
      lat: 12.9915,
      lng: 77.5523,
      address: 'Dr. Rajkumar Road, 2nd Stage, Rajajinagar',
    },
    impactBreakdown: {
      population: 16,
      severity: 14,
      spread: 12,
      duration: 10,
      facilities: 6,
      total: 58,
    },
    aiSummary:
      '1.2 km stretch of LED streetlights inactive due to severed underground feeder cable.',
    whyThisMatters: [
      'Zero evening visibility along school crossing zone.',
      'Citizen safety concerns for evening commuters.',
    ],
  },
  {
    id: 'PRB-2026-0823',
    title: 'Solid Waste Dump at Storm Drain Culvert',
    category: 'SANITATION',
    subcategory: 'Drain Blockage',
    wardId: 'WARD-009',
    wardName: 'Ward 09 (Jayanagar)',
    impactScore: 42,
    severity: 'LOW',
    signalCount: 29,
    status: 'VERIFIED_RESOLVED',
    department: 'Solid Waste Management (BBMP)',
    createdAt: '2026-09-04T08:00:00Z',
    updatedAt: '2026-09-06T09:30:00Z',
    location: {
      lat: 12.9308,
      lng: 77.5838,
      address: '11th Main, 4th Block, Jayanagar',
    },
    impactBreakdown: {
      population: 12,
      severity: 10,
      spread: 8,
      duration: 7,
      facilities: 5,
      total: 42,
    },
    aiSummary:
      'Illegal debris dumping blocking secondary storm outlet. Cleared and verified by field crew.',
    whyThisMatters: [
      'Risk of localized waterlogging during evening showers.',
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
    name: 'Water Board (BWSSB)',
    active: 82,
    highImpact: 17,
    medianResolution: '29 hrs',
    slaRisk: 4,
  },
  {
    name: 'Electricity Supply (BESCOM)',
    active: 64,
    highImpact: 11,
    medianResolution: '18 hrs',
    slaRisk: 2,
  },
  {
    name: 'Roads & Infrastructure (BBMP)',
    active: 114,
    highImpact: 26,
    medianResolution: '48 hrs',
    slaRisk: 9,
  },
  {
    name: 'Solid Waste Management (BBMP)',
    active: 52,
    highImpact: 6,
    medianResolution: '14 hrs',
    slaRisk: 1,
  },
  {
    name: 'Health & Sanitation',
    active: 38,
    highImpact: 8,
    medianResolution: '22 hrs',
    slaRisk: 3,
  },
];

export const DEMO_AI_BRIEF = {
  headline: 'Water disruptions remain the primary public impact driver across Eastern Divisions.',
  summary:
    'Ward 18 Indiranagar accounts for 61% of all critical water impact, centering around a main line fracture on 4th Cross affecting ~14,200 residents.',
  recommendedAction:
    'Expedite BWSSB Valve 4B replacement and coordinate with BESCOM to prevent transformer flooding in adjacent basements.',
  confidence: '94%',
  sourcesCount: 327,
};
