import fs from 'fs';
import path from 'path';

const ARCGIS_ADMIN_BOUNDARY_URL =
  'http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/AdministrativeBoundary/MapServer/4/query?where=1%3D1&outFields=*&f=geojson';

const ARCGIS_SCHOOLS_URL =
  'http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/Category/MapServer/22/query?where=1%3D1&outFields=*&f=geojson';

const ARCGIS_HEALTH_URLS = [
  { id: 31, name: 'District Headquarter Hospital', type: 'HOSPITAL' },
  { id: 32, name: 'Govt. Dispensary', type: 'HOSPITAL' },
  { id: 33, name: 'Urban Community Health Centre', type: 'HOSPITAL' },
  { id: 34, name: 'Urban Primary Health Centre', type: 'HOSPITAL' },
  { id: 37, name: 'Hospital', type: 'HOSPITAL' },
  { id: 39, name: 'Other Health Facility', type: 'HOSPITAL' }
];

async function fetchWithTimeout(url: string, timeoutMs: number = 15000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

async function importReferenceData() {
  console.log('===============================================================');
  console.log(' CivicPulse AI — Reference Data Importer');
  console.log(' Authoritative Sources: BhubaneswarOne ArcGIS REST & Census 2011');
  console.log('===============================================================\n');

  const rootDir = path.resolve(process.cwd(), '..');
  const baseDataDir = fs.existsSync(path.join(process.cwd(), 'data'))
    ? path.join(process.cwd(), 'data')
    : path.join(rootDir, 'data');

  const geoDir = path.join(baseDataDir, 'reference', 'geography');
  const popDir = path.join(baseDataDir, 'reference', 'population');
  const facDir = path.join(baseDataDir, 'reference', 'facilities');

  fs.mkdirSync(geoDir, { recursive: true });
  fs.mkdirSync(popDir, { recursive: true });
  fs.mkdirSync(facDir, { recursive: true });

  const retrievedAt = new Date().toISOString();

  // =========================================================================
  // 1. BMC Ward Boundaries & Population
  // =========================================================================
  console.log('1. Querying BMC Ward Boundaries & Population from AdministrativeBoundary MapServer/4...');
  let wardData: any;
  try {
    wardData = await fetchWithTimeout(ARCGIS_ADMIN_BOUNDARY_URL);
  } catch (err: any) {
    console.warn(`Direct fetch failed (${err.message}). Trying DataMeet mirror...`);
    wardData = await fetchWithTimeout(
      'https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/master/Bhubaneswar/Wards.GeoJSON'
    );
  }

  if (!wardData || !wardData.features || wardData.features.length === 0) {
    throw new Error('Failed to retrieve BMC Ward features.');
  }

  console.log(`   Retrieved ${wardData.features.length} raw ward features.`);

  // Sort wards by sno
  const sortedRawFeatures = [...wardData.features].sort((a: any, b: any) => {
    const snoA = Number(a.properties.sno || a.properties.OBJECTID_1 || 0);
    const snoB = Number(b.properties.sno || b.properties.OBJECTID_1 || 0);
    return snoA - snoB;
  });

  const normalizedWardFeatures: any[] = [];
  const normalizedPopulationList: any[] = [];

  for (const rawFeat of sortedRawFeatures) {
    const props = rawFeat.properties || {};
    const sno = Number(props.sno || props.OBJECTID_1 || props.objectid);
    const wardId = `WARD-${String(sno).padStart(3, '0')}`;
    const rawWardNo = String(props.wardno || `W${sno}`);
    const municipalZone = String(props.municipalz || props.municipalzone || 'Bhubaneswar Central');
    const wardName = `Ward ${sno} (${municipalZone})`;
    const corporator = String(props.nameofthec || props.nameofthecorporator || '');
    const pop = Number(props.totalwardp || props.totalwardpopulation || 0);
    const malePop = Number(props.totalmalep || props.totalmalepopulation || 0);
    const femalePop = Number(props.totalfemal || props.totalfemalepopulation || 0);
    const households = Number(props.numberofho || props.numberofhouseholds || 0);

    // Normalized GeoJSON Feature
    normalizedWardFeatures.push({
      type: 'Feature',
      id: wardId,
      properties: {
        ward_id: wardId,
        ward_number: sno,
        ward_code: rawWardNo,
        ward_name: wardName,
        municipal_zone: municipalZone,
        corporator_name: corporator || undefined,
        households: households > 0 ? households : undefined,
        source_type: 'REAL',
        source_name: 'BhubaneswarOne ArcGIS REST (AdministrativeBoundary MapServer/4)',
        source_url: ARCGIS_ADMIN_BOUNDARY_URL,
        retrieved_at: retrievedAt
      },
      geometry: rawFeat.geometry
    });

    // Normalized Population Record
    normalizedPopulationList.push({
      ward_id: wardId,
      ward_number: sno,
      ward_name: wardName,
      population: pop,
      male_population: malePop > 0 ? malePop : undefined,
      female_population: femalePop > 0 ? femalePop : undefined,
      households: households > 0 ? households : undefined,
      source_type: 'ESTIMATED',
      source_name: 'Census of India 2011 Primary Census Abstract / Bhubaneswar Municipal Corporation',
      source_url: 'https://censusindia.gov.in',
      reference_year: 2011,
      notes: 'Census 2011 ward enumeration table from Bhubaneswar Municipal Corporation GIS',
      retrieved_at: retrievedAt
    });
  }

  const wardGeoJson = {
    type: 'FeatureCollection',
    name: 'BMC_WardBoundary',
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
    },
    metadata: {
      description: 'Official 67 Ward Boundaries of Bhubaneswar Municipal Corporation (BMC)',
      source_name: 'BhubaneswarOne ArcGIS REST (AdministrativeBoundary / BMC_WardBoundary)',
      source_type: 'REAL',
      source_url: ARCGIS_ADMIN_BOUNDARY_URL,
      feature_count: normalizedWardFeatures.length,
      retrieved_at: retrievedAt
    },
    features: normalizedWardFeatures
  };

  const wardFilePath = path.join(geoDir, 'bmc_wards.geojson');
  fs.writeFileSync(wardFilePath, JSON.stringify(wardGeoJson, null, 2), 'utf8');
  console.log(`   ✓ Wrote ${normalizedWardFeatures.length} wards to ${wardFilePath}`);

  const popFilePath = path.join(popDir, 'bmc_ward_population.json');
  fs.writeFileSync(popFilePath, JSON.stringify(normalizedPopulationList, null, 2), 'utf8');
  console.log(`   ✓ Wrote ${normalizedPopulationList.length} population records to ${popFilePath}`);

  // =========================================================================
  // 2. Critical Facilities (Schools + Health Facilities)
  // =========================================================================
  console.log('\n2. Querying Critical Facilities from Category MapServer...');
  const normalizedFacilities: any[] = [];
  const seenIds = new Set<string>();

  // A. Schools (Layer 22: School - OPEPA DISE)
  console.log('   Querying School (OPEPA DISE) layer 22...');
  try {
    const schoolsData = await fetchWithTimeout(ARCGIS_SCHOOLS_URL);
    const schoolFeatures = schoolsData.features || [];
    console.log(`   Retrieved ${schoolFeatures.length} schools.`);

    for (const feat of schoolFeatures) {
      const p = feat.properties || {};
      const coords = feat.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;

      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (isNaN(lng) || isNaN(lat) || lat < 19 || lat > 22 || lng < 84 || lng > 87) continue;

      const rawId = p.School_ID || p.OBJECTID || p.OBJECTID_1 || p.Sl_no_;
      const id = `fac_school_${rawId}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const name = String(p.School_Name || 'Public School').trim();
      const villageOrWard = String(p.Village_Name || p.Block_name || '').trim();

      normalizedFacilities.push({
        type: 'Feature',
        id,
        properties: {
          id,
          name,
          facility_type: 'SCHOOL',
          category_detail: String(p.Category || 'School').trim(),
          management: p.Management || undefined,
          address: p.Address || (villageOrWard ? `Near ${villageOrWard}` : undefined),
          latitude: lat,
          longitude: lng,
          source_type: 'REAL',
          source_name: 'BhubaneswarOne GIS (Category MapServer/22 - School OPEPA DISE)',
          source_url: ARCGIS_SCHOOLS_URL,
          retrieved_at: retrievedAt
        },
        geometry: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      });
    }
  } catch (err: any) {
    console.warn(`   Warning: Failed to fetch schools layer (${err.message})`);
  }

  // B. Health Facilities (Layers 31, 32, 33, 34, 37, 39)
  for (const hLayer of ARCGIS_HEALTH_URLS) {
    const hUrl = `http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/Category/MapServer/${hLayer.id}/query?where=1%3D1&outFields=*&f=geojson`;
    try {
      const hData = await fetchWithTimeout(hUrl);
      const hFeatures = hData.features || [];
      console.log(`   Layer ${hLayer.id} (${hLayer.name}): ${hFeatures.length} features.`);

      for (const feat of hFeatures) {
        const p = feat.properties || {};
        const coords = feat.geometry?.coordinates;
        if (!coords || coords.length < 2) continue;

        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (isNaN(lng) || isNaN(lat) || lat < 19 || lat > 22 || lng < 84 || lng > 87) continue;

        const rawId = p.OBJECTID || p.OBJECTID_1 || p.Sl_no_ || p.id;
        const id = `fac_health_${hLayer.id}_${rawId}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const name = String(p.Hospital_Name || p.Health_Facility_Name || p.Name || p.Facility_Name || hLayer.name).trim();

        normalizedFacilities.push({
          type: 'Feature',
          id,
          properties: {
            id,
            name,
            facility_type: 'HOSPITAL',
            category_detail: hLayer.name,
            address: p.Address || p.Location || undefined,
            latitude: lat,
            longitude: lng,
            source_type: 'REAL',
            source_name: `BhubaneswarOne GIS (Category MapServer/${hLayer.id} - ${hLayer.name})`,
            source_url: hUrl,
            retrieved_at: retrievedAt
          },
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        });
      }
    } catch (err: any) {
      console.warn(`   Warning: Failed to fetch health layer ${hLayer.id} (${err.message})`);
    }
  }

  const facilitiesGeoJson = {
    type: 'FeatureCollection',
    name: 'BMC_CriticalFacilities',
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
    },
    metadata: {
      description: 'Critical Public Facilities in Bhubaneswar (Schools from OPEPA DISE, Health Facilities from BhubaneswarOne GIS)',
      source_name: 'BhubaneswarOne GIS (Category MapServer)',
      source_type: 'REAL',
      feature_count: normalizedFacilities.length,
      retrieved_at: retrievedAt
    },
    features: normalizedFacilities
  };

  const facFilePath = path.join(facDir, 'bmc_facilities.geojson');
  fs.writeFileSync(facFilePath, JSON.stringify(facilitiesGeoJson, null, 2), 'utf8');
  console.log(`   ✓ Wrote ${normalizedFacilities.length} facilities to ${facFilePath}`);

  console.log('\n===============================================================');
  console.log(' Reference Data Ingestion Complete!');
  console.log(` - Wards:        ${normalizedWardFeatures.length} (REAL)`);
  console.log(` - Population:   ${normalizedPopulationList.length} (ESTIMATED Census 2011)`);
  console.log(` - Facilities:   ${normalizedFacilities.length} (REAL)`);
  console.log('===============================================================\n');
}

importReferenceData().catch((err) => {
  console.error('Fatal error during data import:', err);
  process.exit(1);
});
