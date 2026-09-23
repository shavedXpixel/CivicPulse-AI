/**
 * CivicPulse Development Demand Intelligence — Standardized Sector Taxonomy
 * 
 * Strict Invariants:
 * 1. Data-driven configuration (no scattered hardcoded conditionals).
 * 2. Neutral municipal terminology (zero political ideology or campaign bias).
 * 3. Multilingual keyword coverage (English, Odia, Hindi).
 * 4. Transparent infrastructure indicator & department linkages.
 */

export const DEVELOPMENT_DEMAND_SECTORS = [
  'drinking_water',
  'sanitation_hygiene',
  'drainage_flood_stormwater',
  'roads_pedestrian',
  'public_transit_mobility',
  'power_public_lighting',
  'healthcare_accessibility',
  'educational_facilities',
  'digital_connectivity',
  'solid_waste_management',
  'disaster_heat_resilience',
  'public_safety_infrastructure',
  'environmental_restoration',
  'livelihood_supporting_infrastructure'
] as const;

export type DevelopmentDemandSector = (typeof DEVELOPMENT_DEMAND_SECTORS)[number];

export interface TaxonomyCategoryDefinition {
  category_id: DevelopmentDemandSector;
  name: string;
  parent_category: string | null;
  description: string;
  synonyms: string[];
  multilingual_keywords: {
    en: string[];
    or: string[]; // Odia
    hi: string[]; // Hindi
  };
  associated_departments: string[];
  key_indicators: string[];
}

