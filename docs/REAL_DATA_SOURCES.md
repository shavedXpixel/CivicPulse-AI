# CivicPulse AI — Real Data Sources Specification

This document details the verified reference datasets integrated by CivicPulse AI in `REAL_MODE` (`DEMO_MODE=false`), their authoritative sources, ArcGIS REST endpoints, normalization formats, exact workflow, and provenance designations.

---

## 1. Overview & Degradation Philosophy

All external reference datasets in CivicPulse AI serve as **grounded reference layers**:

* If reference files are **missing**, CivicPulse AI **does not crash** or fabricate data.
* Signal intake, clustering, 8-step lifecycle state machines, and Governance AI remain fully functional.
* Missing reference data is explicitly tagged with `UNKNOWN` provenance.
* No speculative numeric default scores (e.g., arbitrary population score 5 or recurrence score 3) are introduced.
* The canonical 7-factor impact formula and simulation models remain strictly unchanged.

---

## 2. Integrated Reference Datasets

| Dataset | Local Filesystem Path | Format | Role | Verified Source | Provenance Output |
|:---|:---|:---|:---|:---|:---|
| **BMC Ward Boundaries** | `data/reference/geography/bmc_wards.geojson` | GeoJSON (`FeatureCollection`) | Point-in-polygon coordinates → `ward_id` / `ward_name` | BhubaneswarOne ArcGIS REST (`AdministrativeBoundary/MapServer/4`) | `REAL` |
| **Ward Population** | `data/reference/population/bmc_ward_population.json` | JSON Array of objects | Ward population count for impact exposure | Census of India 2011 Primary Census Abstract / BMC | `ESTIMATED` (Census 2011) |
| **Critical Facilities** | `data/reference/facilities/bmc_facilities.geojson` | GeoJSON (`Point` features) | Haversine distance proximity to schools & hospitals | BhubaneswarOne ArcGIS REST (`Category/MapServer`) | `REAL` |

---

## 3. Authoritative Sources & Endpoint Specifications

### 3.1 BMC Ward Boundaries (67 Wards)
* **Authoritative Service**: BhubaneswarOne Smart City GIS Portal
* **Service Type**: ArcGIS REST MapServer / FeatureServer
* **Service Endpoint**: `http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/AdministrativeBoundary/MapServer/4`
* **Query Endpoint**: `http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/AdministrativeBoundary/MapServer/4/query?where=1%3D1&outFields=*&f=geojson`
* **Geometry**: Polygons & MultiPolygons in WGS84 (`EPSG:4326`)
* **Coverage**: All 67 Wards of Bhubaneswar Municipal Corporation
* **Provenance Tag**: `REAL`

### 3.2 Ward Population (Census 2011)
* **Authoritative Source**: Office of the Registrar General & Census Commissioner, India (ORGI) / Directorate of Census Operations, Odisha
* **Primary Dataset**: Primary Census Abstract (PCA) — Khordha District, Bhubaneswar Municipal Corporation
* **Coverage**: 67 BMC Wards (enumerated total population: 835,218; city total 843,402)
* **Reference Year**: 2011 (National census was postponed in 2021)
* **Important**: This is HISTORICAL data, not current population.
* **Provenance Tag**: `ESTIMATED` (Census 2011) — Never presented as current real-time census.

### 3.3 Public Facilities (Schools & Health Facilities)
* **Authoritative Service**: BhubaneswarOne Smart City GIS Portal (`Category/MapServer`)
* **Endpoints**:
  * **Schools (OPEPA DISE)**: Layer 22 — `http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/Category/MapServer/22` (354 schools)
  * **Hospitals**: Layer 37 — `http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/Category/MapServer/37` (27 hospitals)
  * **Govt. Dispensaries**: Layer 32 — `http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/Category/MapServer/32` (5 dispensaries)
  * **Urban Community Health Centres (UCHC)**: Layer 33 — `http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/Category/MapServer/33` (5 centres)
  * **Urban Primary Health Centres (UPHC)**: Layer 34 — `http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/Category/MapServer/34` (13 centres)
  * **Other Health Facilities**: Layer 39 — `http://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne/Category/MapServer/39` (4 facilities)
* **Total Facilities**: 408 verified civic institutions
* **Geometry**: Point coordinates `[longitude, latitude]` in WGS84
* **Provenance Tag**: `REAL`

---

## 4. End-to-End Ingestion Workflow

```
[ GOVERNMENT / CENSUS SOURCE ]
             │
             ▼
[ DOWNLOAD / QUERY ]
  - ArcGIS REST queries (AdministrativeBoundary, Category MapServer)
  - Census 2011 Primary Census Abstract
             │
             ▼
[ NORMALIZE ]
  - Convert to standard GeoJSON FeatureCollections (WGS84)
  - Normalize ward IDs to 'WARD-001'..'WARD-067'
  - Standardize facility types ('SCHOOL', 'HOSPITAL')
  - Attach mandatory provenance metadata (source_type, source_url, retrieved_at)
             │
             ▼
[ FILE LOCATION ]
  - data/reference/geography/bmc_wards.geojson
  - data/reference/population/bmc_ward_population.json
  - data/reference/facilities/bmc_facilities.geojson
             │
             ▼
[ VALIDATE: npm run data:validate ]
  - GeoJSON structural validation
  - Coordinate bounding box check (Bhubaneswar region: 20.1-20.4°N, 85.7-85.9°E)
  - Ward count check (67) & duplicate detection
  - Population integrity (positive integer values)
             │
             ▼
[ IMPORT: npm run data:import ]
  - Non-destructive write with backup validation
             │
             ▼
[ CIVICPULSE REFERENCE PROVIDERS ]
  - StaticGeographyProvider (Point-in-polygon ray casting)
  - StaticPopulationProvider (Normalized ward key lookup)
  - StaticFacilityProvider (Haversine distance proximity indexing)
             │
             ▼
[ REAL_MODE OPERATIONAL PIPELINE ]
  - Citizen GPS → Real BMC Ward (REAL)
  - Ward → Census Population Exposure (ESTIMATED)
  - GPS → Nearby Critical Facility (REAL)
  - Fallback to Ward 18 strictly forbidden
```

---

## 5. Provenance Classification Matrix

| Category | Definition | Example in CivicPulse | Badge UI |
|:---|:---|:---|:---|
| **REAL** | Ground-truth coordinates, boundaries, or facilities sourced from official GIS services or validated telemetry. | BMC 67 Ward boundaries; OPEPA DISE Schools; Government Hospitals. | `Real` (Emerald) |
| **ESTIMATED** | Statistically derived or historical census figures that represent an approximation of current conditions. | Census of India 2011 ward population counts. | `Estimated` (Amber) |
| **SYNTHETIC** | Hardcoded demo scenario fixtures designed for reproducible evaluations and offline hackathon demonstrations. | Golden Demo `PRB-2026-0819` (Ward 18, 18,400 pop, 92 impact score). | `Synthetic demo` (Purple) |
| **UNKNOWN** | State when an asset lacks enrichment data or falls outside geographic coverage boundaries. | Out-of-coverage coordinates; missing reference files. | `Unknown` (Muted Gray) |

---

## 6. CLI Commands Reference

```bash
# Fetch and normalize latest reference datasets from BhubaneswarOne & Census
npm run data:import

# Validate schemas, coordinate bounds, uniqueness, and provenance
npm run data:validate

# Run end-to-end verification queries through CivicPulse reference providers
npm run data:verify
```
