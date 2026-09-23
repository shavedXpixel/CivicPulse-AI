import {
  IAIProvider,
  SignalAnalysisInput,
  DemandNormalizationInput,
  DemandNormalizationAIOutput
} from './ai.interface';
import { SignalAnalysisOutput, DEVELOPMENT_DEMAND_SECTORS } from '@civicpulse/shared';
import { PROMPT_VERSION_DEVELOPMENT_DEMAND_NORMALIZATION } from '../../infrastructure/ai/prompts/development_demand_normalization_v1';

export class MockAIProvider implements IAIProvider {
  private _simulateFailure = false;
  private _simulateMalformed = false;
  private _simulateLowConfidence = false;
  private _simulateTimeout = false;
  private _simulateInvalidCategory = false;

  public simulateFailure(val: boolean = true) {
    this._simulateFailure = val;
  }

  public simulateMalformed(val: boolean = true) {
    this._simulateMalformed = val;
  }

  public simulateLowConfidence(val: boolean = true) {
    this._simulateLowConfidence = val;
  }

  public simulateTimeout(val: boolean = true) {
    this._simulateTimeout = val;
  }

  public simulateInvalidCategory(val: boolean = true) {
    this._simulateInvalidCategory = val;
  }

  public getModelName(): string {
    return 'mock-multilingual-civic-v1';
  }

  public getPromptVersion(): string {
    return 'signal_understanding_v1';
  }

