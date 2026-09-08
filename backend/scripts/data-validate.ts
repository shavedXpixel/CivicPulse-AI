import fs from 'fs';
import path from 'path';

interface ValidationSummary {
  dataset: string;
  filePath: string;
  recordCount: number;
  status: 'PASS' | 'FAIL';
  errors: string[];
  warnings: string[];
}

function validateData(): boolean {
  console.log('===============================================================');
  console.log(' CivicPulse AI — Reference Data Validator');
  console.log('===============================================================\n');

  const rootDir = path.resolve(process.cwd(), '..');
  const baseDataDir = fs.existsSync(path.join(process.cwd(), 'data'))
    ? path.join(process.cwd(), 'data')
    : path.join(rootDir, 'data');

  const geoPath = path.join(baseDataDir, 'reference', 'geography', 'bmc_wards.geojson');
  const popPath = path.join(baseDataDir, 'reference', 'population', 'bmc_ward_population.json');
  const facPath = path.join(baseDataDir, 'reference', 'facilities', 'bmc_facilities.geojson');

  const summaries: ValidationSummary[] = [];
  let allPass = true;

  // =========================================================================
  // 1. Validate BMC Ward Boundaries
  // =========================================================================
  const geoSummary: ValidationSummary = {
    dataset: 'BMC Ward Boundaries (GeoJSON)',
    filePath: geoPath,
    recordCount: 0,
    status: 'PASS',
    errors: [],
    warnings: []
  };

  if (!fs.existsSync(geoPath)) {
    geoSummary.errors.push(`File not found: ${geoPath}`);
    geoSummary.status = 'FAIL';
  } else {
    try {
      const geoRaw = fs.readFileSync(geoPath, 'utf8');
      const geoJson = JSON.parse(geoRaw);

      if (geoJson.type !== 'FeatureCollection' || !Array.isArray(geoJson.features)) {
        geoSummary.errors.push('Root element must be a GeoJSON FeatureCollection.');
      } else {
        geoSummary.recordCount = geoJson.features.length;
        if (geoJson.features.length !== 67) {
          geoSummary.warnings.push(`Expected 67 wards, found ${geoJson.features.length}`);
        }

        const wardIds = new Set<string>();
        for (let i = 0; i < geoJson.features.length; i++) {
          const feat = geoJson.features[i];
          const props = feat.properties || {};
          const wardId = props.ward_id;

          if (!wardId) {
            geoSummary.errors.push(`Feature #${i} is missing ward_id`);
          } else if (wardIds.has(wardId)) {
            geoSummary.errors.push(`Duplicate ward_id detected: ${wardId}`);
          } else {
            wardIds.add(wardId);
          }

          if (props.source_type !== 'REAL') {
            geoSummary.errors.push(`Ward ${wardId} source_type must be 'REAL', got '${props.source_type}'`);
          }

          if (!props.source_name || !props.source_url) {
            geoSummary.warnings.push(`Ward ${wardId} missing source_name or source_url`);
          }

          const geom = feat.geometry;
          if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) {
            geoSummary.errors.push(`Ward ${wardId} has invalid geometry type: ${geom?.type}`);
          } else if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
            geoSummary.errors.push(`Ward ${wardId} has empty coordinates`);
          }
        }
      }
    } catch (e: any) {
      geoSummary.errors.push(`JSON parse error: ${e.message}`);
    }
  }

  if (geoSummary.errors.length > 0) geoSummary.status = 'FAIL';
  summaries.push(geoSummary);

  // =========================================================================
  // 2. Validate Ward Population
  // =========================================================================
  const popSummary: ValidationSummary = {
    dataset: 'BMC Ward Population (Census 2011)',
    filePath: popPath,
    recordCount: 0,
    status: 'PASS',
    errors: [],
    warnings: []
  };

  if (!fs.existsSync(popPath)) {
    popSummary.errors.push(`File not found: ${popPath}`);
    popSummary.status = 'FAIL';
  } else {
    try {
      const popRaw = fs.readFileSync(popPath, 'utf8');
      const popData = JSON.parse(popRaw);

      let items: any[] = [];
      if (Array.isArray(popData)) {
        items = popData;
      } else if (typeof popData === 'object' && popData !== null) {
        items = Object.values(popData);
      } else {
        popSummary.errors.push('Population file must contain an Array or Object of ward populations.');
      }

      popSummary.recordCount = items.length;
      if (items.length !== 67) {
        popSummary.warnings.push(`Expected 67 ward population records, found ${items.length}`);
      }

      let totalPop = 0;
      const seenWardIds = new Set<string>();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const wardId = item.ward_id || item.id;
        const pop = item.population;

        if (!wardId) {
          popSummary.errors.push(`Item #${i} missing ward_id`);
        } else if (seenWardIds.has(wardId)) {
          popSummary.errors.push(`Duplicate ward population record: ${wardId}`);
        } else {
          seenWardIds.add(wardId);
        }

        if (typeof pop !== 'number' || isNaN(pop) || pop <= 0) {
          popSummary.errors.push(`Ward ${wardId} invalid population count: ${pop}`);
        } else {
          totalPop += pop;
        }

        if (item.source_type !== 'ESTIMATED') {
          popSummary.errors.push(`Ward ${wardId} source_type must be 'ESTIMATED', got '${item.source_type}'`);
        }

        if (item.reference_year !== 2011) {
          popSummary.warnings.push(`Ward ${wardId} reference_year should be 2011, got ${item.reference_year}`);
        }
      }

      if (totalPop < 800000) {
        popSummary.warnings.push(`Total enumerated city population (${totalPop}) is lower than expected 843k`);
      }
    } catch (e: any) {
      popSummary.errors.push(`JSON parse error: ${e.message}`);
    }
  }

  if (popSummary.errors.length > 0) popSummary.status = 'FAIL';
  summaries.push(popSummary);

  // =========================================================================
  // 3. Validate Public Facilities
  // =========================================================================
  const facSummary: ValidationSummary = {
    dataset: 'Public Facilities (GeoJSON Points)',
    filePath: facPath,
    recordCount: 0,
    status: 'PASS',
    errors: [],
    warnings: []
  };

  if (!fs.existsSync(facPath)) {
    facSummary.errors.push(`File not found: ${facPath}`);
    facSummary.status = 'FAIL';
  } else {
    try {
      const facRaw = fs.readFileSync(facPath, 'utf8');
      const facJson = JSON.parse(facRaw);

      if (facJson.type !== 'FeatureCollection' || !Array.isArray(facJson.features)) {
        facSummary.errors.push('Facilities file must be a GeoJSON FeatureCollection.');
      } else {
        facSummary.recordCount = facJson.features.length;
        if (facJson.features.length < 50) {
          facSummary.warnings.push(`Low facility count: ${facJson.features.length}`);
        }

        const seenFacIds = new Set<string>();
        let schoolCount = 0;
        let hospCount = 0;

        for (let i = 0; i < facJson.features.length; i++) {
          const feat = facJson.features[i];
          const props = feat.properties || {};
          const id = props.id || feat.id;

          if (!id) {
            facSummary.errors.push(`Facility #${i} missing id`);
          } else if (seenFacIds.has(id)) {
            facSummary.errors.push(`Duplicate facility id: ${id}`);
          } else {
            seenFacIds.add(id);
          }

          if (!props.name) {
            facSummary.errors.push(`Facility ${id} missing name`);
          }

          const fType = props.facility_type;
          if (fType === 'SCHOOL') schoolCount++;
          else if (fType === 'HOSPITAL') hospCount++;
          else {
            facSummary.warnings.push(`Facility ${id} has unexpected type: ${fType}`);
          }

          if (props.source_type !== 'REAL') {
            facSummary.errors.push(`Facility ${id} source_type must be 'REAL', got '${props.source_type}'`);
          }

          const geom = feat.geometry;
          if (!geom || geom.type !== 'Point' || !Array.isArray(geom.coordinates)) {
            facSummary.errors.push(`Facility ${id} invalid Point geometry`);
          } else {
            const lng = geom.coordinates[0];
            const lat = geom.coordinates[1];
            if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
              facSummary.errors.push(`Facility ${id} invalid coordinates: [${lng}, ${lat}]`);
            } else if (lat < 19 || lat > 22 || lng < 84 || lng > 87) {
              facSummary.warnings.push(`Facility ${id} coordinates outside Bhubaneswar region: [${lng}, ${lat}]`);
            }
          }
        }
      }
    } catch (e: any) {
      facSummary.errors.push(`JSON parse error: ${e.message}`);
    }
  }

  if (facSummary.errors.length > 0) facSummary.status = 'FAIL';
  summaries.push(facSummary);

  // =========================================================================
  // Report Results
  // =========================================================================
  for (const s of summaries) {
    const symbol = s.status === 'PASS' ? '✓' : '✗';
    console.log(`[${symbol}] ${s.dataset}`);
    console.log(`    File:   ${s.filePath}`);
    console.log(`    Count:  ${s.recordCount} records`);
    console.log(`    Status: ${s.status}`);
    if (s.errors.length > 0) {
      console.log('    Errors:');
      s.errors.slice(0, 5).forEach((e) => console.log(`      - ${e}`));
      if (s.errors.length > 5) console.log(`      ... and ${s.errors.length - 5} more`);
      allPass = false;
    }
    if (s.warnings.length > 0) {
      console.log('    Warnings:');
      s.warnings.slice(0, 3).forEach((w) => console.log(`      - ${w}`));
    }
    console.log('');
  }

  if (allPass) {
    console.log('===============================================================');
    console.log(' All reference datasets passed schema and spatial validation!');
    console.log('===============================================================\n');
  } else {
    console.error('===============================================================');
    console.error(' Validation failed! Fix above errors before proceeding.');
    console.error('===============================================================\n');
  }

  return allPass;
}

const passed = validateData();
process.exit(passed ? 0 : 1);
