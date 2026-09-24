/**
 * CivicPulse Development Demand Intelligence — Synthetic DEMO_MODE Dataset
 * 
 * Phase: 15B.5.3.20-HF7.7
 * 
 * Strict Production Invariants:
 * 1. EVERY record carries `is_demo: true` and explicit synthetic provenance.
 * 2. This dataset is exclusively served when `DEMO_MODE=true` or when demo fixtures are requested.
 * 3. REAL_MODE strictly excludes these records and returns honest empty states if no
 *    production development demand records exist.
 * 4. Grounded in real Bhubaneswar ward geography (Ward 18, 27, 41, 52) and deterministic
 *    HF7.5 metric scoring.
 * 5. Zero citizen PII, zero officer UUIDs, zero household GPS.
 */

import {
  DemandCluster,
  NormalizedDemandSignal,
  DeterministicDemandMetrics,
  DevelopmentIndicator,
  PublicInvestmentRecord,
  DemandSignalSourceChannel,
  DemandPriorityBand,
  DevelopmentOpportunity,
  DevelopmentOpportunityStatus
} from '@civicpulse/shared';

export interface DemoDemandScenario {
  cluster: DemandCluster;
  signals: any[];
  metrics: DeterministicDemandMetrics;
  indicators: any[];
  investments: any[];
  opportunity: DevelopmentOpportunity;
}


