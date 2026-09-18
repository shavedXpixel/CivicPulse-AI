import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  canonicalizeValue,
  canonicalJsonStringify,
  computeSha256
} from '../src/migration/canonical';
import {
  checkRelationshipIntegrity,
  inventoryAllMedia,
  CollectionsData
} from '../src/migration/integrity';
import { CANONICAL_COLLECTIONS } from '../src/migration/extractor';

describe('Phase 15B.2 — Authoritative Firestore Snapshot & Integrity Verification', () => {
  describe('1. Read-Only Guarantee (Static Source Analysis)', () => {
    it('verifies extractor.ts contains ZERO Firestore write/mutation calls', () => {
      const extractorSource = fs.readFileSync(
        path.join(__dirname, '../src/migration/extractor.ts'),
        'utf8'
      );

      // Prohibited Firestore document mutation calls
      expect(extractorSource).not.toMatch(/\.doc\s*\([^)]*\)\s*\.set\s*\(/);
      expect(extractorSource).not.toMatch(/\.doc\s*\([^)]*\)\s*\.update\s*\(/);
      expect(extractorSource).not.toMatch(/\.doc\s*\([^)]*\)\s*\.delete\s*\(/);
      expect(extractorSource).not.toMatch(/\.collection\s*\([^)]*\)\s*\.add\s*\(/);
      expect(extractorSource).not.toMatch(/batch\s*\(\s*\)/);
      expect(extractorSource).not.toMatch(/batch\s*\.\s*(set|update|delete|commit)\s*\(/);
      expect(extractorSource).not.toMatch(/runTransaction\s*\(/);
    });

    it('verifies canonical.ts contains ZERO Firestore SDK dependencies or calls', () => {
      const canonicalSource = fs.readFileSync(
        path.join(__dirname, '../src/migration/canonical.ts'),
        'utf8'
      );

      expect(canonicalSource).not.toMatch(/\.collection\s*\(/);
      expect(canonicalSource).not.toMatch(/\.doc\s*\(/);
      expect(canonicalSource).not.toMatch(/firebase-admin/i);
      expect(canonicalSource).not.toMatch(/getFirestore/i);
    });

    it('verifies integrity.ts contains ZERO Firestore write calls', () => {
      const integritySource = fs.readFileSync(
        path.join(__dirname, '../src/migration/integrity.ts'),
        'utf8'
      );

      expect(integritySource).not.toMatch(/\.doc\s*\([^)]*\)\s*\.set\s*\(/);
      expect(integritySource).not.toMatch(/\.doc\s*\([^)]*\)\s*\.update\s*\(/);
      expect(integritySource).not.toMatch(/\.doc\s*\([^)]*\)\s*\.delete\s*\(/);
      expect(integritySource).not.toMatch(/\.collection\s*\(/);
    });
  });

  describe('2. Deterministic Canonical Serialization & SHA-256 Hashing', () => {
    it('produces identical canonical JSON regardless of object key insertion order', () => {
      const objA = { z: 1, a: 2, m: { y: 'test', b: 42 } };
      const objB = { a: 2, m: { b: 42, y: 'test' }, z: 1 };

      const jsonA = canonicalJsonStringify(objA);
      const jsonB = canonicalJsonStringify(objB);

      expect(jsonA).toBe(jsonB);
      expect(computeSha256(jsonA)).toBe(computeSha256(jsonB));
    });

    it('sorts arrays of documents deterministically by id', () => {
      const docs1 = [{ id: 'PRB-002', val: 'b' }, { id: 'PRB-001', val: 'a' }];
      const docs2 = [{ id: 'PRB-001', val: 'a' }, { id: 'PRB-002', val: 'b' }];

      const json1 = canonicalJsonStringify(docs1);
      const json2 = canonicalJsonStringify(docs2);

      expect(json1).toBe(json2);
      expect(computeSha256(json1)).toBe(computeSha256(json2));
    });

    it('sorts primitive arrays deterministically', () => {
      const arr1 = ['banana', 'apple', 'cherry'];
      const arr2 = ['cherry', 'banana', 'apple'];

      expect(canonicalJsonStringify(arr1)).toBe(canonicalJsonStringify(arr2));
    });

    it('serializes Dates and Firestore Timestamps consistently to ISO 8601 UTC strings', () => {
      const now = new Date('2026-09-18T00:00:00.000Z');
      const firestoreTimestamp = {
        _seconds: 1789689600,
        _nanoseconds: 0
      };

      const dateJson = canonicalJsonStringify({ ts: now });
      const tsJson = canonicalJsonStringify({ ts: firestoreTimestamp });

      expect(dateJson).toContain('2026-09-18T00:00:00.000Z');
      expect(tsJson).toContain('2026-09-18T00:00:00.000Z');
    });

    it('omits undefined properties predictably', () => {
      const objWithUndefined = { a: 1, b: undefined, c: 3 };
      const objClean = { a: 1, c: 3 };

      expect(canonicalJsonStringify(objWithUndefined)).toBe(canonicalJsonStringify(objClean));
    });
  });

  describe('3. Dynamic Collection List & Exact ID Capture', () => {
    it('covers all 13 required canonical collections', () => {
      expect(CANONICAL_COLLECTIONS).toContain('users');
      expect(CANONICAL_COLLECTIONS).toContain('citizen_profiles');
      expect(CANONICAL_COLLECTIONS).toContain('departments');
      expect(CANONICAL_COLLECTIONS).toContain('signals');
      expect(CANONICAL_COLLECTIONS).toContain('problem_clusters');
      expect(CANONICAL_COLLECTIONS).toContain('cluster_members');
      expect(CANONICAL_COLLECTIONS).toContain('signal_media');
      expect(CANONICAL_COLLECTIONS).toContain('assignments');
      expect(CANONICAL_COLLECTIONS).toContain('problem_actions');
      expect(CANONICAL_COLLECTIONS).toContain('resolution_evidence');
      expect(CANONICAL_COLLECTIONS).toContain('verification_results');
      expect(CANONICAL_COLLECTIONS).toContain('ai_operations');
      expect(CANONICAL_COLLECTIONS).toContain('idempotency_records');
      expect(CANONICAL_COLLECTIONS.length).toBe(13);
    });
  });

  describe('4. Relationship Integrity & Orphan Detection Logic', () => {
    const validState: CollectionsData = {
      users: [
        { id: 'user_1', role: 'ADMIN' },
        { id: 'user_2', role: 'FIELD_OFFICER' },
        { id: 'citizen_1', role: 'CITIZEN' }
      ],
      departments: [{ id: 'WATCO', name: 'Water Corp' }],
      problem_clusters: [{ id: 'PRB-001', title: 'Problem 1' }],
      signals: [{ id: 'sig_1', citizen_id: 'citizen_1' }],
      cluster_members: [{ id: 'mem_1', problem_id: 'PRB-001', signal_id: 'sig_1' }],
      assignments: [{ id: 'asgn_1', problem_id: 'PRB-001', assigned_to: 'user_2', department_id: 'WATCO' }],
      problem_actions: [{ id: 'act_1', problem_id: 'PRB-001', actor_id: 'user_1' }],
      resolution_evidence: [{ id: 'ev_1', problem_id: 'PRB-001', submitted_by: 'user_2' }],
      verification_results: [{ id: 'ver_1', problem_id: 'PRB-001', verified_by: 'user_1' }],
      signal_media: [{ id: 'med_1', signal_id: 'sig_1', uploaded_by: 'citizen_1', storage_path: 'signals/test.jpg' }]
    };

    it('returns zero orphans on a fully consistent relational dataset', () => {
      const report = checkRelationshipIntegrity(validState);
      expect(report.total_orphans).toBe(0);
      expect(report.blocker_count).toBe(0);
      expect(report.orphan_findings).toHaveLength(0);
    });

    it('detects orphan signal citizen IDs', () => {
      const corruptedState: CollectionsData = {
        ...validState,
        signals: [{ id: 'sig_bad', citizen_id: 'non_existent_citizen' }]
      };
      const report = checkRelationshipIntegrity(corruptedState);
      expect(report.summary.orphan_signal_citizens).toBe(1);
      expect(report.orphan_findings.some((f) => f.entity_id === 'sig_bad' && f.field_name === 'citizen_id')).toBe(true);
    });

    it('detects orphan problem references in cluster_members, assignments, actions, evidence, and verification', () => {
      const corruptedState: CollectionsData = {
        ...validState,
        cluster_members: [{ id: 'mem_bad', problem_id: 'PRB-NONEXISTENT', signal_id: 'sig_1' }],
        assignments: [{ id: 'asgn_bad', problem_id: 'PRB-NONEXISTENT', assigned_to: 'user_2', department_id: 'WATCO' }],
        problem_actions: [{ id: 'act_bad', problem_id: 'PRB-NONEXISTENT', actor_id: 'user_1' }],
        resolution_evidence: [{ id: 'ev_bad', problem_id: 'PRB-NONEXISTENT', submitted_by: 'user_2' }],
        verification_results: [{ id: 'ver_bad', problem_id: 'PRB-NONEXISTENT', verified_by: 'user_1' }]
      };
      const report = checkRelationshipIntegrity(corruptedState);
      expect(report.summary.orphan_problem_references).toBe(5);
    });

    it('detects orphan assignment department and user references', () => {
      const corruptedState: CollectionsData = {
        ...validState,
        assignments: [
          { id: 'asgn_bad_dept', problem_id: 'PRB-001', assigned_to: 'user_2', department_id: 'UNKNOWN_DEPT' },
          { id: 'asgn_bad_user', problem_id: 'PRB-001', assigned_to: 'UNKNOWN_USER', department_id: 'WATCO' }
        ]
      };
      const report = checkRelationshipIntegrity(corruptedState);
      expect(report.summary.orphan_assignment_departments).toBe(1);
      expect(report.summary.orphan_assignment_users).toBe(1);
    });

    it('permits recognized first-class SYSTEM actors in problem actions without flagging as orphan users', () => {
      const systemActionState: CollectionsData = {
        ...validState,
        problem_actions: [
          { id: 'act_sys', problem_id: 'PRB-001', actor_id: 'civicpulse_ai_advisory' },
          { id: 'act_sys2', problem_id: 'PRB-001', actor_id: 'SYSTEM' }
        ]
      };
      const report = checkRelationshipIntegrity(systemActionState);
      expect(report.summary.orphan_action_actors).toBe(0);
    });

    it('detects orphan action actors when a non-system ID does not exist in users', () => {
      const badActorState: CollectionsData = {
        ...validState,
        problem_actions: [
          { id: 'act_ghost', problem_id: 'PRB-001', actor_id: 'ghost_officer_uid' }
        ]
      };
      const report = checkRelationshipIntegrity(badActorState);
      expect(report.summary.orphan_action_actors).toBe(1);
      expect(report.orphan_findings[0]?.missing_reference_id).toBe('ghost_officer_uid');
    });
  });

  describe('5. Media Inventory & Missing-Media Detection', () => {
    it('discovers media references from signals and evidence', () => {
      const mockCollections: CollectionsData = {
        signals: [
          { id: 'sig_1', media_urls: ['https://storage.googleapis.com/civicpulse-ai-f1bbf.firebasestorage.app/signals/photo.jpg'] }
        ],
        resolution_evidence: [
          { id: 'ev_1', media_path: 'evidence/after_fix.jpg' }
        ]
      };

      const media = inventoryAllMedia(mockCollections);
      expect(media).toHaveLength(2);
      expect(media.some((m) => m.owning_record_id === 'sig_1')).toBe(true);
      expect(media.some((m) => m.owning_record_id === 'ev_1')).toBe(true);
    });

    it('flags unprovisioned/remote media as MISSING_REMOTE without crashing', () => {
      const mockCollections: CollectionsData = {
        signal_media: [
          { id: 'sm_1', storage_path: 'signals/unreachable_cloud_image.jpg' }
        ]
      };

      const media = inventoryAllMedia(mockCollections);
      expect(media[0]?.physical_exists).toBe(false);
      expect(media[0]?.status).toBe('MISSING_REMOTE');
      expect(media[0]?.error_message).toContain('GCS bucket');
    });
  });
});