export const DEVELOPMENT_DEMAND_TAXONOMY: Record<DevelopmentDemandSector, TaxonomyCategoryDefinition> = {
  drinking_water: {
    category_id: 'drinking_water',
    name: 'Drinking Water Supply',
    parent_category: null,
    description: 'Piped potable water network coverage, household connections, standpost distribution, water pressure, and water quality testing infrastructure.',
    synonyms: ['potable water', 'water supply', 'pipeline extension', 'tube well', 'tanker supply', 'drinking water main'],
    multilingual_keywords: {
      en: ['drinking water', 'tap water', 'water pipeline', 'water supply', 'standpost', 'potable water'],
      or: ['ପିଇବା ପାଣି', 'ଜଳ ଯୋଗାଣ', 'ପାଇପ୍ ଲାଇନ୍', 'ଟ୍ୟାପ୍ ପାଣି', 'ନଳକୂପ', 'ଷ୍ଟାଣ୍ଡପୋଷ୍ଟ'],
      hi: ['पीने का पानी', 'जल आपूर्ति', 'नल का पानी', 'पाइपलाइन', 'पेयजल', 'हैंडपंप']
    },
    associated_departments: ['WATCO', 'PHED'],
    key_indicators: ['piped_water_coverage_pct', 'potable_water_liters_per_capita', 'water_quality_compliance_pct']
  },

  sanitation_hygiene: {
    category_id: 'sanitation_hygiene',
    name: 'Sanitation & Community Hygiene',
    parent_category: null,
    description: 'Underground sewerage networks, community sanitary complexes, faecal sludge treatment, and public toilet infrastructure.',
    synonyms: ['sewerage network', 'public toilets', 'community toilet', 'sanitation complex', 'sludge treatment'],
    multilingual_keywords: {
      en: ['sanitation', 'sewerage', 'public toilet', 'community toilet', 'sewage treatment', 'hygiene'],
      or: ['ପରିମଳ', 'ଶୌଚାଳୟ', 'ନର୍ଦ୍ଦମା ପାଇପ୍', 'ସାମୁହିକ ଶୌଚାଳୟ', 'ମଳ ନିଷ୍କାସନ'],
      hi: ['स्वच्छता', 'सीवरेज', 'शौचालय', 'सार्वजनिक शौचालय', 'मल निस्तारण']
    },
    associated_departments: ['WATCO', 'BMC_SANITATION'],
    key_indicators: ['sewer_network_coverage_pct', 'community_toilet_seat_ratio', 'open_defecation_free_status']
  },

  drainage_flood_stormwater: {
    category_id: 'drainage_flood_stormwater',
    name: 'Drainage & Flood Stormwater Management',
    parent_category: null,
    description: 'Stormwater canalization, primary and secondary drain desilting, culvert reconstruction, and localized flood mitigation infrastructure.',
    synonyms: ['stormwater drain', 'flood mitigation', 'monsoon drainage', 'culvert', 'waterlogging'],
    multilingual_keywords: {
      en: ['drainage', 'stormwater', 'culvert', 'waterlogging', 'flood drain', 'desilting'],
      or: ['ଡ୍ରେନେଜ୍', 'ନର୍ଦ୍ଦମା', 'ବର୍ଷା ଜଳ ନିଷ୍କାସନ', 'ଜଳବନ୍ଦୀ', 'ପୋଲିଆ'],
      hi: ['जल निकासी', 'नाली', 'बाढ़ नियंत्रण', 'जलभराव', 'बरसाती नाला']
    },
    associated_departments: ['BMC_DRAINAGE', 'WORKS_DEPARTMENT'],
    key_indicators: ['stormwater_drain_length_km', 'flood_vulnerability_index', 'culvert_capacity_ratio']
  },

  roads_pedestrian: {
    category_id: 'roads_pedestrian',
    name: 'Roads & Pedestrian Infrastructure',
    parent_category: null,
    description: 'Municipal arterial and feeder roads, pedestrian sidewalks, zebra crossings, cycling tracks, and road widening.',
    synonyms: ['paved road', 'footpath', 'sidewalk', 'pedestrian crossing', 'blacktopping', 'lane widening'],
    multilingual_keywords: {
      en: ['road', 'footpath', 'sidewalk', 'pedestrian', 'pothole repair', 'paving', 'road widening'],
      or: ['ରାସ୍ତା', 'ଫୁଟପାଥ୍', 'ପଦଯାତ୍ରୀ ପଥ', 'ରାସ୍ତା ଚଉଡା', 'ପିଚୁ ରାସ୍ତା'],
      hi: ['सड़क', 'फुटपाथ', 'पैदल मार्ग', 'सड़क चौड़ीकरण', 'डामरीकरण']
    },
    associated_departments: ['WORKS_DEPARTMENT', 'BMC_ENGINEERING'],
    key_indicators: ['paved_road_density_km_sqkm', 'sidewalk_coverage_pct', 'road_condition_index']
  },

  public_transit_mobility: {
    category_id: 'public_transit_mobility',
    name: 'Public Transit & Urban Mobility',
    parent_category: null,
    description: 'City bus connectivity, bus shelter infrastructure, intermediate public transport stands, and transit accessibility.',
    synonyms: ['city bus', 'bus stop', 'bus shelter', 'transit connectivity', 'metro feed', 'auto stand'],
    multilingual_keywords: {
      en: ['public transit', 'bus stop', 'bus shelter', 'transit', 'bus route', 'mobility'],
      or: ['ସରକାରୀ ବସ୍', 'ବସ୍ ରହଣି', 'ଯାତ୍ରୀ ଛାଉଣୀ', 'ପରିବହନ ସେବା', 'ବସ୍ ରୁଟ୍'],
      hi: ['सार्वजनिक परिवहन', 'बस स्टॉप', 'बस शेल्टर', 'बस सेवा', 'यातायात']
    },
    associated_departments: ['CRUT', 'COMMERCE_TRANSPORT'],
    key_indicators: ['bus_stop_proximity_500m_pct', 'transit_frequency_per_hour', 'fleet_coverage_ratio']
  },

  power_public_lighting: {
    category_id: 'power_public_lighting',
    name: 'Power Distribution & Public Street Lighting',
    parent_category: null,
    description: 'Street lighting coverage, high-mast illumination at intersections, low-voltage power distribution safety, and transformer upgrades.',
    synonyms: ['streetlights', 'public lighting', 'power distribution', 'high mast', 'transformer', 'electrical pole'],
    multilingual_keywords: {
      en: ['street light', 'public lighting', 'high mast', 'power cut', 'electricity pole', 'transformer'],
      or: ['ଷ୍ଟ୍ରିଟ୍ ଲାଇଟ୍', 'ରାସ୍ତା ଆଲୋକ', 'ହାଇ ମାଷ୍ଟ ଲାଇଟ୍', 'ବିଦ୍ୟୁତ୍ ଖୁଣ୍ଟ', 'ଟ୍ରାନ୍ସଫର୍ମର'],
      hi: ['स्ट्रीट लाइट', 'सड़क बत्ती', 'विद्युत पोल', 'ट्रांसफॉर्मर', 'बिजली आपूर्ति']
    },
    associated_departments: ['TPCODL', 'BMC_ELECTRICAL'],
    key_indicators: ['street_lighting_pole_density', 'illuminated_road_pct', 'power_reliability_index']
  },

  healthcare_accessibility: {
    category_id: 'healthcare_accessibility',
    name: 'Healthcare Facility Accessibility',
    parent_category: null,
    description: 'Primary health centres (UPHC), urban community health centres (UCHC), maternal clinics, and emergency ambulance access.',
    synonyms: ['health clinic', 'dispensary', 'primary health centre', 'maternity care', 'hospital access'],
    multilingual_keywords: {
      en: ['health centre', 'hospital', 'clinic', 'dispensary', 'doctor', 'ambulance access'],
      or: ['ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର', 'ଡାକ୍ତରଖାନା', 'କ୍ଲିନିକ୍', 'ଔଷଧାଳୟ', 'ଆମ୍ବୁଲାନ୍ସ'],
      hi: ['स्वास्थ्य केंद्र', 'अस्पताल', 'दवाखाना', 'प्राथमिक स्वास्थ्य केंद्र', 'एम्बुलेंस']
    },
    associated_departments: ['HEALTH_FAMILY_WELFARE', 'BMC_HEALTH'],
    key_indicators: ['uphc_proximity_1km_pct', 'hospital_bed_ratio', 'emergency_response_time_min']
  },

  educational_facilities: {
    category_id: 'educational_facilities',
    name: 'Educational Infrastructure & Access',
    parent_category: null,
    description: 'Municipal primary and secondary school buildings, Anganwadi centre modernization, school drinking water/sanitation, and safe school zones.',
    synonyms: ['school building', 'anganwadi', 'classroom expansion', 'school sanitation', 'public library'],
    multilingual_keywords: {
      en: ['school', 'anganwadi', 'education', 'classroom', 'library', 'school zone'],
      or: ['ବିଦ୍ୟାଳୟ', 'ଅଙ୍ଗନୱାଡି', 'ଶିକ୍ଷା କେନ୍ଦ୍ର', 'ଶ୍ରେଣୀଗୃହ', 'ପାଠାଗାର'],
      hi: ['स्कूल', 'आंगनवाड़ी', 'विद्यालय', 'कक्षा', 'पुस्तकालय', 'शिक्षा']
    },
    associated_departments: ['SCHOOL_MASS_EDUCATION', 'WCD_DEPARTMENT'],
    key_indicators: ['school_proximity_800m_pct', 'student_classroom_ratio', 'school_wash_compliance_pct']
  },

  digital_connectivity: {
    category_id: 'digital_connectivity',
    name: 'Digital Connectivity & Public Access',
    parent_category: null,
    description: 'Public Wi-Fi access zones, citizen service facilitation kiosks (Mo Seva Kendra), and municipal optical fibre infrastructure.',
    synonyms: ['public wifi', 'mo seva kendra', 'citizen service kiosk', 'fiber connectivity', 'digital center'],
    multilingual_keywords: {
      en: ['digital connectivity', 'public wifi', 'citizen kiosk', 'mo seva kendra', 'internet access'],
      or: ['ଡିଜିଟାଲ୍ ସଂଯୋଗ', 'ମୋ ସେବା କେନ୍ଦ୍ର', 'ୱାଇଫାଇ', 'ଇଣ୍ଟରନେଟ୍ ସୁବିଧା', 'ସେବା କେନ୍ଦ୍ର'],
      hi: ['डिजिटल कनेक्टिविटी', 'पब्लिक वाईफाई', 'नागरिक सेवा केंद्र', 'इंटरनेट']
    },
    associated_departments: ['E_IT_DEPARTMENT', 'BSCL'],
    key_indicators: ['service_kiosk_density_per_ward', 'public_wifi_zones_count', 'broadband_coverage_pct']
  },

  solid_waste_management: {
    category_id: 'solid_waste_management',
    name: 'Solid Waste Management & Micro-Composting',
    parent_category: null,
    description: 'Decentralized Micro-Composting Centres (MCC), Material Recovery Facilities (MRF), door-to-door segregated collection, and secondary transfer bins.',
    synonyms: ['garbage collection', 'waste segregation', 'micro composting', 'MRF center', 'transfer station', 'waste bin'],
    multilingual_keywords: {
      en: ['waste management', 'garbage bin', 'composting center', 'segregation', 'trash collection'],
      or: ['ବର୍ଜ୍ୟବସ୍ତୁ ପରିଚାଳନା', 'ଅଳିଆ ସଂଗ୍ରହ', 'ଖତ ପ୍ରସ୍ତୁତି କେନ୍ଦ୍ର', 'ଡଷ୍ଟବିନ୍', 'ପରିଷ୍କାରତା'],
      hi: ['कचरा प्रबंधन', 'कूड़ादान', 'कंपोस्टिंग केंद्र', 'कचरा गाड़ी', 'सफाई']
    },
    associated_departments: ['BMC_SANITATION', 'HOUSING_URBAN_DEVELOPMENT'],
    key_indicators: ['door_to_door_coverage_pct', 'waste_segregation_rate_pct', 'mcc_utilization_pct']
  },

  disaster_heat_resilience: {
    category_id: 'disaster_heat_resilience',
    name: 'Disaster Preparedness & Urban Heat Resilience',
    parent_category: null,
    description: 'Cyclone/flood multipurpose shelters, urban heat mitigation (cooling shelters, shade canopies), and early warning public address sirens.',
    synonyms: ['flood shelter', 'heat mitigation', 'cooling center', 'cyclone shelter', 'emergency warning'],
    multilingual_keywords: {
      en: ['disaster resilience', 'heat wave', 'cooling center', 'cyclone shelter', 'flood warning'],
      or: ['ବିପର୍ଯ୍ୟୟ ପରିଚାଳନା', 'ବାତ୍ୟା ଆଶ୍ରୟସ୍ଥଳୀ', 'ଗ୍ରୀଷ୍ମ ପ୍ରବାହ ନିୟନ୍ତ୍ରଣ', 'ଜଳଛତ୍ର', 'ଆଶ୍ରୟ କେନ୍ଦ୍ର'],
      hi: ['आपदा प्रबंधन', 'चक्रवात आश्रय', 'लू से बचाव', 'शीतल पेयजल केंद्र', 'बाढ़ राहत']
    },
    associated_departments: ['OSDMA', 'REVENUE_DISASTER_MANAGEMENT'],
    key_indicators: ['shelter_capacity_per_capita', 'urban_canopy_cover_pct', 'heat_vulnerability_score']
  },

  public_safety_infrastructure: {
    category_id: 'public_safety_infrastructure',
    name: 'Public Safety & Surveillance Infrastructure',
    parent_category: null,
    description: 'CCTV surveillance points, emergency panic buttons, illuminated dark spots, and fire hydrants in congested market areas.',
    synonyms: ['cctv', 'surveillance camera', 'dark spot illumination', 'fire hydrant', 'emergency call point'],
    multilingual_keywords: {
      en: ['public safety', 'cctv camera', 'safety lighting', 'fire hydrant', 'surveillance'],
      or: ['ସାଧାରଣ ସୁରକ୍ଷା', 'ସିସିଟିଭି କ୍ୟାମେରା', 'ଆଲୋକୀକରଣ', 'ଅଗ୍ନି ନିର୍ବାପକ ଯନ୍ତ୍ର', 'ସୁରକ୍ଷା କେନ୍ଦ୍ର'],
      hi: ['सार्वजनिक सुरक्षा', 'सीसीटीवी कैमरा', 'सुरक्षा लाइट', 'अग्निशमन व्यवस्था']
    },
    associated_departments: ['COMMISSIONERATE_POLICE', 'BMC_ENGINEERING', 'FIRE_SERVICES'],
    key_indicators: ['cctv_coverage_sqkm', 'dark_spot_elimination_pct', 'fire_hydrant_operational_ratio']
  },

  environmental_restoration: {
    category_id: 'environmental_restoration',
    name: 'Urban Waterbodies & Environmental Restoration',
    parent_category: null,
    description: 'Municipal waterbody rejuvenation (tanks, ponds), community open green parks, native tree afforestation, and water harvesting structures.',
    synonyms: ['pond rejuvenation', 'lake restoration', 'public park', 'green canopy', 'rainwater harvesting'],
    multilingual_keywords: {
      en: ['pond restoration', 'lake', 'waterbody', 'park', 'green cover', 'rainwater harvesting'],
      or: ['ପୋଖରୀ ପୁନରୁଦ୍ଧାର', 'ଜଳାଶୟ', 'ପାର୍କ', 'ବୃକ୍ଷରୋପଣ', 'ବର୍ଷା ଜଳ ସଂରକ୍ଷଣ'],
      hi: ['तालाब जीर्णोद्धार', 'जल निकाय', 'पार्क', 'पौधारोपण', 'वर्षा जल संचयन']
    },
    associated_departments: ['FOREST_ENVIRONMENT', 'BDA', 'BMC_ENGINEERING'],
    key_indicators: ['waterbody_water_quality_index', 'public_green_space_sqm_per_capita', 'groundwater_recharge_zones']
  },

  livelihood_supporting_infrastructure: {
    category_id: 'livelihood_supporting_infrastructure',
    name: 'Livelihood & Community Market Infrastructure',
    parent_category: null,
    description: 'Vending zones, daily vegetable/fish market platforms, women SHG production centres, and artisan facility hubs.',
    synonyms: ['vending zone', 'hawker market', 'shg center', 'daily market', 'artisan center'],
    multilingual_keywords: {
      en: ['vending zone', 'market platform', 'shg center', 'community market', 'artisan shed'],
      or: ['ଭେଣ୍ଡିଂ ଜୋନ୍', 'ଦୈନିକ ବଜାର', 'ମହିଳା ସ୍ୱୟଂ ସହାୟକ କେନ୍ଦ୍ର', 'ବିକ୍ରୟ କେନ୍ଦ୍ର', 'ହାଟ'],
      hi: ['वेंडिंग जोन', 'दैनिक बाजार', 'स्वयं सहायता केंद्र', 'बाजार शेड', 'हाट']
    },
    associated_departments: ['MISSION_SHAKTI', 'BMC_MARKET'],
    key_indicators: ['designated_vending_space_ratio', 'shg_infrastructure_utilization', 'market_sanitation_compliance']
  }
};
