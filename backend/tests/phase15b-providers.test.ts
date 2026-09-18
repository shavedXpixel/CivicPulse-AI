import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { PostgresDatabaseProvider } from '../src/providers/database/postgres.provider';
import { R2StorageProvider } from '../src/providers/storage/r2.storage';
import { OpenAIProvider } from '../src/providers/ai/openai.provider';
import { SnapshotImporter } from '../src/migration/importer';
import { MAX_MEDIA_FILE_SIZE_BYTES } from '@civicpulse/shared';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockImplementation(async (_client: any, command: any) => {
    return `https://r2.cloudflarestorage.com/mock-bucket/${command.input.Key}?signed=true`;
  })
}));

describe('Phase 15B.3 — Target Non-Google Providers & Importer', () => {
  describe('1. PostgresDatabaseProvider Contract & Transactions', () => {
    let mockClient: any;
    let mockPool: any;
    let provider: PostgresDatabaseProvider;

    beforeEach(() => {
      mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      };
      mockPool = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn().mockResolvedValue(undefined)
      };
      provider = new PostgresDatabaseProvider({ pool: mockPool as any });
    });

    it('implements IDatabaseProvider interface and queries users by legacy UID', async () => {
      const mockUserRow = {
        id: '11111111-1111-4111-a111-111111111111',
        legacy_firebase_uid: 'fb_uid_admin_synthetic_01',
        email: 'admin@example.com',
        display_name: 'Pupu Hari',
        role: 'ADMIN',
        status: 'ACTIVE',
        created_at: new Date('2026-09-15T13:25:48.075Z'),
        updated_at: new Date('2026-09-15T13:25:48.075Z')
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockUserRow] });

      const user = await provider.getUser('fb_uid_admin_synthetic_01');
      expect(user).not.toBeNull();
      expect(user?.id).toBe('fb_uid_admin_synthetic_01');
      expect(user?.email).toBe('admin@example.com');
      expect(user?.role).toBe('ADMIN');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('legacy_firebase_uid = $1'),
        ['fb_uid_admin_synthetic_01']
      );
    });

    it('queries users by UUID when given a valid UUID', async () => {
      const uuid = '22222222-2222-4222-a222-222222222222';
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: uuid,
            legacy_firebase_uid: null,
            email: 'uuid.user@example.com',
            role: 'CITIZEN',
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const user = await provider.getUser(uuid);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(uuid);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users WHERE id = $1'),
        [uuid]
      );
    });

    it('executes callbacks within BEGIN and COMMIT in withTransaction', async () => {
      const result = await provider.withTransaction(async (client) => {
        await client.query('SELECT 1;');
        return 'success_val';
      });

      expect(result).toBe('success_val');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1;');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('rolls back transaction on failure in withTransaction', async () => {
      await expect(
        provider.withTransaction(async (client) => {
          await client.query('INSERT INTO fail;');
          throw new Error('Database error');
        })
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('enforces row-level lock FOR UPDATE during atomicTransitionStatus', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'PRB-001',
              status: 'NEW',
              title: 'Problem 1',
              category: 'WATER',
              impact_score: 50,
              impact_level: 'LOW'
            }
          ]
        }) // SELECT ... FOR UPDATE
        .mockResolvedValueOnce({ rows: [] }) // UPDATE problem_clusters
        .mockResolvedValueOnce({ rows: [] }) // INSERT problem_actions
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 'PRB-001',
            status: 'IN_PROGRESS',
            title: 'Problem 1',
            category: 'WATER',
            impact_score: 50,
            impact_level: 'LOW'
          }
        ]
      }); // pool.query for createAction and getProblemCluster

      const res = await provider.atomicTransitionStatus(
        'PRB-001',
        'NEW',
        'IN_PROGRESS',
        {
          id: 'act_001',
          problem_id: 'PRB-001',
          actor_id: 'user_1',
          actor_role: 'DEPARTMENT_OFFICER',
          action_type: 'STATUS_CHANGE',
          previous_state: 'NEW',
          new_state: 'IN_PROGRESS',
          created_at: new Date().toISOString()
        }
      );

      expect(res.problem.status).toBe('IN_PROGRESS');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM problem_clusters WHERE id = $1 FOR UPDATE;'),
        ['PRB-001']
      );
    });
  });

  describe('2. R2StorageProvider S3-Compatible Media Operations', () => {
    let r2: R2StorageProvider;

    beforeEach(() => {
      r2 = new R2StorageProvider({
        accountId: 'mock-account-id',
        accessKeyId: 'mock-access-key',
        secretAccessKey: 'mock-secret-key',
        bucketName: 'mock-bucket'
      });
    });

    it('initializes with configured bucket name', () => {
      expect(r2.getBucketName()).toBe('mock-bucket');
    });

    it('rejects uploads exceeding canonical 10MB limit', async () => {
      const oversizedBuffer = Buffer.alloc(MAX_MEDIA_FILE_SIZE_BYTES + 1024);
      await expect(
        r2.saveFile('signals/large.jpg', oversizedBuffer, 'image/jpeg')
      ).rejects.toThrow(/exceeds 10 MB maximum allowed limit/);

      await expect(
        r2.getSignedUploadUrl('large.jpg', 'image/jpeg', MAX_MEDIA_FILE_SIZE_BYTES + 100)
      ).rejects.toThrow(/exceeds canonical limit/);
    });

    it('generates deterministic file URL path', async () => {
      const url = await r2.getFileUrl('signals/photo.jpg');
      expect(url).toBe('/api/v1/storage/files?path=signals%2Fphoto.jpg');
    });

    it('saves file, checks existence, reads, and deletes using S3 client', async () => {
      const mockSend = vi.fn();
      (r2 as any).s3Client = { send: mockSend };

      // 1. saveFile
      mockSend.mockResolvedValueOnce({});
      const saveUrl = await r2.saveFile('signals/test.jpg', Buffer.from('test-image-data'), 'image/jpeg');
      expect(saveUrl).toBe('/api/v1/storage/files?path=signals%2Ftest.jpg');
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'mock-bucket',
          Key: 'signals/test.jpg',
          ContentType: 'image/jpeg'
        })
      }));

      // 2. objectExists: true
      mockSend.mockResolvedValueOnce({});
      const exists = await r2.objectExists('signals/test.jpg');
      expect(exists).toBe(true);

      // 3. objectExists: false on NotFound
      mockSend.mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });
      const notFound = await r2.objectExists('signals/missing.jpg');
      expect(notFound).toBe(false);

      // 4. getFile: returns buffer and mimeType
      const asyncIter = (async function* () {
        yield Buffer.from('chunk1-');
        yield Buffer.from('chunk2');
      })();
      mockSend.mockResolvedValueOnce({
        Body: asyncIter,
        ContentType: 'image/jpeg'
      });
      const file = await r2.getFile('signals/test.jpg');
      expect(file).not.toBeNull();
      expect(file?.buffer.toString()).toBe('chunk1-chunk2');
      expect(file?.mimeType).toBe('image/jpeg');

      // 5. getFile: returns null on NoSuchKey
      mockSend.mockRejectedValueOnce({ name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } });
      const missingFile = await r2.getFile('signals/missing.jpg');
      expect(missingFile).toBeNull();

      // 6. deleteFile
      mockSend.mockResolvedValueOnce({});
      await expect(r2.deleteFile('signals/test.jpg')).resolves.toBeUndefined();
    });

    it('generates deterministic and idempotent object keys on retry for signals and evidence', async () => {
      // 1. Signals: retry with identical signalId and mediaId produces exact same storage path
      const signalUpload1 = await r2.getSignedUploadUrl('broken_water_main.jpg', 'image/jpeg', 5 * 1024 * 1024, {
        signalId: 'SIG-2026-9001',
        mediaId: 'MED-1234'
      });
      const signalUpload2 = await r2.getSignedUploadUrl('broken_water_main.jpg', 'image/jpeg', 5 * 1024 * 1024, {
        signalId: 'SIG-2026-9001',
        mediaId: 'MED-1234'
      });

      expect(signalUpload1.storagePath).toBe('signals/SIG-2026-9001/MED-1234-broken_water_main.jpg');
      expect(signalUpload1.storagePath).toBe(signalUpload2.storagePath);
      expect(signalUpload1.uploadUrl).toContain('signals/SIG-2026-9001/MED-1234-broken_water_main.jpg');

      // 2. Evidence: retry with identical problemId and evidenceId produces exact same storage path
      const evidenceUpload1 = await r2.getSignedUploadUrl('repaired_pipe.png', 'image/png', 5 * 1024 * 1024, {
        problemId: 'PRB-2026-3968',
        evidenceId: 'EVD-5678'
      });
      const evidenceUpload2 = await r2.getSignedUploadUrl('repaired_pipe.png', 'image/png', 5 * 1024 * 1024, {
        problemId: 'PRB-2026-3968',
        evidenceId: 'EVD-5678'
      });

      expect(evidenceUpload1.storagePath).toBe('evidence/PRB-2026-3968/EVD-5678-repaired_pipe.png');
      expect(evidenceUpload1.storagePath).toBe(evidenceUpload2.storagePath);

      // 3. Sanitizes unsafe characters deterministically
      const unsafeUpload = await r2.getSignedUploadUrl('my test image #1 (v2).jpg', 'image/jpeg', 5 * 1024 * 1024, {
        signalId: 'SIG/2026:special',
        mediaId: 'MED 9999'
      });
      expect(unsafeUpload.storagePath).toBe('signals/SIG_2026_special/MED_9999-my_test_image__1__v2_.jpg');

      // 4. Custom path override
      const customUpload = await r2.getSignedUploadUrl('photo.jpg', 'image/jpeg', 5 * 1024 * 1024, {
        customPath: 'signals/custom_folder/pinned_photo.jpg'
      });
      expect(customUpload.storagePath).toBe('signals/custom_folder/pinned_photo.jpg');
    });
  });

  describe('3. OpenAIProvider Resilience & Fallback', () => {
    let openaiProvider: OpenAIProvider;

    beforeEach(() => {
      openaiProvider = new OpenAIProvider({
        apiKey: 'test-api-key',
        primaryModel: 'gpt-4o-mini',
        fallbackModel: 'gpt-4o',
        maxRetries: 1,
        baseDelayMs: 10
      });
    });

    it('initializes with configured primary model', () => {
      expect(openaiProvider.getModelName()).toBe('gpt-4o-mini');
    });

    it('retries transient 429 errors and falls back to fallbackModel', async () => {
      const mockChatCreate = vi.fn();
      // First attempt on primary fails with 429
      mockChatCreate.mockRejectedValueOnce({
        status: 429,
        message: 'Rate limit exceeded'
      });
      // Second attempt on primary fails with 429
      mockChatCreate.mockRejectedValueOnce({
        status: 429,
        message: 'Rate limit exceeded'
      });
      // Attempt on fallback model succeeds
      mockChatCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                category: 'WATER',
                severity: 'HIGH',
                confidence: 0.95,
                recommended_department: 'WATCO',
                normalized_summary: 'Water main break detected',
                extracted_entities: []
              })
            }
          }
        ]
      });

      // Inject mock into client
      (openaiProvider as any).client = {
        chat: { completions: { create: mockChatCreate } }
      };

      const result = await openaiProvider.analyzeSignal({
        text: 'Severe water leak near school'
      });

      expect(result.category).toBe('WATER');
      expect(result.resolved_model).toBe('gpt-4o');
      expect(mockChatCreate).toHaveBeenCalledTimes(3);
    });

    it('does NOT retry non-transient 400 errors', async () => {
      const mockChatCreate = vi.fn().mockRejectedValue({
        status: 400,
        message: 'Invalid parameter'
      });

      (openaiProvider as any).client = {
        chat: { completions: { create: mockChatCreate } }
      };

      await expect(
        openaiProvider.analyzeSignal({ text: 'Test signal' })
      ).rejects.toThrow(/Non-transient error/);

      expect(mockChatCreate).toHaveBeenCalledTimes(1);
    });

    it('generates 1536-dimensional embeddings with configured model', async () => {
      const mockEmbeddingsCreate = vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.01) }]
      });
      (openaiProvider as any).client = {
        embeddings: { create: mockEmbeddingsCreate }
      };

      const embedding = await openaiProvider.generateEmbedding('Road repair needed');
      expect(embedding.length).toBe(1536);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: 'text-embedding-3-small',
        input: 'Road repair needed'
      }));
    });

    it('evaluates resolution evidence with structured verification decision', async () => {
      const mockChatCreate = vi.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              verification_result: 'VERIFIED',
              confidence: 0.92,
              evidence_summary: 'Desilting completed and drain flowing clear',
              observed_conditions: ['Clear drain', 'No stagnant water'],
              inconsistencies: [],
              explanation: 'Field inspection confirms restoration.',
              limitations: [],
              review_required: false
            })
          }
        }]
      });
      (openaiProvider as any).client = {
        chat: { completions: { create: mockChatCreate } }
      };

      const result = await openaiProvider.verifyResolutionEvidence({
        problem_title: 'Drain blocked',
        problem_category: 'WATER',
        problem_description: 'Severe blockage in stormwater drain',
        evidence: {
          id: 'ev_001',
          problem_id: 'PRB-001',
          evidence_type: 'COMPLETION_PHOTO' as any,
          storage_path: 'evidence/photo.jpg',
          submitted_by: 'officer_1',
          submitted_at: new Date().toISOString(),
          status: 'SUBMITTED' as any,
          description: 'Drain cleared and unblocked',
          created_at: new Date().toISOString()
        }
      });

      expect(result.verification_result).toBe('VERIFIED');
      expect(result.confidence).toBe(0.92);
      expect(result.review_required).toBe(false);
    });
  });

  describe('4. SnapshotImporter & Referential Integrity Validation', () => {
    function getSnapshotDir(): string {
      let snapshotsBase = path.resolve(process.cwd(), 'migration', 'snapshots');
      if (!fs.existsSync(snapshotsBase)) {
        snapshotsBase = path.resolve(process.cwd(), '..', 'migration', 'snapshots');
      }
      const subdirs = fs
        .readdirSync(snapshotsBase)
        .filter((d) => fs.statSync(path.join(snapshotsBase, d)).isDirectory())
        .sort()
        .reverse();

      return path.join(snapshotsBase, subdirs[0]);
    }

    it('executes dry-run validation against authoritative 15B.2 snapshot', async () => {
      const snapshotDir = getSnapshotDir();
      const importer = new SnapshotImporter();

      const result = await importer.importSnapshot({
        snapshotDir,
        dryRun: true,
        allowQuarantineOrphans: true
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.totalSourceRecords).toBe(156);
      expect(result.userMappingCount).toBe(7);
      expect(result.tableResults['departments'].importedCount).toBe(1);
      expect(result.tableResults['users'].importedCount).toBe(7);
      expect(result.tableResults['signals'].importedCount).toBe(11);
      expect(result.tableResults['problem_clusters'].importedCount).toBe(2);
      expect(result.tableResults['cluster_members'].importedCount).toBe(18);
      expect(result.tableResults['assignments'].importedCount).toBe(3);
      expect(result.tableResults['ai_operations'].importedCount).toBe(57);

      // Quarantined historical orphans
      expect(result.totalQuarantinedRecords).toBe(38);
      expect(result.tableResults['problem_actions'].quarantinedCount).toBe(27);
      expect(result.tableResults['verification_results'].quarantinedCount).toBe(11);
    });

    it('fails closed with FOREIGN_KEY_VIOLATION_BLOCKER when allowQuarantineOrphans is false', async () => {
      const snapshotDir = getSnapshotDir();
      const importer = new SnapshotImporter();

      const result = await importer.importSnapshot({
        snapshotDir,
        dryRun: true,
        allowQuarantineOrphans: false
      });

      expect(result.status).toBe('BLOCKED');
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(result.blockers[0]).toContain('FOREIGN_KEY_VIOLATION_BLOCKER');
    });

    it('verifies exact mathematical partition proof: 156 = 118 imported + 38 quarantined', async () => {
      const snapshotDir = getSnapshotDir();
      const manifestPath = path.join(snapshotDir, 'quarantine-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifest.partition_summary.source_record_count).toBe(156);
      expect(manifest.partition_summary.imported_record_count).toBe(118);
      expect(manifest.partition_summary.quarantined_record_count).toBe(38);
      expect(manifest.partition_summary.partition_validation).toBe('PASS');
      expect(manifest.quarantined_records.length).toBe(38);

      // Verify every quarantined record has concrete repository evidence
      for (const rec of manifest.quarantined_records) {
        expect(rec.provenance_evidence).toBeDefined();
        expect(rec.provenance_evidence.length).toBeGreaterThan(20);
        expect(rec.source_sha256).toBeDefined();
      }
    });

    it('guarantees idempotency and repeatable import without record duplication', async () => {
      const snapshotDir = getSnapshotDir();
      const importer = new SnapshotImporter();

      // Run 1
      const run1 = await importer.importSnapshot({
        snapshotDir,
        dryRun: true,
        allowQuarantineOrphans: true
      });

      // Run 2 (repeat with same snapshot)
      const run2 = await importer.importSnapshot({
        snapshotDir,
        dryRun: true,
        allowQuarantineOrphans: true
      });

      expect(run1.totalSourceRecords).toBe(run2.totalSourceRecords);
      expect(run1.totalImportedRecords).toBe(run2.totalImportedRecords);
      expect(run1.totalQuarantinedRecords).toBe(run2.totalQuarantinedRecords);
      for (const table of Object.keys(run1.tableResults)) {
        expect(run1.tableResults[table].sha256).toBe(run2.tableResults[table].sha256);
      }
    });
  });
});
