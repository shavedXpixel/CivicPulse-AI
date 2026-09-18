import fs from 'fs';
import path from 'path';
import { Firestore } from 'firebase-admin/firestore';
import { canonicalJsonStringify, computeSha256 } from './canonical';
import { checkRelationshipIntegrity, CollectionsData, IntegrityCheckReport } from './integrity';

export const CANONICAL_COLLECTIONS = [
  'users',
  'citizen_profiles',
  'departments',
  'signals',
  'problem_clusters',
  'cluster_members',
  'signal_media',
  'assignments',
  'problem_actions',
  'resolution_evidence',
  'verification_results',
  'ai_operations',
  'idempotency_records'
] as const;

export interface UserInventoryEntry {
  legacy_firebase_uid: string;
  email?: string;
  display_name?: string;
  role?: string;
  department_id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  has_citizen_profile: boolean;
  citizen_profile_id?: string;
}

export interface KnownEntityCheck {
  entity_type: string;
  expected_id: string;
  description: string;
  found: boolean;
  actual_data?: any;
}

export interface SnapshotManifestEntry {
  filename: string;
  sha256: string;
  bytes: number;
  record_count: number;
}

export interface SnapshotResult {
  snapshot_id: string;
  timestamp: string;
  extraction_duration_ms: number;
  output_directory: string;
  total_collections: number;
  total_documents: number;
  collection_counts: Record<string, number>;
  document_ids: Record<string, string[]>;
  manifest: SnapshotManifestEntry[];
  manifest_sha256: string;
  user_inventory: UserInventoryEntry[];
  integrity_report: IntegrityCheckReport;
  known_entity_checks: KnownEntityCheck[];
  reproducibility?: {
    verified: boolean;
    identical_counts: boolean;
    identical_ids: boolean;
    identical_hashes: boolean;
    details?: string;
  };
}

export class FirestoreSnapshotExtractor {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Discovers all top-level collection names from Firestore.
   * STRICTLY READ-ONLY.
   */
  public async discoverCollections(): Promise<string[]> {
    const collections = await this.db.listCollections();
    const discovered = new Set<string>(collections.map((c) => c.id));
    // Ensure all canonical collections are considered
    for (const name of CANONICAL_COLLECTIONS) {
      discovered.add(name);
    }
    return Array.from(discovered).sort();
  }

