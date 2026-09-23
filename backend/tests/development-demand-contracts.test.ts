import { describe, it, expect } from 'vitest';
import {
  // Types & Enums
  DemandSignalSourceChannel,
  DevelopmentOpportunityStatus,
  PublicInvestmentStatus,
  DemandEvidenceType,
  DemandPriorityBand,
  NormalizedDemandSignal,
  DemandCluster,
  DevelopmentDemand,
  DevelopmentIndicator,
  PublicInvestmentRecord,
  DevelopmentOpportunity,
  DemandEvidence,
  DemandAnalysisRun,
  DevelopmentDemandAnalysisResponse,
  IDevelopmentIndicatorProvider,
  IPublicInvestmentProvider,

  // Taxonomy
  DEVELOPMENT_DEMAND_SECTORS,
  DEVELOPMENT_DEMAND_TAXONOMY,
  DevelopmentDemandSector,

  // Schemas
  NormalizedDemandSignalSchema,
  DemandClusterSchema,
  DevelopmentDemandSchema,
  DevelopmentIndicatorSchema,
  PublicInvestmentRecordSchema,
  DevelopmentOpportunitySchema,
  DemandEvidenceSchema,
  DemandAnalysisRunSchema,
  DeterministicDemandMetricsSchema,
  DevelopmentDemandAnalysisResponseSchema,
  DevelopmentDemandAnalyzeRequestSchema,
  DevelopmentDemandQuerySchema,
  UntrustedNarrativeSchema
} from '@civicpulse/shared';

