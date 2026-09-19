import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { ProviderContainer, MockDatabaseProvider, getDatabaseProvider } from '../src/providers';
import { UserRole, ProblemStatus, EvidenceType, BeforeOrAfter, EvidenceStatus } from '@civicpulse/shared';
import * as firebaseAdminModule from '../src/infrastructure/firebase/firebase-admin';

describe('Phase 14 Security Hardening & RBAC Integrity', () => {
  let app: any;
  const originalDemoMode = env.DEMO_MODE;
  let mockVerifyIdToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    (env as any).DEMO_MODE = true;
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    app = createApp();

    mockVerifyIdToken = vi.fn();
    vi.spyOn(firebaseAdminModule, 'getFirebaseAuth').mockReturnValue({
      verifyIdToken: mockVerifyIdToken
    } as any);
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    vi.restoreAllMocks();
  });

  describe('1. REAL_MODE Authentication & Demo Bypass Defense (AUD-AUTH-01)', () => {
    it('rejects x-demo-mode header with 401 when DEMO_MODE is false', async () => {
      (env as any).DEMO_MODE = false;

      const res = await request(app)
        .get('/api/v1/problems')
        .set('x-demo-mode', 'true');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('strictly forbidden in REAL_MODE');
    });

    it('rejects demo persona tokens with 401 when DEMO_MODE is false', async () => {
      (env as any).DEMO_MODE = false;

      const res = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toContain('strictly forbidden in REAL_MODE');
    });

    it('rejects forged/unverified Firebase JWT tokens with 401 in REAL_MODE', async () => {
      (env as any).DEMO_MODE = false;
      mockVerifyIdToken.mockRejectedValueOnce(new Error('Firebase token has expired or is forged'));

      const res = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', 'Bearer forged-malicious-jwt-token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects requests with missing authorization token with 401', async () => {
      const res = await request(app).get('/api/v1/problems');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Four-Eyes Supervisory Self-Approval Defense (AUD-SELF-01)', () => {
    it('blocks assigned officer from reviewing/approving their own resolution with 403', async () => {
      const db = getDatabaseProvider();
      const problem = await db.getProblemCluster('PRB-2026-0819');
      expect(problem).toBeDefined();

      // Ensure problem is in AWAITING_VERIFICATION assigned to usr_dept_watco
      await db.updateProblemCluster('PRB-2026-0819', {
        status: ProblemStatus.AWAITING_VERIFICATION,
        assigned_to: 'usr_dept_watco',
        department_id: 'WATCO'
      });

      // Submit resolution evidence by someone else
      await db.createResolutionEvidence({
        id: 'ev_test_self_01',
        problem_id: 'PRB-2026-0819',
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        storage_path: 'evidence/resolutions/test.jpg',
        media_type: 'image/jpeg',
        file_size_bytes: 1000,
        sha256_hash: 'abc',
        submitted_by: 'usr_other_officer',
        submitted_at: new Date().toISOString(),
        status: EvidenceStatus.SUBMITTED,
        before_or_after: BeforeOrAfter.AFTER,
        created_at: new Date().toISOString()
      });

      // Assignee (usr_dept_watco) attempts to approve their own assigned problem
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/review-resolution')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          decision: 'ACCEPT',
          notes: 'Self approval attempt by assigned supervisor'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Self-approval is strictly forbidden');
    });

    it('blocks evidence submitter from reviewing/approving the resolution with 403', async () => {
      const db = getDatabaseProvider();

      await db.updateProblemCluster('PRB-2026-0819', {
        status: ProblemStatus.AWAITING_VERIFICATION,
        assigned_to: 'usr_field_02',
        department_id: 'WATCO'
      });

      // Department supervisor (usr_dept_watco) submitted the evidence
      await db.createResolutionEvidence({
        id: 'ev_test_self_02',
        problem_id: 'PRB-2026-0819',
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        storage_path: 'evidence/resolutions/dept_photo.jpg',
        media_type: 'image/jpeg',
        file_size_bytes: 1000,
        sha256_hash: 'def',
        submitted_by: 'usr_dept_watco',
        submitted_at: new Date().toISOString(),
        status: EvidenceStatus.SUBMITTED,
        before_or_after: BeforeOrAfter.AFTER,
        created_at: new Date().toISOString()
      });

      // The submitter (usr_dept_watco) attempts to review/approve it
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/review-resolution')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          decision: 'ACCEPT',
          notes: 'Supervisor trying to self-approve own submitted evidence'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Self-approval is strictly forbidden');
    });
  });

  describe('3. Storage Security & Binary Content Validation (AUD-STO-01)', () => {
    it('rejects unauthenticated storage upload with 401', async () => {
      const res = await request(app)
        .put('/api/v1/storage/upload?path=signals/unauth.png')
        .set('Content-Type', 'image/png')
        .send(Buffer.from('fake'));

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects storage path directory traversal attempts with 400', async () => {
      const res = await request(app)
        .put('/api/v1/storage/upload?path=signals/../../../etc/passwd.png')
        .set('Authorization', 'Bearer demo-token-citizen')
        .set('Content-Type', 'image/png')
        .send(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STORAGE_PATH');
    });

    it('rejects unauthorized file extensions (e.g. .exe, .sh) with 400', async () => {
      const res = await request(app)
        .put('/api/v1/storage/upload?path=signals/malware.exe')
        .set('Authorization', 'Bearer demo-token-citizen')
        .set('Content-Type', 'image/png')
        .send(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STORAGE_PATH');
    });

    it('rejects binary content mismatch (text content claiming to be JPEG) with 400', async () => {
      const textBuffer = Buffer.from('This is a plain text file pretending to be JPEG');

      const res = await request(app)
        .put('/api/v1/storage/upload?path=signals/fake_image.jpg')
        .set('Authorization', 'Bearer demo-token-citizen')
        .set('Content-Type', 'image/jpeg')
        .send(textBuffer);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_CONTENT');
      expect(res.body.error.message).toContain('does not match supported image formats');
    });

    it('rejects cross-type MIME mismatch (PNG magic bytes with image/jpeg header) with 400', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);

      const res = await request(app)
        .put('/api/v1/storage/upload?path=signals/mismatched.jpg')
        .set('Authorization', 'Bearer demo-token-citizen')
        .set('Content-Type', 'image/jpeg')
        .send(pngBuffer);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MIME_TYPE_MISMATCH');
    });

    it('rejects overwriting an existing storage object with 409 CONFLICT', async () => {
      const validPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
      const uniquePath = `signals/unique_test_${Date.now()}.png`;

      // 1. Initial successful upload
      const res1 = await request(app)
        .put(`/api/v1/storage/upload?path=${uniquePath}`)
        .set('Authorization', 'Bearer demo-token-citizen')
        .set('Content-Type', 'image/png')
        .send(validPng);

      expect(res1.status).toBe(200);

      // 2. Overwrite attempt must return 409
      const res2 = await request(app)
        .put(`/api/v1/storage/upload?path=${uniquePath}`)
        .set('Authorization', 'Bearer demo-token-citizen')
        .set('Content-Type', 'image/png')
        .send(validPng);

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('OBJECT_ALREADY_EXISTS');
    });
  });

  describe('4. Privacy & IDOR Protection (AUD-PRIV-01 & AUD-PRIV-02)', () => {
    it('redacts raw signal_id on non-owned member signals when problem is viewed by a citizen', async () => {
      const res = await request(app)
        .get('/api/v1/problems/PRB-2026-0819/details')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      if (res.body.data.member_signals && res.body.data.member_signals.length > 0) {
        for (const member of res.body.data.member_signals) {
          if (member.citizen_id !== 'usr_citizen_01') {
            expect(member.signal_id).toBe('[REDACTED]');
          }
        }
      }
    });

    it('sanitizes municipal officer internal UIDs to "Municipal Officer" when evidence is viewed by citizens', async () => {
      const res = await request(app)
        .get('/api/v1/problems/PRB-2026-0819/evidence')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(200);
      for (const ev of res.body.data) {
        expect(ev.submitted_by).toBe('Municipal Officer');
      }
    });
  });

  describe('5. Field Officer Scoping & RBAC (AUD-RBAC-01)', () => {
    it('scopes field officer signal listing strictly to assigned department', async () => {
      const res = await request(app)
        .get('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      // Field officer belongs to WATCO, should not see signals belonging to other departments
      for (const signal of res.body.data) {
        if (signal.department_id) {
          expect(signal.department_id).toBe('WATCO');
        }
      }
    });
  });

  describe('6. Storage Direct Read Privacy & Scoped Media Retrieval (Blocker 3)', () => {
    it('rejects unauthenticated requests to read media with 401', async () => {
      const res = await request(app).get('/api/v1/storage/files?path=signals/test.jpg');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('blocks Citizen B from reading Citizen A signal media with 403', async () => {
      const db = getDatabaseProvider();
      const storagePath = 'signals/citizen_a_secret.jpg';
      const validBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

      // Seed signal media owned by Citizen A (usr_citizen_01)
      await db.createSignalMedia({
        id: 'med_cit_a_01',
        signal_id: 'sig_1001', // Owned by usr_citizen_01
        storage_path: storagePath,
        media_type: 'IMAGE',
        mime_type: 'image/jpeg',
        file_size_bytes: validBuffer.length,
        uploaded_by: 'usr_citizen_01',
        created_at: new Date().toISOString()
      });

      // Save file into storage provider
      const { getStorageProvider } = await import('../src/providers');
      const storage = getStorageProvider();
      if (storage.saveFile) {
        await storage.saveFile(storagePath, validBuffer, 'image/jpeg');
      }

      // Citizen B (usr_citizen_02) attempts to read Citizen A's signal media
      const res = await request(app)
        .get(`/api/v1/storage/files?path=${storagePath}`)
        .set('Authorization', 'Bearer demo-token-citizen-2');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('not authorized to view media submitted by another citizen');
    });

    it('allows Citizen A to read their own signal media with 200', async () => {
      const db = getDatabaseProvider();
      const storagePath = 'signals/citizen_a_own.jpg';
      const validBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

      // Seed signal media owned by Citizen A (usr_citizen_01)
      await db.createSignalMedia({
        id: 'med_cit_a_02',
        signal_id: 'sig_1001', // Owned by usr_citizen_01
        storage_path: storagePath,
        media_type: 'IMAGE',
        mime_type: 'image/jpeg',
        file_size_bytes: validBuffer.length,
        uploaded_by: 'usr_citizen_01',
        created_at: new Date().toISOString()
      });

      const { getStorageProvider } = await import('../src/providers');
      const storage = getStorageProvider();
      if (storage.saveFile) {
        await storage.saveFile(storagePath, validBuffer, 'image/jpeg');
      }

      const res = await request(app)
        .get(`/api/v1/storage/files?path=${storagePath}`)
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
    });

    it('blocks citizen from accessing in-progress resolution evidence for unrelated problems with 403', async () => {
      const db = getDatabaseProvider();
      const storagePath = 'evidence/internal_repair_wip.jpg';
      const validBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

      // Seed problem in IN_PROGRESS state
      await db.updateProblemCluster('PRB-2026-0819', {
        status: ProblemStatus.IN_PROGRESS,
        department_id: 'WATCO'
      });

      // Seed resolution evidence
      await db.createResolutionEvidence({
        id: 'ev_internal_wip_01',
        problem_id: 'PRB-2026-0819',
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        storage_path: storagePath,
        media_type: 'image/jpeg',
        file_size_bytes: validBuffer.length,
        sha256_hash: 'hash_test',
        submitted_by: 'usr_officer_01',
        submitted_at: new Date().toISOString(),
        before_or_after: BeforeOrAfter.AFTER,
        status: EvidenceStatus.SUBMITTED,
        created_at: new Date().toISOString()
      });

      const { getStorageProvider } = await import('../src/providers');
      const storage = getStorageProvider();
      if (storage.saveFile) {
        await storage.saveFile(storagePath, validBuffer, 'image/jpeg');
      }

      // Citizen 2 (unrelated to PRB-2026-0819) attempts to read internal evidence
      const res = await request(app)
        .get(`/api/v1/storage/files?path=${storagePath}`)
        .set('Authorization', 'Bearer demo-token-citizen-2');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('in-progress resolution evidence');
    });

    it('blocks field officer from accessing resolution evidence outside their department/assignment with 403', async () => {
      const db = getDatabaseProvider();
      const storagePath = 'evidence/internal_watco_field.jpg';
      const validBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

      await db.updateProblemCluster('PRB-2026-0819', {
        status: ProblemStatus.IN_PROGRESS,
        department_id: 'WATCO',
        assigned_to: 'usr_officer_01'
      });

      await db.createResolutionEvidence({
        id: 'ev_watco_02',
        problem_id: 'PRB-2026-0819',
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        storage_path: storagePath,
        media_type: 'image/jpeg',
        file_size_bytes: validBuffer.length,
        sha256_hash: 'hash_test_2',
        submitted_by: 'usr_officer_01',
        submitted_at: new Date().toISOString(),
        before_or_after: BeforeOrAfter.AFTER,
        status: EvidenceStatus.SUBMITTED,
        created_at: new Date().toISOString()
      });

      const { getStorageProvider } = await import('../src/providers');
      const storage = getStorageProvider();
      if (storage.saveFile) {
        await storage.saveFile(storagePath, validBuffer, 'image/jpeg');
      }

      // Field officer from Drainage attempts to read WATCO resolution evidence
      const res = await request(app)
        .get(`/api/v1/storage/files?path=${storagePath}`)
        .set('Authorization', 'Bearer demo-token-field-drainage');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('outside their assigned work');
    });

    it('blocks department officer from reading resolution evidence from another department with 403', async () => {
      const db = getDatabaseProvider();
      const storagePath = 'evidence/internal_watco_dept.jpg';
      const validBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

      await db.updateProblemCluster('PRB-2026-0819', {
        status: ProblemStatus.IN_PROGRESS,
        department_id: 'WATCO'
      });

      await db.createResolutionEvidence({
        id: 'ev_watco_03',
        problem_id: 'PRB-2026-0819',
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        storage_path: storagePath,
        media_type: 'image/jpeg',
        file_size_bytes: validBuffer.length,
        sha256_hash: 'hash_test_3',
        submitted_by: 'usr_dept_watco',
        submitted_at: new Date().toISOString(),
        before_or_after: BeforeOrAfter.AFTER,
        status: EvidenceStatus.SUBMITTED,
        created_at: new Date().toISOString()
      });

      const { getStorageProvider } = await import('../src/providers');
      const storage = getStorageProvider();
      if (storage.saveFile) {
        await storage.saveFile(storagePath, validBuffer, 'image/jpeg');
      }

      // Department officer from BMC Drainage attempts to read WATCO resolution evidence
      const res = await request(app)
        .get(`/api/v1/storage/files?path=${storagePath}`)
        .set('Authorization', 'Bearer demo-token-dept-drainage');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('other departments');
    });

    it('rejects access to unlinked or guessed storage paths with 404', async () => {
      const res = await request(app)
        .get('/api/v1/storage/files?path=signals/guessed_nonexistent_object.jpg')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