  /**
   * Fetches all documents for a given collection in read-only mode.
   * STRICTLY READ-ONLY.
   */
  public async fetchCollectionDocs(collectionName: string): Promise<any[]> {
    const snapshot = await this.db.collection(collectionName).get();
    const docs: any[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Ensure 'id' matches doc.id
      docs.push({
        ...data,
        id: data.id || doc.id
      });
    });
    // Deterministic sort by id
    return docs.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  /**
   * Executes the full authoritative snapshot extraction.
   * STRICTLY READ-ONLY.
   */
  public async extractSnapshot(options?: {
    outputBaseDir?: string;
    customTimestamp?: string;
    verifyReproducibility?: boolean;
  }): Promise<SnapshotResult> {
    const startTime = Date.now();
    const timestamp = options?.customTimestamp || new Date().toISOString().replace(/[:.]/g, '-');
    const rootDir = path.resolve(process.cwd());
    const outputDir = path.join(options?.outputBaseDir || path.join(rootDir, 'migration', 'snapshots'), timestamp);

    // 1. Discover all collections
    const collectionNames = await this.discoverCollections();
    const collectionsData: CollectionsData = {};
    const collectionCounts: Record<string, number> = {};
    const documentIds: Record<string, string[]> = {};
    let totalDocuments = 0;

    for (const colName of collectionNames) {
      const docs = await this.fetchCollectionDocs(colName);
      collectionsData[colName] = docs;
      collectionCounts[colName] = docs.length;
      documentIds[colName] = docs.map((d) => String(d.id));
      totalDocuments += docs.length;
    }

    // 2. Perform relationship integrity analysis
    const integrityReport = checkRelationshipIntegrity(collectionsData);

    // 3. Perform user ID inventory
    const users = collectionsData.users || [];
    const citizenProfiles = collectionsData.citizen_profiles || [];
    const cpMap = new Map<string, string>();
    for (const cp of citizenProfiles) {
      if (cp.user_id) cpMap.set(cp.user_id, cp.id);
    }

    const userInventory: UserInventoryEntry[] = users.map((u) => ({
      legacy_firebase_uid: u.id,
      email: u.email,
      display_name: u.display_name,
      role: u.role,
      department_id: u.department_id,
      status: u.status,
      created_at: u.created_at,
      updated_at: u.updated_at,
      has_citizen_profile: cpMap.has(u.id),
      citizen_profile_id: cpMap.get(u.id)
    }));

    // 4. Known entity sanity checks
    const knownEntityChecks: KnownEntityCheck[] = [
      {
        entity_type: 'departments',
        expected_id: 'WATCO',
        description: 'Water Corporation of Odisha department record',
        found: (collectionsData.departments || []).some((d) => d.id === 'WATCO'),
        actual_data: (collectionsData.departments || []).find((d) => d.id === 'WATCO')
      },
      {
        entity_type: 'problem_clusters',
        expected_id: 'PRB-2026-3968',
        description: 'Bhubaneswar Ward 12 water pipeline problem',
        found: (collectionsData.problem_clusters || []).some((p) => p.id === 'PRB-2026-3968'),
        actual_data: (collectionsData.problem_clusters || []).find((p) => p.id === 'PRB-2026-3968')
      },
      {
        entity_type: 'users',
        expected_id: 'fb_uid_admin_synthetic_01',
        description: 'Admin account (admin@example.com)',
        found: users.some((u) => u.id === 'fb_uid_admin_synthetic_01'),
        actual_data: users.find((u) => u.id === 'fb_uid_admin_synthetic_01')
      },
      {
        entity_type: 'users',
        expected_id: 'fb_uid_officer_synthetic_02',
        description: 'WATCO Department Officer (officer@example.com)',
        found: users.some((u) => u.id === 'fb_uid_officer_synthetic_02'),
        actual_data: users.find((u) => u.id === 'fb_uid_officer_synthetic_02')
      },
      {
        entity_type: 'users',
        expected_id: 'fb_uid_field_synthetic_03',
        description: 'WATCO Field Officer (field@example.com)',
        found: users.some((u) => u.id === 'fb_uid_field_synthetic_03'),
        actual_data: users.find((u) => u.id === 'fb_uid_field_synthetic_03')
      }
    ];

    // 5. Ensure target directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    // 6. Write collection files and build manifest
    const manifestEntries: SnapshotManifestEntry[] = [];

    for (const colName of collectionNames) {
      const filename = `${colName}.json`;
      const filePath = path.join(outputDir, filename);
      const jsonContent = canonicalJsonStringify(collectionsData[colName] || []);
      fs.writeFileSync(filePath, jsonContent, 'utf8');

      const sha256 = computeSha256(jsonContent);
      manifestEntries.push({
        filename,
        sha256,
        bytes: Buffer.byteLength(jsonContent, 'utf8'),
        record_count: collectionCounts[colName] || 0
      });
    }

    // 7. Write inventory.json
    const durationMs = Date.now() - startTime;
    const inventoryData = {
      snapshot_id: timestamp,
      timestamp: new Date().toISOString(),
      extraction_duration_ms: durationMs,
      total_collections: collectionNames.length,
      total_documents: totalDocuments,
      collection_counts: collectionCounts,
      document_ids: documentIds,
      user_inventory: userInventory,
      integrity_summary: integrityReport.summary,
      total_orphans: integrityReport.total_orphans,
      orphan_findings: integrityReport.orphan_findings,
      media_inventory_count: integrityReport.media_inventory.length,
      missing_media_count: integrityReport.missing_media_count,
      known_entity_checks: knownEntityChecks
    };

    const inventoryContent = canonicalJsonStringify(inventoryData);
    fs.writeFileSync(path.join(outputDir, 'inventory.json'), inventoryContent, 'utf8');
    const inventorySha = computeSha256(inventoryContent);

    manifestEntries.push({
      filename: 'inventory.json',
      sha256: inventorySha,
      bytes: Buffer.byteLength(inventoryContent, 'utf8'),
      record_count: totalDocuments
    });

    // 8. Generate manifest.sha256 file
    manifestEntries.sort((a, b) => a.filename.localeCompare(b.filename));
    const manifestLines = manifestEntries.map((m) => `${m.sha256}  ${m.filename}`).join('\n') + '\n';
    fs.writeFileSync(path.join(outputDir, 'manifest.sha256'), manifestLines, 'utf8');
    const manifestFileSha = computeSha256(manifestLines);

    // 9. Optional Reproducibility verification
    let reproducibilityResult: SnapshotResult['reproducibility'] | undefined;
    if (options?.verifyReproducibility) {
      const run2Counts: Record<string, number> = {};
      const run2Ids: Record<string, string[]> = {};
      let identicalCounts = true;
      let identicalIds = true;
      let identicalHashes = true;

      for (const colName of collectionNames) {
        const run2Docs = await this.fetchCollectionDocs(colName);
        run2Counts[colName] = run2Docs.length;
        run2Ids[colName] = run2Docs.map((d) => String(d.id));

        if (run2Counts[colName] !== collectionCounts[colName]) {
          identicalCounts = false;
        }

        const ids1 = documentIds[colName] || [];
        const ids2 = run2Ids[colName] || [];
        if (ids1.length !== ids2.length || ids1.some((id, idx) => id !== ids2[idx])) {
          identicalIds = false;
        }

        const run2Json = canonicalJsonStringify(run2Docs);
        const run2Hash = computeSha256(run2Json);
        const originalEntry = manifestEntries.find((m) => m.filename === `${colName}.json`);
        if (originalEntry && originalEntry.sha256 !== run2Hash) {
          identicalHashes = false;
        }
      }

      reproducibilityResult = {
        verified: identicalCounts && identicalIds && identicalHashes,
        identical_counts: identicalCounts,
        identical_ids: identicalIds,
        identical_hashes: identicalHashes,
        details:
          identicalCounts && identicalIds && identicalHashes
            ? 'Extraction verified 100% reproducible on identical Firestore state.'
            : 'Warning: Discrepancy observed between dual extractions.'
      };
    }

    return {
      snapshot_id: timestamp,
      timestamp: inventoryData.timestamp,
      extraction_duration_ms: durationMs,
      output_directory: outputDir,
      total_collections: collectionNames.length,
      total_documents: totalDocuments,
      collection_counts: collectionCounts,
      document_ids: documentIds,
      manifest: manifestEntries,
      manifest_sha256: manifestFileSha,
      user_inventory: userInventory,
      integrity_report: integrityReport,
      known_entity_checks: knownEntityChecks,
      reproducibility: reproducibilityResult
    };
  }
}