  async analyzeSignal(input: SignalAnalysisInput): Promise<SignalAnalysisOutput> {
    if (this._simulateTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }

    if (this._simulateFailure) {
      throw new Error('Simulated Mock AI analysis failure for resilience testing');
    }

    if (this._simulateMalformed) {
      // Return invalid object missing required fields for schema rejection testing
      return {
        invalid_field: true
      } as any;
    }

    const text = input.text.toLowerCase();

    // 1. Language Detection
    let detected_language = 'en';
    if (/[\u0B00-\u0B7F]/.test(input.text)) {
      detected_language = 'od';
    } else if (/[\u0900-\u097F]/.test(input.text)) {
      detected_language = 'hi';
    }

    // 2. Structured Extraction & Classification based on canonical keywords
    let category = 'other';
    let subcategory: string | null = null;
    let recommended_department = 'OTHER';
    let severity: 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
    let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
    let normalized_summary = 'Civic infrastructure report logged for municipal triage.';
    let entities: string[] = ['civic infrastructure'];
    let explanation = 'Assessment derived from citizen description and context.';
    let affected_scope: string | null = 'Localized';
    let critical_facility: string | null = null;

    if (
      text.includes('hospital') ||
      text.includes('capital hospital') ||
      text.includes('clinic') ||
      text.includes('emergency entrance')
    ) {
      critical_facility = text.includes('capital hospital') ? 'Capital Hospital' : 'Public Medical Facility';
    } else if (text.includes('school') || text.includes('college')) {
      critical_facility = text.includes('dav') ? 'DAV Public School' : 'Educational Institution';
    }

    if (
      text.includes('garbage') ||
      text.includes('waste') ||
      text.includes('dump') ||
      text.includes('sewer') ||
      text.includes('sewage') ||
      text.includes('overflow') ||
      text.includes('manhole') ||
      text.includes('sanitation') ||
      text.includes('culvert') ||
      text.includes('ଅଳିଆ') ||
      text.includes('କଚରା') ||
      text.includes('कचरा')
    ) {
      category = 'sanitation';
      subcategory = text.includes('sewage') || text.includes('overflow') ? 'sewage_overflow' : 'drain_blockage';
      recommended_department = 'BMC_SAN';
      severity = critical_facility || text.includes('emergency') || text.includes('severe') ? 'CRITICAL' : 'MEDIUM';
      urgency = severity === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM';
      normalized_summary = 'Sewage overflow and sanitation obstruction reported requiring immediate municipal clearance.';
      entities = ['sanitation line', 'public thoroughfare'];
      affected_scope = 'Commercial/institutional zone';
      explanation = critical_facility
        ? `Sewage overflow directly impinging on ${critical_facility} operations, creating acute public health biohazard.`
        : 'Sanitation overflow creating public health hazard and environmental contamination.';
    } else if (
      text.includes('water') ||
      text.includes('pipe') ||
      text.includes('burst') ||
      text.includes('leak') ||
      text.includes('drinking') ||
      text.includes('flood') ||
      text.includes('submerg') ||
      text.includes('ପାଣି') ||
      text.includes('पानी')
    ) {
      category = 'water_supply';
      subcategory = 'pipeline_rupture';
      recommended_department = 'WATCO';
      severity = text.includes('flood') || text.includes('burst') || text.includes('basement') ? 'HIGH' : 'MEDIUM';
      urgency = severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
      normalized_summary = 'Main water pipeline leakage causing street flooding and potable water supply interruption.';
      entities = ['water supply main', 'WATCO distribution pipeline'];
      affected_scope = 'Residential block & corridor';
      explanation = 'Text indicates high-pressure water transmission failure risking potable supply disruption.';
    } else if (
      text.includes('spark') ||
      text.includes('transformer') ||
      text.includes('wire') ||
      text.includes('electric') ||
      text.includes('voltage') ||
      text.includes('बिजली') ||
      text.includes('ବିଦ୍ୟୁତ') ||
      text.includes('বিদ্যুৎ')
    ) {
      category = 'electricity';
      subcategory = 'transformer_arcing';
      recommended_department = 'TPCODL';
      severity = 'CRITICAL';
      urgency = 'HIGH';
      normalized_summary = 'Severe sparking on electrical transformer posing imminent fire and electrocution hazard.';
      entities = ['11kV transformer', 'feeder line'];
      affected_scope = 'Commercial/residential sector';
      explanation = 'Active arcing and sparking reported on high-voltage equipment represents acute public safety hazard.';
    } else if (
      text.includes('pothole') ||
      text.includes('sinkhole') ||
      text.includes('cavity') ||
      text.includes('road') ||
      text.includes('asphalt') ||
      text.includes('सड़क') ||
      text.includes('ରାସ୍ତା')
    ) {
      category = 'roads';
      subcategory = 'pavement_cavity';
      recommended_department = 'BMC_ROADS';
      severity = 'HIGH';
      urgency = 'HIGH';
      normalized_summary = 'Subsurface road cavity and major pothole obstruction on primary traffic corridor.';
      entities = ['arterial road', 'surface pavement'];
      affected_scope = 'Transit corridor';
      explanation = 'Road cavity undermines pavement stability for vehicular traffic, requiring emergency asphalt repair.';
    } else if (
      text.includes('dark') ||
      text.includes('lamp') ||
      text.includes('light') ||
      text.includes('streetlight') ||
      text.includes('ଅନ୍ଧାର') ||
      text.includes('ଷ୍ଟ୍ରିଟଲାଇଟ')
    ) {
      category = 'streetlights';
      subcategory = 'circuit_blackout';
      recommended_department = 'TPCODL';
      severity = 'MEDIUM';
      urgency = 'MEDIUM';
      normalized_summary = 'Municipal streetlights blackout corridor impairing nighttime pedestrian safety.';
      entities = ['LED streetlights', 'lighting circuit'];
      affected_scope = 'Street stretch (~500m)';
      explanation = 'Non-functional street illumination along pedestrian route creates evening visibility and safety concerns.';
    }

    // 3. Image findings if media items are attached
    const image_findings: string[] = [];
    if (input.media_items && input.media_items.length > 0) {
      image_findings.push('Visible surface infrastructure damage consistent with citizen textual report.');
    }

    const confidence = this._simulateLowConfidence ? 0.45 : 0.92;

    if (this._simulateLowConfidence) {
      category = 'other';
      explanation = 'Low-confidence simulated extraction for threshold testing.';
    }

    let duration_days: number | null = null;
    if (text.includes('2 days') || text.includes('two days')) {
      duration_days = 2;
    } else if (text.includes('3 days') || text.includes('three days') || text.includes('ତିନି ଦିନ')) {
      duration_days = 3;
    }

    return {
      detected_language,
      normalized_summary,
      category,
      subcategory,
      severity,
      urgency,
      affected_scope,
      duration_days,
      location_reference: input.location_reference || null,
      recommended_department,
      entities,
      critical_facility,
      confidence,
      explanation,
      image_findings
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (this._simulateFailure) {
      throw new Error('Simulated Mock AI embedding failure');
    }

    const dim = 1536;
    const vec = new Array(dim).fill(0);
    const normalized = text.toLowerCase();

    // Base token semantic hashing
    const words = normalized.split(/\s+/).filter(Boolean);
    for (const w of words) {
      let hash = 0;
      for (let i = 0; i < w.length; i++) {
        hash = (hash << 5) - hash + w.charCodeAt(i);
        hash |= 0;
      }
      const idx = Math.abs(hash) % dim;
      vec[idx] += hash > 0 ? 1.0 : -0.5;
    }

    // Category feature dimension boosters for clear semantic clustering
    const setCategoryBoost = (startIdx: number, weight: number) => {
      for (let i = 0; i < 8; i++) {
        vec[startIdx + i] += weight * (i % 2 === 0 ? 1.0 : 0.8);
      }
    };

    if (
      normalized.includes('water') ||
      normalized.includes('pipe') ||
      normalized.includes('burst') ||
      normalized.includes('leak') ||
      normalized.includes('drinking') ||
      normalized.includes('flood') ||
      normalized.includes('submerg') ||
      normalized.includes('ପାଣି') ||
      normalized.includes('पानी')
    ) {
      setCategoryBoost(0, 4.0);
    }
    if (
      normalized.includes('drain') ||
      normalized.includes('sewage') ||
      normalized.includes('overflow') ||
      normalized.includes('culvert') ||
      normalized.includes('manhole')
    ) {
      setCategoryBoost(8, 4.0);
    }
    if (
      normalized.includes('road') ||
      normalized.includes('pothole') ||
      normalized.includes('cavity') ||
      normalized.includes('asphalt') ||
      normalized.includes('ରାସ୍ତା') ||
      normalized.includes('सड़क')
    ) {
      setCategoryBoost(16, 4.0);
    }
    if (
      normalized.includes('spark') ||
      normalized.includes('transformer') ||
      normalized.includes('electric') ||
      normalized.includes('wire') ||
      normalized.includes('बिजली')
    ) {
      setCategoryBoost(24, 4.0);
    }
    if (
      normalized.includes('light') ||
      normalized.includes('lamp') ||
      normalized.includes('dark') ||
      normalized.includes('streetlight')
    ) {
      setCategoryBoost(32, 4.0);
    }
    if (
      normalized.includes('garbage') ||
      normalized.includes('waste') ||
      normalized.includes('dump') ||
      normalized.includes('कचरा')
    ) {
      setCategoryBoost(40, 4.0);
    }

    // Geographic / Ward proximity boosters
    if (normalized.includes('nayapalli') || normalized.includes('ward 18') || normalized.includes('vip road')) {
      for (let i = 0; i < 4; i++) vec[48 + i] += 2.0;
    }

    // Normalize to unit vector (L2 norm)
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) {
      vec[0] = 1.0;
      return vec;
    }
    for (let i = 0; i < dim; i++) {
      vec[i] = Number((vec[i] / norm).toFixed(6));
    }

    return vec;
  }