describe('PHASE 15B.5.3.20-HF7.1 — Development Demand Contracts Suite', () => {
  // ==========================================================================
  // 1. Core Domain Types Validation
  // ==========================================================================
  describe('1. Core Domain Entities Schema Validation', () => {
    it('validates a correct NormalizedDemandSignal entity', () => {
      const signal: NormalizedDemandSignal = {
        id: 'dsig_test_101',
        source_channel: DemandSignalSourceChannel.WEB_FORM,
        original_language: 'or',
        original_text: 'ଆମ ୱାର୍ଡ ୧୯ ରେ ନୂତନ ପାନୀୟ ଜଳ ପାଇପଲାଇନ ସଂଯୋଗ ଦରକାର।',
        normalized_language: 'en',
        normalized_text: 'New drinking water pipeline connection needed in Ward 19 residential expansion area.',
        normalization_confidence: 0.95,
        detected_category: 'drinking_water',
        detected_urgency: 'HIGH',
        ward_id: 'WARD-019',
        locality_name: 'GGP Colony Expansion Zone',
        is_demo: true,
        submitted_at: '2026-09-24T02:00:00.000Z',
        ingested_at: '2026-09-24T02:01:00.000Z'
      };

      const result = NormalizedDemandSignalSchema.safeParse(signal);
      expect(result.success).toBe(true);
    });

    it('validates a correct DemandCluster entity', () => {
      const cluster: DemandCluster = {
        id: 'dclust_test_201',
        title: 'Ward 19 Drinking Water Distribution Expansion',
        category: 'drinking_water',
        subcategory: 'pipeline_extension',
        ward_ids: ['WARD-019'],
        locality_names: ['GGP Colony Extension'],
        centroid: { lat: 20.293, lng: 85.865 },
        signal_count: 24,
        first_signal_at: '2026-08-01T10:00:00.000Z',
        last_signal_at: '2026-09-24T02:00:00.000Z',
        duration_days: 54,
        is_demo: true,
        created_at: '2026-08-01T10:00:00.000Z'
      };

      const result = DemandClusterSchema.safeParse(cluster);
      expect(result.success).toBe(true);
    });

    it('validates a correct DevelopmentDemand entity', () => {
      const demand: DevelopmentDemand = {
        id: 'ddmd_test_301',
        title: 'Ward 19 Piped Potable Water Distribution System',
        category: 'drinking_water',
        ward_id: 'WARD-019',
        locality_name: 'GGP Colony Extension',
        demand_cluster_id: 'dclust_test_201',
        status: DevelopmentOpportunityStatus.SURFACED,
        signal_count: 24,
        first_reported_at: '2026-08-01T10:00:00.000Z',
        last_reported_at: '2026-09-24T02:00:00.000Z',
        is_demo: true,
        created_at: '2026-08-01T10:00:00.000Z'
      };

      const result = DevelopmentDemandSchema.safeParse(demand);
      expect(result.success).toBe(true);
    });

    it('validates a correct DevelopmentIndicator entity', () => {
      const indicator: DevelopmentIndicator = {
        id: 'ind_test_401',
        ward_id: 'WARD-019',
        indicator_type: 'INFRASTRUCTURE_COVERAGE',
        name: 'Piped Water Coverage Percentage',
        value: 58.5,
        unit: '%',
        measurement_date: '2026-01-15T00:00:00.000Z',
        source: 'WATCO Municipal Baseline Audit 2026',
        confidence: 0.92,
        provenance: {
          is_demo: true,
          source: 'WATCO_AUDIT',
          measurement_context: 'Annual Departmental Assessment'
        }
      };

      const result = DevelopmentIndicatorSchema.safeParse(indicator);
      expect(result.success).toBe(true);
    });

    it('validates a correct PublicInvestmentRecord entity', () => {
      const investment: PublicInvestmentRecord = {
        id: 'inv_test_501',
        plan_name: 'AMRUT 2.0 Urban Water Distribution Modernization',
        project_id: 'AMRUT-WAT-2026-019',
        category: 'drinking_water',
        ward_ids: ['WARD-019', 'WARD-020'],
        status: PublicInvestmentStatus.APPROVED,
        documented_budget: 45000000,
        currency: 'INR',
        announcement_date: '2026-03-01T00:00:00.000Z',
        source_agency: 'Housing & Urban Development Department, Govt of Odisha',
        source_url: 'https://urban.odisha.gov.in/schemes/amrut-2-watco-019',
        provenance: {
          is_demo: true,
          source: 'STATE_BUDGET_GAZETTE'
        }
      };

      const result = PublicInvestmentRecordSchema.safeParse(investment);
      expect(result.success).toBe(true);
    });

    it('validates a correct DevelopmentOpportunity entity', () => {
      const opportunity: DevelopmentOpportunity = {
        id: 'opp_test_601',
        title: 'Upgrade & Extend 150mm Drinking Water Main in Ward 19',
        category: 'drinking_water',
        ward_id: 'WARD-019',
        demand_cluster_id: 'dclust_test_201',
        priority_band: DemandPriorityBand.HIGH,
        metrics: {
          demand_volume_score: 18,
          recurrence_score: 16,
          geographic_concentration_score: 12,
          population_exposure_score: 13,
          infrastructure_deficit_score: 11,
          investment_gap_score: 6,
          composite_demand_index: 76
        },
        narrative_justification: 'High citizen demand density (24 signals) correlated with 41.5% deficit in piped water coverage.',
        uncertainty_notes: ['Ward boundary southern parcel lacks recent pressure sensor telemetry.'],
        status: DevelopmentOpportunityStatus.SURFACED,
        is_demo: true,
        created_at: '2026-09-24T02:05:00.000Z'
      };

      const result = DevelopmentOpportunitySchema.safeParse(opportunity);
      expect(result.success).toBe(true);
    });

    it('validates a correct DemandEvidence entity', () => {
      const evidence: DemandEvidence = {
        id: 'devd_test_701',
        opportunity_id: 'opp_test_601',
        evidence_type: DemandEvidenceType.DEMAND_SIGNAL,
        reference_id: 'dsig_test_101',
        weight: 0.85,
        summary: 'Citizen report detailing zero pressure during morning supply hours.',
        is_demo: true,
        created_at: '2026-09-24T02:05:00.000Z'
      };

      const result = DemandEvidenceSchema.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it('validates a correct DemandAnalysisRun entity', () => {
      const run: DemandAnalysisRun = {
        id: 'run_test_801',
        executed_at: '2026-09-24T02:10:00.000Z',
        model_name: 'gemini-3.6-flash',
        prompt_version: 'demand_analysis_v1',
        signal_count_analyzed: 142,
        cluster_count_formed: 12,
        opportunity_count_surfaced: 8,
        parameters: { min_cluster_signals: 5, spatial_window_km: 1.5 },
        run_hash: 'c8f7a9d3b4e2f1a0756e812d',
        is_demo: true
      };

      const result = DemandAnalysisRunSchema.safeParse(run);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Enums Validation
  // ==========================================================================
  describe('2. Enums & Canonical States', () => {
    it('validates all DemandSignalSourceChannel values', () => {
      const channels = Object.values(DemandSignalSourceChannel);
      expect(channels).toEqual([
        'WEB_FORM',
        'VOICE_TRANSCRIPT',
        'WHATSAPP_MESSAGING',
        'SMS',
        'CIVIC_SIGNAL'
      ]);
    });

    it('validates DevelopmentOpportunityStatus values', () => {
      const statuses = Object.values(DevelopmentOpportunityStatus);
      expect(statuses).toEqual(['SURFACED', 'IN_REVIEW', 'ARCHIVED']);
    });

    it('validates PublicInvestmentStatus values', () => {
      const statuses = Object.values(PublicInvestmentStatus);
      expect(statuses).toEqual(['PROPOSED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED']);
    });

    it('validates DemandEvidenceType values', () => {
      const types = Object.values(DemandEvidenceType);
      expect(types).toEqual(['DEMAND_SIGNAL', 'INDICATOR', 'INVESTMENT_RECORD']);
    });

    it('validates DemandPriorityBand values', () => {
      const bands = Object.values(DemandPriorityBand);
      expect(bands).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    });
  });

  // ==========================================================================
  // 3. Multilingual Signal Contract
  // ==========================================================================
  describe('3. Multilingual Signal Contract', () => {
    it('accepts Odia language signals with preservation of original text', () => {
      const odiaSignal = {
        id: 'dsig_odia_1',
        source_channel: DemandSignalSourceChannel.VOICE_TRANSCRIPT,
        original_language: 'or',
        original_text: 'ରାସ୍ତା ଖରାପ ହେତୁ ସ୍କୁଲ ବସ୍ ଆସିପାରୁନାହିଁ।',
        normalized_language: 'en' as const,
        normalized_text: 'School bus unable to enter neighborhood due to broken road conditions.',
        normalization_confidence: 0.94,
        detected_category: 'roads_pedestrian',
        detected_urgency: 'HIGH' as const,
        ward_id: 'WARD-030',
        is_demo: true,
        submitted_at: '2026-09-24T02:00:00.000Z',
        ingested_at: '2026-09-24T02:01:00.000Z'
      };

      const result = NormalizedDemandSignalSchema.safeParse(odiaSignal);
      expect(result.success).toBe(true);
    });

    it('accepts Hindi language signals with preservation of original text', () => {
      const hindiSignal = {
        id: 'dsig_hindi_1',
        source_channel: DemandSignalSourceChannel.WHATSAPP_MESSAGING,
        original_language: 'hi',
        original_text: 'मुख्य नाला जाम होने के कारण बारिश का पानी दुकानों में भर गया है।',
        normalized_language: 'en' as const,
        normalized_text: 'Rainwater flooding storefronts due to severe blockage in main stormwater drain.',
        normalization_confidence: 0.96,
        detected_category: 'drainage_flood_stormwater',
        detected_urgency: 'HIGH' as const,
        ward_id: 'WARD-019',
        is_demo: true,
        submitted_at: '2026-09-24T02:00:00.000Z',
        ingested_at: '2026-09-24T02:01:00.000Z'
      };

      const result = NormalizedDemandSignalSchema.safeParse(hindiSignal);
      expect(result.success).toBe(true);
    });

    it('accepts code-mixed (Hinglish/Odia-English) signals', () => {
      const mixedSignal = {
        id: 'dsig_mixed_1',
        source_channel: DemandSignalSourceChannel.SMS,
        original_language: 'mixed',
        original_text: 'Water supply morning re totally stop achi, tanker please send.',
        normalized_language: 'en' as const,
        normalized_text: 'Morning potable water supply completely interrupted; municipal tanker requested.',
        normalization_confidence: 0.88,
        detected_category: 'drinking_water',
        detected_urgency: 'MEDIUM' as const,
        ward_id: 'WARD-019',
        is_demo: true,
        submitted_at: '2026-09-24T02:00:00.000Z',
        ingested_at: '2026-09-24T02:01:00.000Z'
      };

      const result = NormalizedDemandSignalSchema.safeParse(mixedSignal);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Centralized 14-Sector Taxonomy
  // ==========================================================================
  describe('4. Standardized Taxonomy Configuration', () => {
    it('contains all 14 approved sectors', () => {
      expect(DEVELOPMENT_DEMAND_SECTORS.length).toBe(14);
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('drinking_water');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('sanitation_hygiene');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('drainage_flood_stormwater');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('roads_pedestrian');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('public_transit_mobility');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('power_public_lighting');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('healthcare_accessibility');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('educational_facilities');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('digital_connectivity');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('solid_waste_management');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('disaster_heat_resilience');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('public_safety_infrastructure');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('environmental_restoration');
      expect(DEVELOPMENT_DEMAND_SECTORS).toContain('livelihood_supporting_infrastructure');
    });

    it('each sector in DEVELOPMENT_DEMAND_TAXONOMY has required fields', () => {
      for (const sector of DEVELOPMENT_DEMAND_SECTORS) {
        const def = DEVELOPMENT_DEMAND_TAXONOMY[sector];
        expect(def).toBeDefined();
        expect(def.category_id).toBe(sector);
        expect(def.name.length).toBeGreaterThan(0);
        expect(def.description.length).toBeGreaterThan(0);
        expect(def.synonyms.length).toBeGreaterThan(0);
        expect(def.associated_departments.length).toBeGreaterThan(0);
        expect(def.key_indicators.length).toBeGreaterThan(0);
      }
    });

    it('each sector defines multilingual keywords for English, Odia, and Hindi', () => {
      for (const sector of DEVELOPMENT_DEMAND_SECTORS) {
        const def = DEVELOPMENT_DEMAND_TAXONOMY[sector];
        expect(def.multilingual_keywords.en.length).toBeGreaterThan(0);
        expect(def.multilingual_keywords.or.length).toBeGreaterThan(0);
        expect(def.multilingual_keywords.hi.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // 5. Provider Interface Contracts
  // ==========================================================================
  describe('5. Provider Interface Contracts', () => {
    it('satisfies IDevelopmentIndicatorProvider contract structure', async () => {
      const mockIndicatorProvider: IDevelopmentIndicatorProvider = {
        async getWardIndicators(wardId: string) {
          return [
            {
              id: 'ind_1',
              ward_id: wardId,
              indicator_type: 'INFRASTRUCTURE',
              name: 'Piped Water Coverage',
              value: 65,
              unit: '%',
              measurement_date: '2026-01-01T00:00:00.000Z',
              source: 'WATCO',
              confidence: 0.9,
              provenance: { is_demo: true, source: 'WATCO_MOCK' }
            }
          ];
        },
        async getIndicatorBySector(category: string, wardId: string) {
          return [];
        },
        async listAvailableIndicators() {
          return [{ id: 'ind_1', name: 'Piped Water Coverage', unit: '%', source: 'WATCO' }];
        }
      };

      const res = await mockIndicatorProvider.getWardIndicators('WARD-019');
      expect(res.length).toBe(1);
      expect(res[0]!.ward_id).toBe('WARD-019');
    });

    it('satisfies IPublicInvestmentProvider contract structure', async () => {
      const mockInvestmentProvider: IPublicInvestmentProvider = {
        async getInvestmentsByWard(wardId: string) {
          return [
            {
              id: 'inv_1',
              plan_name: 'AMRUT 2.0',
              project_id: 'PRJ-101',
              category: 'drinking_water',
              ward_ids: [wardId],
              status: PublicInvestmentStatus.PROPOSED,
              documented_budget: 10000000,
              currency: 'INR',
              announcement_date: '2026-01-01T00:00:00.000Z',
              source_agency: 'H&UDD',
              source_url: 'https://urban.odisha.gov.in',
              provenance: { is_demo: true, source: 'BUDGET' }
            }
          ];
        },
        async getInvestmentsByCategory(category: string) {
          return [];
        }
      };

      const res = await mockInvestmentProvider.getInvestmentsByWard('WARD-019');
      expect(res.length).toBe(1);
      expect(res[0]!.category).toBe('drinking_water');
    });
  });

  // ==========================================================================
  // 6. Evidence Linkage Contract
  // ==========================================================================
  describe('6. Evidence Linkage Contract', () => {
    it('validates traceable linkage to demand signals, indicators, and investment records', () => {
      const signalEvidence: DemandEvidence = {
        id: 'evd_sig_1',
        opportunity_id: 'opp_1',
        evidence_type: DemandEvidenceType.DEMAND_SIGNAL,
        reference_id: 'dsig_test_101',
        weight: 0.9,
        summary: 'Primary citizen report citing zero morning pressure.',
        is_demo: true,
        created_at: '2026-09-24T02:00:00.000Z'
      };
      expect(DemandEvidenceSchema.safeParse(signalEvidence).success).toBe(true);

      const indicatorEvidence: DemandEvidence = {
        id: 'evd_ind_1',
        opportunity_id: 'opp_1',
        evidence_type: DemandEvidenceType.INDICATOR,
        reference_id: 'ind_test_401',
        weight: 0.8,
        summary: 'Baseline piped water coverage deficit at 41.5%.',
        is_demo: true,
        created_at: '2026-09-24T02:00:00.000Z'
      };
      expect(DemandEvidenceSchema.safeParse(indicatorEvidence).success).toBe(true);
    });

    it('rejects invalid evidence weight (> 1 or < 0)', () => {
      const invalidEvidence = {
        id: 'evd_invalid',
        opportunity_id: 'opp_1',
        evidence_type: DemandEvidenceType.DEMAND_SIGNAL,
        reference_id: 'dsig_1',
        weight: 1.5, // Exceeds 1.0
        summary: 'Invalid weight test',
        is_demo: true,
        created_at: '2026-09-24T02:00:00.000Z'
      };
      expect(DemandEvidenceSchema.safeParse(invalidEvidence).success).toBe(false);
    });
  });

  // ==========================================================================
  // 7. Deterministic Metric Ranges & Composite Index
  // ==========================================================================
  describe('7. Deterministic Metric Ranges', () => {
    it('validates metrics within valid boundaries', () => {
      const validMetrics = {
        demand_volume_score: 25,
        recurrence_score: 20,
        geographic_concentration_score: 15,
        population_exposure_score: 15,
        infrastructure_deficit_score: 15,
        investment_gap_score: 10,
        composite_demand_index: 100
      };
      expect(DeterministicDemandMetricsSchema.safeParse(validMetrics).success).toBe(true);
    });

    it('rejects demand_volume_score exceeding 25', () => {
      const invalid = {
        demand_volume_score: 26, // max is 25
        recurrence_score: 10,
        geographic_concentration_score: 10,
        population_exposure_score: 10,
        infrastructure_deficit_score: 10,
        investment_gap_score: 5,
        composite_demand_index: 71
      };
      expect(DeterministicDemandMetricsSchema.safeParse(invalid).success).toBe(false);
    });

    it('rejects recurrence_score exceeding 20', () => {
      const invalid = {
        demand_volume_score: 20,
        recurrence_score: 21, // max is 20
        geographic_concentration_score: 10,
        population_exposure_score: 10,
        infrastructure_deficit_score: 10,
        investment_gap_score: 5,
        composite_demand_index: 76
      };
      expect(DeterministicDemandMetricsSchema.safeParse(invalid).success).toBe(false);
    });

    it('rejects composite_demand_index exceeding 100', () => {
      const invalid = {
        demand_volume_score: 25,
        recurrence_score: 20,
        geographic_concentration_score: 15,
        population_exposure_score: 15,
        infrastructure_deficit_score: 15,
        investment_gap_score: 10,
        composite_demand_index: 105 // max is 100
      };
      expect(DeterministicDemandMetricsSchema.safeParse(invalid).success).toBe(false);
    });
  });

  // ==========================================================================
  // 8. Governance AI Analysis Response Contract
  // ==========================================================================
  describe('8. Governance AI Analysis Response Contract', () => {
    it('validates complete five-section response structure', () => {
      const response: DevelopmentDemandAnalysisResponse = {
        opportunity_id: 'opp_test_601',
        category: 'drinking_water',
        ward_id: 'WARD-019',
        observed_facts: {
          total_signals: 24,
          first_detected: '2026-08-01T10:00:00.000Z',
          last_detected: '2026-09-24T02:00:00.000Z',
          intake_channels: [DemandSignalSourceChannel.WEB_FORM, DemandSignalSourceChannel.VOICE_TRANSCRIPT],
          sample_narratives: [
            {
              content: 'Pipeline supply unavailable for three consecutive weeks in southern blocks.',
              trust: 'untrusted_user_content'
            }
          ]
        },
        metrics: {
          demand_volume_score: 18,
          recurrence_score: 16,
          geographic_concentration_score: 12,
          population_exposure_score: 13,
          infrastructure_deficit_score: 11,
          investment_gap_score: 6,
          composite_demand_index: 76
        },
        evidence_citations: {
          signal_ids: ['dsig_test_101'],
          indicator_sources: ['WATCO Municipal Baseline Audit 2026'],
          investment_references: ['AMRUT 2.0 Urban Water Distribution Modernization']
        },
        advisory_interpretation: {
          summary: 'Persistent drinking water infrastructure deficit affecting Ward 19 residential expansion.',
          need_justification: 'High citizen demand volume (24 signals) correlated with a 41.5% deficit in piped distribution coverage.',
          tradeoffs_and_considerations: [
            'Requires coordination with Works Department for road-cut permission on GGP Colony main arterial.'
          ]
        },
        uncertainty: {
          confidence: 0.91,
          limitations: [
            'Ward southern boundary signal density is low; on-site pressure logging recommended.'
          ]
        }
      };

      const result = DevelopmentDemandAnalysisResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('enforces untrusted trust metadata on sample narratives', () => {
      const validNarrative = {
        content: 'Citizen report narrative',
        trust: 'untrusted_user_content'
      };
      expect(UntrustedNarrativeSchema.safeParse(validNarrative).success).toBe(true);

      const invalidNarrative = {
        content: 'Citizen report narrative',
        trust: 'trusted_system_content' // Prohibited
      };
      expect(UntrustedNarrativeSchema.safeParse(invalidNarrative).success).toBe(false);
    });
  });

  // ==========================================================================
  // 9. Provenance & Privacy Guarantees
  // ==========================================================================
  describe('9. Provenance & Privacy Guarantees', () => {
    it('requires is_demo boolean on transport entities', () => {
      const clusterMissingDemo = {
        id: 'dclust_test_missing_demo',
        title: 'Cluster',
        category: 'roads_pedestrian',
        ward_ids: ['WARD-019'],
        signal_count: 5,
        first_signal_at: '2026-09-01T00:00:00.000Z',
        last_signal_at: '2026-09-24T00:00:00.000Z',
        duration_days: 23,
        created_at: '2026-09-01T00:00:00.000Z'
        // is_demo omitted
      };
      expect(DemandClusterSchema.safeParse(clusterMissingDemo).success).toBe(false);
    });

    it('verifies absence of PII fields from domain contracts', () => {
      // Intentionally verify that citizen identity keys are NOT defined on NormalizedDemandSignal
      const signalWithPii = {
        id: 'dsig_pii_leak',
        source_channel: DemandSignalSourceChannel.WEB_FORM,
        original_language: 'en',
        original_text: 'Fix the road',
        normalized_language: 'en',
        normalized_text: 'Fix the road',
        normalization_confidence: 0.9,
        detected_category: 'roads_pedestrian',
        detected_urgency: 'LOW',
        ward_id: 'WARD-019',
        is_demo: true,
        submitted_at: '2026-09-24T02:00:00.000Z',
        ingested_at: '2026-09-24T02:01:00.000Z',
        // Injected PII fields:
        citizen_email: 'test@example.com',
        citizen_phone: '+919876543210',
        auth_user_id: 'auth_usr_leak_123',
        legacy_firebase_uid: 'fb_uid_leak_456'
      };

      const parsed = NormalizedDemandSignalSchema.parse(signalWithPii);
      // Zod strips undeclared keys by default, ensuring they are not part of canonical domain contract
      expect((parsed as any).citizen_email).toBeUndefined();
      expect((parsed as any).citizen_phone).toBeUndefined();
      expect((parsed as any).auth_user_id).toBeUndefined();
      expect((parsed as any).legacy_firebase_uid).toBeUndefined();
    });
  });

  // ==========================================================================
  // 10. API Request & Query Schemas
  // ==========================================================================
  describe('10. API Request & Query Contracts', () => {
    it('validates DevelopmentDemandAnalyzeRequestSchema', () => {
      const validReq = {
        opportunity_id: 'opp_test_601',
        category: 'drinking_water',
        ward_id: 'WARD-019'
      };
      expect(DevelopmentDemandAnalyzeRequestSchema.safeParse(validReq).success).toBe(true);
    });

    it('validates DevelopmentDemandQuerySchema with default pagination limit', () => {
      const query = {
        ward_id: 'WARD-019',
        status: DevelopmentOpportunityStatus.SURFACED
      };
      const parsed = DevelopmentDemandQuerySchema.parse(query);
      expect(parsed.limit).toBe(20);
      expect(parsed.status).toBe(DevelopmentOpportunityStatus.SURFACED);
    });
  });
});