export const DEMO_DEVELOPMENT_DEMAND_SCENARIOS: DemoDemandScenario[] = [
  // ==========================================================================
  // SCENARIO 1: DRINKING WATER — WARD 18 (Khandagiri)
  // ==========================================================================
  {
    cluster: {
      id: 'dclust_demo_water_w18',
      title: 'Drinking Water Pipeline & Low Pressure Deficit — Ward 18 (Khandagiri)',
      category: 'drinking_water',
      ward_ids: ['WARD-018'],
      locality_names: ['Khandagiri Sector 4', 'Baramunda Border'],
      centroid: { lat: 20.255, lng: 85.782 },
      signal_count: 5,
      first_signal_at: '2026-02-15T08:30:00.000Z',
      last_signal_at: '2026-03-12T14:45:00.000Z',
      duration_days: 25.3,
      is_demo: true,
      created_at: '2026-02-15T08:30:00.000Z',
      updated_at: '2026-03-12T14:45:00.000Z'
    },
    signals: [
      {
        id: 'dsig_w18_01',
        signal_id: 'dsig_w18_01',
        normalized_text: 'Ward 18 Khandagiri faces irregular drinking water supply with low pressure during morning peak hours.',
        detected_category: 'drinking_water',
        detected_language: 'en',
        ward_id: 'WARD-018',
        channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
        confidence_score: 0.95,
        submitted_at: '2026-02-15T08:30:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
          normalization_version: 'v1',
          normalized_at: '2026-02-15T08:35:00.000Z'
        }
      },
      {
        id: 'dsig_w18_02',
        signal_id: 'dsig_w18_02',
        normalized_text: 'Khandagiri Sector 4 residents require municipal water tanker deliveries due to lack of piped mainline connection.',
        detected_category: 'drinking_water',
        detected_language: 'en',
        ward_id: 'WARD-018',
        channel: DemandSignalSourceChannel.WEB_FORM,
        confidence_score: 0.92,
        submitted_at: '2026-02-22T11:20:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2026-02-22T11:25:00.000Z'
        }
      },
      {
        id: 'dsig_w18_03',
        signal_id: 'dsig_w18_03',
        normalized_text: 'Pipeline tail-end houses receiving zero water pressure for past three weeks.',
        detected_category: 'drinking_water',
        detected_language: 'en',
        ward_id: 'WARD-018',
        channel: DemandSignalSourceChannel.VOICE_TRANSCRIPT,
        confidence_score: 0.89,
        submitted_at: '2026-03-01T09:15:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.VOICE_TRANSCRIPT,
          normalization_version: 'v1',
          normalized_at: '2026-03-01T09:20:00.000Z'
        }
      },
      {
        id: 'dsig_w18_04',
        signal_id: 'dsig_w18_04',
        normalized_text: 'Community tap standpipe in Khandagiri non-functional; request new distribution feeder line.',
        detected_category: 'drinking_water',
        detected_language: 'en',
        ward_id: 'WARD-018',
        channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
        confidence_score: 0.94,
        submitted_at: '2026-03-08T16:00:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
          normalization_version: 'v1',
          normalized_at: '2026-03-08T16:05:00.000Z'
        }
      },
      {
        id: 'dsig_w18_05',
        signal_id: 'dsig_w18_05',
        normalized_text: 'Water supply available only 45 minutes daily; demand dedicated overhead tank connection for Sector 4.',
        detected_category: 'drinking_water',
        detected_language: 'en',
        ward_id: 'WARD-018',
        channel: DemandSignalSourceChannel.WEB_FORM,
        confidence_score: 0.91,
        submitted_at: '2026-03-12T14:45:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2026-03-12T14:50:00.000Z'
        }
      }
    ],
    metrics: {
      demand_volume_score: 11,
      recurrence_score: 14,
      geographic_concentration_score: 10,
      population_exposure_score: 10,
      infrastructure_deficit_score: 9,
      investment_gap_score: 5,
      composite_demand_index: 59
    },
    indicators: [
      {
        ward_id: 'WARD-018',
        sector: 'drinking_water',
        source_agency: 'WATCO_SURVEY_2025',
        metric_name: 'piped_water_coverage_pct',
        metric_value: 48.2,
        metric_unit: 'percentage',
        metric_benchmark: 85.0,
        deficit_score: 8.5,
        is_demo: true,
        last_updated: '2025-11-01T00:00:00.000Z'
      }
    ],
    investments: [
      {
        id: 'inv_demo_w18_01',
        project_title: 'Ward 18 Distribution Feeder Extension',
        scheme_name: 'AMRUT 2.0',
        category: 'drinking_water',
        ward_ids: ['WARD-018'],
        status: 'PLANNED',
        documented_budget: 18500000,
        currency: 'INR',
        announcement_date: '2024-08-15',
        source_agency: 'WATCO',
        source_url: 'https://watcoodisha.in/projects/amrut-w18',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2024-08-15T00:00:00.000Z'
        }
      }
    ],
    opportunity: {
      id: 'opp_demo_w18_water',
      title: 'Candidate Development Opportunity: Piped Water Feeder Extension — Ward 18',
      category: 'drinking_water',
      ward_id: 'WARD-018',
      demand_cluster_id: 'dclust_demo_water_w18',
      priority_band: DemandPriorityBand.MEDIUM,
      metrics: {
        demand_volume_score: 11,
        recurrence_score: 14,
        geographic_concentration_score: 10,
        population_exposure_score: 10,
        infrastructure_deficit_score: 9,
        investment_gap_score: 5,
        composite_demand_index: 59
      },
      narrative_justification: 'Consistent citizen demand density and surveyed 48.2% piped coverage support municipal review of AMRUT 2.0 feeder execution in Khandagiri Sector 4.',
      uncertainty_notes: ['WATCO survey data is from November 2025; ongoing booster upgrades may affect deficit level.'],
      status: DevelopmentOpportunityStatus.SURFACED,
      is_demo: true,
      created_at: '2026-03-12T15:00:00.000Z'
    }
  },

  // ==========================================================================
  // SCENARIO 2: DRAINAGE & STORMWATER — WARD 27 (Nayapalli)
  // ==========================================================================
  {
    cluster: {
      id: 'dclust_demo_drainage_w27',
      title: 'Stormwater Outfall & Culvert Desiltation Need — Ward 27 (Nayapalli)',
      category: 'drainage_flood_stormwater',
      ward_ids: ['WARD-027'],
      locality_names: ['Nayapalli Nuasahi', 'VIP Road Crossing'],
      centroid: { lat: 20.297, lng: 85.824 },
      signal_count: 6,
      first_signal_at: '2026-01-20T10:15:00.000Z',
      last_signal_at: '2026-03-15T18:00:00.000Z',
      duration_days: 54.3,
      is_demo: true,
      created_at: '2026-01-20T10:15:00.000Z',
      updated_at: '2026-03-15T18:00:00.000Z'
    },
    signals: [
      {
        id: 'dsig_w27_01',
        signal_id: 'dsig_w27_01',
        normalized_text: 'Nayapalli Nuasahi drain overflows even during mild rains causing water stagnation on arterial road.',
        detected_category: 'drainage_flood_stormwater',
        detected_language: 'en',
        ward_id: 'WARD-027',
        channel: DemandSignalSourceChannel.WEB_FORM,
        confidence_score: 0.96,
        submitted_at: '2026-01-20T10:15:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2026-01-20T10:20:00.000Z'
        }
      },
      {
        id: 'dsig_w27_02',
        signal_id: 'dsig_w27_02',
        normalized_text: 'Primary stormwater channel blocked with silt and debris near VIP road culvert.',
        detected_category: 'drainage_flood_stormwater',
        detected_language: 'en',
        ward_id: 'WARD-027',
        channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
        confidence_score: 0.93,
        submitted_at: '2026-02-05T14:30:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
          normalization_version: 'v1',
          normalized_at: '2026-02-05T14:35:00.000Z'
        }
      },
      {
        id: 'dsig_w27_03',
        signal_id: 'dsig_w27_03',
        normalized_text: 'Inadequate drain width causes backflow into residential basements during monsoon.',
        detected_category: 'drainage_flood_stormwater',
        detected_language: 'en',
        ward_id: 'WARD-027',
        channel: DemandSignalSourceChannel.VOICE_TRANSCRIPT,
        confidence_score: 0.91,
        submitted_at: '2026-02-18T16:45:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.VOICE_TRANSCRIPT,
          normalization_version: 'v1',
          normalized_at: '2026-02-18T16:50:00.000Z'
        }
      },
      {
        id: 'dsig_w27_04',
        signal_id: 'dsig_w27_04',
        normalized_text: 'Request concrete side drains and proper outfall grading to primary storm channel 10.',
        detected_category: 'drainage_flood_stormwater',
        detected_language: 'en',
        ward_id: 'WARD-027',
        channel: DemandSignalSourceChannel.WEB_FORM,
        confidence_score: 0.95,
        submitted_at: '2026-03-02T11:10:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2026-03-02T11:15:00.000Z'
        }
      },
      {
        id: 'dsig_w27_05',
        signal_id: 'dsig_w27_05',
        normalized_text: 'Culvert reconstruction urgently required; traffic halted during pre-monsoon shower.',
        detected_category: 'drainage_flood_stormwater',
        detected_language: 'en',
        ward_id: 'WARD-027',
        channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
        confidence_score: 0.92,
        submitted_at: '2026-03-10T12:00:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
          normalization_version: 'v1',
          normalized_at: '2026-03-10T12:05:00.000Z'
        }
      },
      {
        id: 'dsig_w27_06',
        signal_id: 'dsig_w27_06',
        normalized_text: 'Drain desilting and widening needed before June to prevent repeat waterlogging.',
        detected_category: 'drainage_flood_stormwater',
        detected_language: 'en',
        ward_id: 'WARD-027',
        channel: DemandSignalSourceChannel.WEB_FORM,
        confidence_score: 0.94,
        submitted_at: '2026-03-15T18:00:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2026-03-15T18:05:00.000Z'
        }
      }
    ],
    metrics: {
      demand_volume_score: 13,
      recurrence_score: 16,
      geographic_concentration_score: 12,
      population_exposure_score: 12,
      infrastructure_deficit_score: 11,
      investment_gap_score: 8,
      composite_demand_index: 72
    },
    indicators: [
      {
        ward_id: 'WARD-027',
        sector: 'drainage_flood_stormwater',
        source_agency: 'BMC_DRAINAGE_AUDIT_2025',
        metric_name: 'stormwater_carrying_capacity_pct',
        metric_value: 38.0,
        metric_unit: 'percentage',
        metric_benchmark: 100.0,
        deficit_score: 12.0,
        is_demo: true,
        last_updated: '2025-10-15T00:00:00.000Z'
      }
    ],
    // Intentionally empty public investments to showcase missing investment context
    investments: [],
    opportunity: {
      id: 'opp_demo_w27_drainage',
      title: 'Candidate Development Opportunity: Stormwater Outfall & Culvert Upgradation — Ward 27',
      category: 'drainage_flood_stormwater',
      ward_id: 'WARD-027',
      demand_cluster_id: 'dclust_demo_drainage_w27',
      priority_band: DemandPriorityBand.HIGH,
      metrics: {
        demand_volume_score: 13,
        recurrence_score: 16,
        geographic_concentration_score: 12,
        population_exposure_score: 12,
        infrastructure_deficit_score: 11,
        investment_gap_score: 8,
        composite_demand_index: 72
      },
      narrative_justification: 'High recurrence demand (16/20) and audited 38% stormwater capacity indicate potential flood vulnerability requiring pre-monsoon desilting and culvert assessment.',
      uncertainty_notes: ['No verified public investment records available in repository for this ward/sector; gap cannot be confirmed from authoritative sources.'],
      status: DevelopmentOpportunityStatus.SURFACED,
      is_demo: true,
      created_at: '2026-03-15T18:30:00.000Z'
    }
  },

  // ==========================================================================
  // SCENARIO 3: HEALTHCARE ACCESSIBILITY — WARD 52 (GGP Colony / Rasulgarh)
  // ==========================================================================
  {
    cluster: {
      id: 'dclust_demo_health_w52',
      title: 'Urban Primary Health Centre Expansion Demand — Ward 52 (GGP Colony)',
      category: 'healthcare_accessibility',
      ward_ids: ['WARD-052'],
      locality_names: ['GGP Colony', 'Rasulgarh Industrial Fringe'],
      centroid: { lat: 20.288, lng: 85.867 },
      signal_count: 4,
      first_signal_at: '2026-02-01T11:00:00.000Z',
      last_signal_at: '2026-03-05T13:30:00.000Z',
      duration_days: 32.1,
      is_demo: true,
      created_at: '2026-02-01T11:00:00.000Z',
      updated_at: '2026-03-05T13:30:00.000Z'
    },
    signals: [
      {
        id: 'dsig_w52_01',
        signal_id: 'dsig_w52_01',
        normalized_text: 'Residents of GGP Colony must travel over 4 km to nearest government dispensaries for routine maternal and infant care.',
        detected_category: 'healthcare_accessibility',
        detected_language: 'en',
        ward_id: 'WARD-052',
        channel: DemandSignalSourceChannel.WEB_FORM,
        confidence_score: 0.94,
        submitted_at: '2026-02-01T11:00:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2026-02-01T11:05:00.000Z'
        }
      },
      {
        id: 'dsig_w52_02',
        signal_id: 'dsig_w52_02',
        normalized_text: 'Elderly citizens requesting weekly doctor consultation clinic and diagnostic center inside Ward 52.',
        detected_category: 'healthcare_accessibility',
        detected_language: 'en',
        ward_id: 'WARD-052',
        channel: DemandSignalSourceChannel.VOICE_TRANSCRIPT,
        confidence_score: 0.91,
        submitted_at: '2026-02-12T15:20:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.VOICE_TRANSCRIPT,
          normalization_version: 'v1',
          normalized_at: '2026-02-12T15:25:00.000Z'
        }
      },
      {
        id: 'dsig_w52_03',
        signal_id: 'dsig_w52_03',
        normalized_text: 'Demand for Urban Health and Wellness Centre (Ayushman Bharat) near community hall.',
        detected_category: 'healthcare_accessibility',
        detected_language: 'en',
        ward_id: 'WARD-052',
        channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
        confidence_score: 0.93,
        submitted_at: '2026-02-25T10:40:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
          normalization_version: 'v1',
          normalized_at: '2026-02-25T10:45:00.000Z'
        }
      },
      {
        id: 'dsig_w52_04',
        signal_id: 'dsig_w52_04',
        normalized_text: 'Lack of emergency primary medical aid in industrial fringe; need dedicated health post.',
        detected_category: 'healthcare_accessibility',
        detected_language: 'en',
        ward_id: 'WARD-052',
        channel: DemandSignalSourceChannel.WEB_FORM,
        confidence_score: 0.9,
        submitted_at: '2026-03-05T13:30:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2026-03-05T13:35:00.000Z'
        }
      }
    ],
    metrics: {
      demand_volume_score: 10,
      recurrence_score: 12,
      geographic_concentration_score: 9,
      population_exposure_score: 11,
      infrastructure_deficit_score: 10,
      investment_gap_score: 4,
      composite_demand_index: 56
    },
    indicators: [
      {
        ward_id: 'WARD-052',
        sector: 'healthcare_accessibility',
        source_agency: 'H_FW_ODISHA_2025',
        metric_name: 'uphc_access_distance_km',
        metric_value: 4.1,
        metric_unit: 'kilometers',
        metric_benchmark: 1.5,
        deficit_score: 9.8,
        is_demo: true,
        last_updated: '2025-09-01T00:00:00.000Z'
      }
    ],
    investments: [
      {
        id: 'inv_demo_w52_01',
        project_title: 'NHM Urban Health and Wellness Centre Upgradation',
        scheme_name: 'National Health Mission',
        category: 'healthcare_accessibility',
        ward_ids: ['WARD-052'],
        status: 'TENDERED',
        documented_budget: 6500000,
        currency: 'INR',
        announcement_date: '2025-01-10',
        source_agency: 'Health and Family Welfare Department',
        source_url: 'https://health.odisha.gov.in/tenders/nhm-w52',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2025-01-10T00:00:00.000Z'
        }
      }
    ],
    opportunity: {
      id: 'opp_demo_w52_health',
      title: 'Candidate Development Opportunity: Urban Health Post Operationalization — Ward 52',
      category: 'healthcare_accessibility',
      ward_id: 'WARD-052',
      demand_cluster_id: 'dclust_demo_health_w52',
      priority_band: DemandPriorityBand.MEDIUM,
      metrics: {
        demand_volume_score: 10,
        recurrence_score: 12,
        geographic_concentration_score: 9,
        population_exposure_score: 11,
        infrastructure_deficit_score: 10,
        investment_gap_score: 4,
        composite_demand_index: 56
      },
      narrative_justification: 'Average 4.1 km travel distance to primary health facilities combined with 4 voluntary civic signals supports expediting NHM tendered health post construction.',
      uncertainty_notes: ['NHM project status is tendered; site handover verification pending.'],
      status: DevelopmentOpportunityStatus.SURFACED,
      is_demo: true,
      created_at: '2026-03-05T14:00:00.000Z'
    }
  },

  // ==========================================================================
  // SCENARIO 4: EDUCATIONAL FACILITIES — WARD 41 (Old Town)
  // ==========================================================================
  {
    cluster: {
      id: 'dclust_demo_edu_w41',
      title: 'Municipal High School Science Lab & Classroom Need — Ward 41 (Old Town)',
      category: 'educational_facilities',
      ward_ids: ['WARD-041'],
      locality_names: ['Old Town Lingaraj Environs', 'Rath Road'],
      centroid: { lat: 20.243, lng: 85.836 },
      signal_count: 4,
      first_signal_at: '2026-01-15T09:00:00.000Z',
      last_signal_at: '2026-02-28T17:15:00.000Z',
      duration_days: 44.3,
      is_demo: true,
      created_at: '2026-01-15T09:00:00.000Z',
      updated_at: '2026-02-28T17:15:00.000Z'
    },
    signals: [
      {
        id: 'dsig_w41_01',
        signal_id: 'dsig_w41_01',
        normalized_text: 'Old Town Government High School lacks dedicated laboratory facilities and smart classroom space for secondary students.',
        detected_category: 'educational_facilities',
        detected_language: 'en',
        ward_id: 'WARD-041',
        channel: DemandSignalSourceChannel.WEB_FORM,
        confidence_score: 0.95,
        submitted_at: '2026-01-15T09:00:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2026-01-15T09:05:00.000Z'
        }
      },
      {
        id: 'dsig_w41_02',
        signal_id: 'dsig_w41_02',
        normalized_text: 'High student-to-classroom ratio in Old Town municipal school causes split shifts; demand additional 4 classroom block.',
        detected_category: 'educational_facilities',
        detected_language: 'en',
        ward_id: 'WARD-041',
        channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
        confidence_score: 0.92,
        submitted_at: '2026-01-30T14:10:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
          normalization_version: 'v1',
          normalized_at: '2026-01-30T14:15:00.000Z'
        }
      },
      {
        id: 'dsig_w41_03',
        signal_id: 'dsig_w41_03',
        normalized_text: 'Boundary wall and sanitation block renewal needed for girls high school on Rath Road.',
        detected_category: 'educational_facilities',
        detected_language: 'en',
        ward_id: 'WARD-041',
        channel: DemandSignalSourceChannel.WEB_FORM,
        confidence_score: 0.9,
        submitted_at: '2026-02-14T11:45:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2026-02-14T11:50:00.000Z'
        }
      },
      {
        id: 'dsig_w41_04',
        signal_id: 'dsig_w41_04',
        normalized_text: 'Parents association petition for modern computer laboratory under Odisha 5T school scheme.',
        detected_category: 'educational_facilities',
        detected_language: 'en',
        ward_id: 'WARD-041',
        channel: DemandSignalSourceChannel.VOICE_TRANSCRIPT,
        confidence_score: 0.93,
        submitted_at: '2026-02-28T17:15:00.000Z',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.VOICE_TRANSCRIPT,
          normalization_version: 'v1',
          normalized_at: '2026-02-28T17:20:00.000Z'
        }
      }
    ],
    metrics: {
      demand_volume_score: 9,
      recurrence_score: 11,
      geographic_concentration_score: 8,
      population_exposure_score: 8,
      infrastructure_deficit_score: 7,
      investment_gap_score: 3,
      composite_demand_index: 46
    },
    indicators: [
      {
        ward_id: 'WARD-041',
        sector: 'educational_facilities',
        source_agency: 'S_ME_ODISHA_UDISE_2025',
        metric_name: 'student_classroom_ratio',
        metric_value: 48.0,
        metric_unit: 'ratio',
        metric_benchmark: 30.0,
        deficit_score: 7.2,
        is_demo: true,
        last_updated: '2025-12-01T00:00:00.000Z'
      }
    ],
    investments: [
      {
        id: 'inv_demo_w41_01',
        project_title: '5T High School Transformation Phase 3',
        scheme_name: '5T High School Transformation',
        category: 'educational_facilities',
        ward_ids: ['WARD-041'],
        status: 'COMPLETED',
        documented_budget: 4500000,
        currency: 'INR',
        announcement_date: '2023-11-14',
        source_agency: 'School and Mass Education Department',
        source_url: 'https://sme.odisha.gov.in/5t-schools',
        is_demo: true,
        provenance: {
          source_channel: DemandSignalSourceChannel.WEB_FORM,
          normalization_version: 'v1',
          normalized_at: '2023-11-14T00:00:00.000Z'
        }
      }
    ],
    opportunity: {
      id: 'opp_demo_w41_edu',
      title: 'Candidate Development Opportunity: Secondary Classroom & Lab Expansion — Ward 41',
      category: 'educational_facilities',
      ward_id: 'WARD-041',
      demand_cluster_id: 'dclust_demo_edu_w41',
      priority_band: DemandPriorityBand.MEDIUM,
      metrics: {
        demand_volume_score: 9,
        recurrence_score: 11,
        geographic_concentration_score: 8,
        population_exposure_score: 8,
        infrastructure_deficit_score: 7,
        investment_gap_score: 3,
        composite_demand_index: 46
      },
      narrative_justification: 'UDISE ratio of 48 students per classroom exceeds benchmark (30.0), with citizen signals supporting phase-expanded classroom infrastructure.',
      uncertainty_notes: ['Phase 3 completed in 2023; current demand addresses subsequent student enrollment expansion.'],
      status: DevelopmentOpportunityStatus.SURFACED,
      is_demo: true,
      created_at: '2026-03-01T10:00:00.000Z'
    }
  }
];