  async summarizeCluster(input: import('./ai.interface').ClusterSummaryInput): Promise<string> {
    const cat = input.category.replace('_', ' ');
    const durationText = input.duration_days ? ` over ${input.duration_days} days` : '';
    return `A concentrated ${cat} disruption is affecting ${input.location}, with ${input.signal_count} related reports${durationText}.`;
  }

  public getDemandPromptVersion(): string {
    return PROMPT_VERSION_DEVELOPMENT_DEMAND_NORMALIZATION;
  }

  async normalizeDemand(input: DemandNormalizationInput): Promise<DemandNormalizationAIOutput> {
    if (this._simulateTimeout) {
      throw new Error('Simulated Mock AI demand normalization timeout');
    }

    if (this._simulateFailure) {
      throw new Error('Simulated Mock AI demand normalization failure for resilience testing');
    }

    if (this._simulateMalformed) {
      return {
        invalid_field: true
      } as any;
    }

    if (this._simulateInvalidCategory) {
      return {
        detected_language: 'en',
        normalized_text: 'Simulated invalid category response',
        detected_category: 'invalid_nonexistent_sector',
        detected_urgency: 'MEDIUM',
        normalization_confidence: 0.95,
        reasoning: 'Simulated invalid taxonomy output for testing',
        resolved_model: 'mock-multilingual-civic-v1'
      };
    }

    const text = input.text.toLowerCase();

    // 1. Language Detection
    const hasOdia = /[\u0B00-\u0B7F]/.test(input.text);
    const hasDevanagari = /[\u0900-\u097F]/.test(input.text);
    const hasLatin = /[a-zA-Z]/.test(input.text);

    let detected_language: 'en' | 'or' | 'hi' | 'mixed' = 'en';

    // Transliterated code-mixed markers
    const codeMixedMarkers = [
      'pani supply', 'water supply nahi', 'rasta kharab', 'drain nala', 'bada drain',
      'paani nahi', 'sadak toot', 'bijli cut', 'kachra uthana', 'toilet chahiye',
      'khala bada', 'light nahi', 'darkness street'
    ];
    const isTransliteratedMixed = codeMixedMarkers.some((marker) => text.includes(marker));

    if ((hasOdia && hasLatin) || (hasDevanagari && hasLatin) || isTransliteratedMixed) {
      detected_language = 'mixed';
    } else if (hasOdia) {
      detected_language = 'or';
    } else if (hasDevanagari) {
      detected_language = 'hi';
    } else {
      detected_language = 'en';
    }

    // 2. Canonical HF7.1 Taxonomy Classification
    let detected_category = 'roads_pedestrian';

    if (
      text.includes('drain') ||
      text.includes('stormwater') ||
      text.includes('waterlogging') ||
      text.includes('flood') ||
      text.includes('nala') ||
      text.includes('culvert') ||
      text.includes('ନାଳ') ||
      text.includes('ଡ୍ରେନ୍') ||
      text.includes('नाली') ||
      text.includes('जलभराव')
    ) {
      detected_category = 'drainage_flood_stormwater';
    } else if (
      /\b(?:park|trees?|plantation|pond|lake|waterbody|greenery|garden|urban forest)\b/i.test(input.text) ||
      text.includes('ପୋଖରୀ') ||
      text.includes('तालाब') ||
      text.includes('पेड़')
    ) {
      detected_category = 'environmental_restoration';
    } else if (
      (text.includes('water') && !text.includes('waterlog') && !text.includes('waterbody')) ||
      text.includes('drinking') ||
      text.includes('pipe') ||
      text.includes('tap') ||
      text.includes('paani') ||
      text.includes('pani') ||
      text.includes('ପାଣି') ||
      text.includes('ଜଳ') ||
      text.includes('पानी') ||
      text.includes('नल')
    ) {
      detected_category = 'drinking_water';
    } else if (
      text.includes('toilet') ||
      text.includes('sanitation') ||
      text.includes('shauchalaya') ||
      text.includes('hygiene') ||
      text.includes('ଶୌଚାଳୟ') ||
      text.includes('शौचालय')
    ) {
      detected_category = 'sanitation_hygiene';
    } else if (
      text.includes('street light') ||
      text.includes('lighting') ||
      text.includes('transformer') ||
      text.includes('electricity') ||
      text.includes('dark street') ||
      text.includes('power cut') ||
      text.includes('power') ||
      text.includes('light') ||
      text.includes('ଆଲୋକ') ||
      text.includes('बिजली')
    ) {
      detected_category = 'power_public_lighting';
    } else if (
      text.includes('bus') ||
      text.includes('transit') ||
      text.includes('metro') ||
      text.includes('mobility') ||
      text.includes('bus stop') ||
      text.includes('transport') ||
      text.includes('ବସ୍') ||
      text.includes('बस')
    ) {
      detected_category = 'public_transit_mobility';
    } else if (
      text.includes('hospital') ||
      text.includes('clinic') ||
      text.includes('health') ||
      text.includes('phc') ||
      text.includes('chc') ||
      text.includes('doctor') ||
      text.includes('medicine') ||
      text.includes('dispensary') ||
      text.includes('ଡାକ୍ତରଖାନା') ||
      text.includes('अस्पताल')
    ) {
      detected_category = 'healthcare_accessibility';
    } else if (
      text.includes('school') ||
      text.includes('college') ||
      text.includes('anganwadi') ||
      text.includes('library') ||
      text.includes('classroom') ||
      text.includes('education') ||
      text.includes('ବିଦ୍ୟାଳୟ') ||
      text.includes('स्कूल') ||
      text.includes('आंगनवाड़ी')
    ) {
      detected_category = 'educational_facilities';
    } else if (
      text.includes('wifi') ||
      text.includes('internet') ||
      text.includes('network') ||
      text.includes('fiber') ||
      text.includes('broadband') ||
      text.includes('digital') ||
      text.includes('connectivity')
    ) {
      detected_category = 'digital_connectivity';
    } else if (
      text.includes('garbage') ||
      text.includes('waste') ||
      text.includes('dump') ||
      text.includes('dustbin') ||
      text.includes('trash') ||
      text.includes('solid waste') ||
      text.includes('ଅଳିଆ') ||
      text.includes('କଚରା') ||
      text.includes('कचरा') ||
      text.includes('कूड़ा')
    ) {
      detected_category = 'solid_waste_management';
    } else if (
      text.includes('cyclone') ||
      text.includes('heat') ||
      text.includes('heatwave') ||
      text.includes('shelter') ||
      text.includes('disaster') ||
      text.includes('ବାତ୍ୟା') ||
      text.includes('लू')
    ) {
      detected_category = 'disaster_heat_resilience';
    } else if (
      text.includes('cctv') ||
      text.includes('surveillance') ||
      text.includes('police post') ||
      text.includes('guardrail') ||
      text.includes('public safety') ||
      text.includes('security')
    ) {
      detected_category = 'public_safety_infrastructure';
    } else if (
      text.includes('market') ||
      text.includes('vending') ||
      text.includes('mandi') ||
      text.includes('haat') ||
      text.includes('bazaar') ||
      text.includes('vendor') ||
      text.includes('shed') ||
      text.includes('ମାର୍କେଟ') ||
      text.includes('ହାଟ') ||
      text.includes('मंडी')
    ) {
      detected_category = 'livelihood_supporting_infrastructure';
    } else if (
      text.includes('road') ||
      text.includes('pothole') ||
      text.includes('footpath') ||
      text.includes('street') ||
      text.includes('pavement') ||
      text.includes('rasta') ||
      text.includes('ରାସ୍ତା') ||
      text.includes('ଖାଲ') ||
      text.includes('सड़क') ||
      text.includes('रास्ता')
    ) {
      detected_category = 'roads_pedestrian';
    }

    // 3. Urgency Assessment
    let detected_urgency: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (
      text.includes('urgent') ||
      text.includes('immediate') ||
      text.includes('emergency') ||
      text.includes('danger') ||
      text.includes('hazard') ||
      text.includes('critical') ||
      text.includes('accident') ||
      text.includes('तुरंत') ||
      text.includes('जल्दी') ||
      text.includes('ଜରୁରୀ') ||
      text.includes('ବିପଦ')
    ) {
      detected_urgency = 'HIGH';
    } else if (
      text.includes('routine') ||
      text.includes('maintenance') ||
      text.includes('future') ||
      text.includes('suggestion') ||
      text.includes('beautification') ||
      text.includes('optional')
    ) {
      detected_urgency = 'LOW';
    }

    // 4. Normalized English Text
    let normalized_text: string;
    if (detected_language === 'or') {
      if (detected_category === 'drinking_water') {
        normalized_text = 'Citizen reports acute drinking water scarcity and demands piped water supply infrastructure.';
      } else if (detected_category === 'roads_pedestrian') {
        normalized_text = 'Citizen requests urgent repair of broken road and pothole resurfacing for safe transit.';
      } else {
        normalized_text = `Citizen demands municipal infrastructure improvement for ${detected_category.replace(/_/g, ' ')}.`;
      }
    } else if (detected_language === 'hi') {
      if (detected_category === 'drinking_water') {
        normalized_text = 'Citizen reports severe shortage of clean drinking water and requests pipeline connection.';
      } else if (detected_category === 'roads_pedestrian') {
        normalized_text = 'Citizen reports damaged road conditions requiring immediate resurfacing and pedestrian safety.';
      } else {
        normalized_text = `Citizen submits municipal development demand for ${detected_category.replace(/_/g, ' ')}.`;
      }
    } else if (detected_language === 'mixed') {
      normalized_text = `Citizen reports local infrastructure deficit in ${detected_category.replace(/_/g, ' ')} and demands civic remediation.`;
    } else {
      normalized_text = input.text.trim();
    }

    // 5. Coarse Locality and Ward Extraction (Only from explicitly supplied context or explicit mentions)
    let extracted_ward: string | undefined = input.ward_id;
    let extracted_locality: string | undefined = input.locality_name;

    const wardMatch = input.text.match(/\b(?:ward|ward-)\s*(\d{1,3})\b/i);
    if (!extracted_ward && wardMatch) {
      extracted_ward = `WARD-${wardMatch[1]?.padStart(3, '0')}`;
    }

    const knownLocalities = ['Saheed Nagar', 'Nayapalli', 'GGP Colony', 'Unit 3', 'Chandrasekharpur', 'Patia', 'Old Town', 'Khandagiri'];
    if (!extracted_locality) {
      for (const loc of knownLocalities) {
        if (new RegExp(`\\b${loc}\\b`, 'i').test(input.text)) {
          extracted_locality = loc;
          break;
        }
      }
    }

    const confidence = this._simulateLowConfidence ? 0.35 : 0.94;

    return {
      detected_language,
      normalized_text,
      detected_category,
      detected_urgency,
      extracted_locality,
      extracted_ward,
      normalization_confidence: confidence,
      reasoning: `Categorized into canonical sector ${detected_category} with urgency ${detected_urgency} based on civic intent.`,
      resolved_model: 'mock-multilingual-civic-v1'
    };
  }
}

