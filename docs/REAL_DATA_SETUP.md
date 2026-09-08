# CivicPulse AI — REAL_MODE Reference Data & System Setup

This guide details how to configure CivicPulse AI for `REAL_MODE` (`DEMO_MODE=false`), including directory layouts, reference data ingestion commands, and runtime verification.

---

## 1. Directory Structure

CivicPulse AI houses normalized reference datasets under `data/reference/`:

```
CivicPulse-AI/
├── data/
│   └── reference/
│       ├── geography/
│       │   └── bmc_wards.geojson            # 67 BMC ward boundaries (BhubaneswarOne ArcGIS REST)
│       ├── population/
│       │   └── bmc_ward_population.json     # Census 2011 population counts per ward
│       └── facilities/
│           └── bmc_facilities.geojson       # 404+ critical facilities (Schools & Health Facilities)
```

---

## 2. Ingestion CLI Commands

To download, normalize, and validate the authoritative reference data:

```bash
# 1. Download and normalize from BhubaneswarOne ArcGIS REST and Census 2011
npm run data:import

# 2. Validate GeoJSON geometry, coordinate bounds, ward IDs, and provenance tags
npm run data:validate

# 3. Verify that CivicPulse reference providers resolve test coordinates accurately
npm run data:verify
```

---

## 3. Normalized Dataset Formats

### A. BMC Ward Boundaries
* **Path**: `data/reference/geography/bmc_wards.geojson`
* **Format**: Standard RFC 7946 GeoJSON `FeatureCollection` (WGS84 `EPSG:4326`)
* **Properties per feature**:
  ```json
  {
    "ward_id": "WARD-018",
    "ward_number": 18,
    "ward_name": "Ward 18 (North Zone)",
    "municipal_zone": "North Zone",
    "corporator_name": "Sukanti Subudhi",
    "source_type": "REAL",
    "source_name": "BhubaneswarOne ArcGIS REST (AdministrativeBoundary MapServer/4)",
    "source_url": "http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/AdministrativeBoundary/MapServer/4",
    "retrieved_at": "2026-09-08T00:40:54.000Z"
  }
  ```

### B. Ward Population Counts (Census 2011)
* **Path**: `data/reference/population/bmc_ward_population.json`
* **Format**: Array of normalized ward records:
  ```json
  [
    {
      "ward_id": "WARD-018",
      "ward_number": 18,
      "ward_name": "Ward 18 (North Zone)",
      "population": 13094,
      "male_population": 6957,
      "female_population": 6137,
      "households": 2944,
      "source_type": "ESTIMATED",
      "source_name": "Census of India 2011 Primary Census Abstract / Bhubaneswar Municipal Corporation",
      "source_url": "https://censusindia.gov.in",
      "reference_year": 2011,
      "notes": "Census 2011 ward enumeration table from Bhubaneswar Municipal Corporation GIS",
      "retrieved_at": "2026-09-08T00:40:54.000Z"
    }
  ]
  ```
* **Important**: Sourced from Census 2011 (historical). Labeled as `ESTIMATED` to avoid misrepresenting historical census data as real-time population counts.

### C. Public Facilities (Schools & Health Facilities)
* **Path**: `data/reference/facilities/bmc_facilities.geojson`
* **Format**: GeoJSON `Point` features in WGS84:
  ```json
  {
    "type": "Feature",
    "id": "fac_school_21171300102",
    "properties": {
      "id": "fac_school_21171300102",
      "name": "Damana U G U P S",
      "facility_type": "SCHOOL",
      "category_detail": "Primary with Upper Primary",
      "latitude": 20.33253729,
      "longitude": 85.82720356,
      "source_type": "REAL",
      "source_name": "BhubaneswarOne GIS (Category MapServer/22 - School OPEPA DISE)",
      "source_url": "http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/Category/MapServer/22",
      "retrieved_at": "2026-09-08T00:40:54.000Z"
    },
    "geometry": {
      "type": "Point",
      "coordinates": [85.82720356, 20.33253729]
    }
  }
  ```

---

## 4. Runtime Behavior & Degradation Philosophy

CivicPulse AI enforces **zero silent fallbacks**:

| Situation | Behavior in REAL_MODE | Provenance |
|:---|:---|:---|
| GPS inside BMC coverage | Resolves exact polygon (`WARD-001`..`WARD-067`) | `REAL` |
| GPS outside BMC coverage | Returns `ward_id = null`, `ward_name = null` | `UNKNOWN` |
| Ward census record present | Derives population from Census 2011 table | `ESTIMATED` |
| Ward census record missing | Leaves `estimated_population = undefined` | `UNKNOWN` |
| Facility within 500m | Scores exposure factor and records institution | `REAL` |
| No facility within 500m | Sets exposure factor = 0 | `UNKNOWN` |
| Reference files missing | Gracefully degrades without crashing | `UNKNOWN` |

> [!CAUTION]
> In `REAL_MODE`, the system **never** defaults to Ward 18 or 18,400 population. The Golden Demo values exist strictly for evaluation inside `DEMO_MODE=true`.

---

## 5. Environment Configuration for REAL_MODE

1. In `.env`, set:
   ```env
   DEMO_MODE=false
   FIREBASE_PROJECT_ID=civicpulse-ai-production
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   GEMINI_API_KEY=AIzaSy...
   ```
2. Run reference ingestion:
   ```bash
   npm run data:import
   npm run data:validate
   ```
3. Start the application:
   ```bash
   npm run dev
   ```
