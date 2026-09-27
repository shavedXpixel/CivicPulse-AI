import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { ProviderContainer, MockDatabaseProvider, LocalStorageProvider } from '../src/providers';
import {
  ProblemStatus,
  UserRole,
  UserProfile,
  EvidenceType,
  BeforeOrAfter,
  ProblemCluster,
  Assignment,
  AssignmentStatus,
  AssignmentPriority,
  ERROR_CODES
} from '@civicpulse/shared';
import * as firebaseAdminModule from '../src/infrastructure/firebase/firebase-admin';
import { FirebaseAuthProvider } from '../src/providers';
import { ResolutionService } from '../src/modules/resolutions/resolution.service';

describe('Resolution Evidence Presigned R2 Upload & Workflow Integration', () => {
  let app: any;
  let db: MockDatabaseProvider;
  let storage: LocalStorageProvider;
  let mockVerifyIdToken: ReturnType<typeof vi.fn>;

  const assignedFieldOfficer: UserProfile = {
    id: 'usr_field_watco_01',
    auth_user_id: 'auth_field_watco_01',
    email: 'field.patel@watco.odisha.gov.in',
    display_name: 'Field Engineer Patel',
    role: UserRole.FIELD_OFFICER,
    status: 'ACTIVE' as any,
    department_id: 'WATCO',
    created_at: new Date().toISOString()
  };

  const unassignedFieldOfficer: UserProfile = {
    id: 'usr_field_watco_99',
    auth_user_id: 'auth_field_watco_99',
    email: 'other.officer@watco.odisha.gov.in',
    display_name: 'Field Engineer Rao',
    role: UserRole.FIELD_OFFICER,
    status: 'ACTIVE' as any,
    department_id: 'WATCO',
    created_at: new Date().toISOString()
  };

  const watcoDeptOfficer: UserProfile = {
    id: 'usr_dept_watco_01',
    auth_user_id: 'auth_dept_watco_01',
    email: 'supervisor.dash@watco.odisha.gov.in',
    display_name: 'Supervisor Dash',
    role: UserRole.DEPARTMENT_OFFICER,
    status: 'ACTIVE' as any,
    department_id: 'WATCO',
    created_at: new Date().toISOString()
  };

  const citizenUser: UserProfile = {
    id: 'usr_citizen_01',
    auth_user_id: 'auth_citizen_01',
    email: 'citizen@example.com',
    display_name: 'Citizen User',
    role: UserRole.CITIZEN,
    created_at: new Date().toISOString()
  };

  let activeProblem: ProblemCluster;

  beforeEach(async () => {
    vi.restoreAllMocks();
    (env as any).DEMO_MODE = true;
    (env as any).STORAGE_PROVIDER = 'local';
    (env as any).DATABASE_PROVIDER = 'mock';

    db = new MockDatabaseProvider();
    storage = new LocalStorageProvider();
    ProviderContainer.setDatabaseProvider(db);
    (ProviderContainer as any).storageInstance = storage;
    ProviderContainer.setAuthProvider(new FirebaseAuthProvider());

    mockVerifyIdToken = vi.fn().mockImplementation(async (token: string) => {
      if (token === 'token-field-assigned') {
        return { uid: assignedFieldOfficer.id, email: assignedFieldOfficer.email };
      }
      if (token === 'token-field-unassigned') {
        return { uid: unassignedFieldOfficer.id, email: unassignedFieldOfficer.email };
      }
      if (token === 'token-dept-watco') {
        return { uid: watcoDeptOfficer.id, email: watcoDeptOfficer.email };
      }
      if (token === 'token-citizen') {
        return { uid: citizenUser.id, email: citizenUser.email };
      }
      throw new Error('Invalid token');
    });

    vi.spyOn(firebaseAdminModule, 'getFirebaseAuth').mockReturnValue({
      verifyIdToken: mockVerifyIdToken
    } as any);

    // Seed mock users
    await db.createUser(assignedFieldOfficer);
    await db.createUser(unassignedFieldOfficer);
    await db.createUser(watcoDeptOfficer);
    await db.createUser(citizenUser);

    // Seed active production incident
    activeProblem = {
      id: 'PRB-2026-8415',
      title: 'Street light stopped working',
      description: 'Street light on pillar 14 dark for 3 days',
      category: 'infrastructure',
      department_id: 'WATCO',
      status: ProblemStatus.IN_PROGRESS,
      assigned_to: assignedFieldOfficer.id,
      is_demo: false,
      signal_count: 1,
      impact_score: 45,
      location: {
        lat: 20.3179,
        lng: 85.8182
      },
      ward_id: '013',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await db.createProblemCluster(activeProblem);

    app = createApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. POST /api/v1/problems/:id/media generates presigned upload URL with canonical evidence path', async () => {
    const res = await request(app)
      .post(`/api/v1/problems/${activeProblem.id}/media`)
      .set('Authorization', 'Bearer token-field-assigned')
      .send({
        file_name: 'completion_repair.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 2048000
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.media_id).toMatch(/^evd_med_/);
    expect(res.body.data.upload_url).toBeDefined();
    expect(res.body.data.storage_path).toContain('evidence/PRB-2026-8415/');
    expect(res.body.data.storage_path).toContain('completion_repair.jpg');
    expect(res.body.data.expires_at).toBeDefined();
  });

  it('2. Citizens are strictly forbidden (403) from registering evidence media', async () => {
    const res = await request(app)
      .post(`/api/v1/problems/${activeProblem.id}/media`)
      .set('Authorization', 'Bearer token-citizen')
      .send({
        file_name: 'photo.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 1024000
      });

    expect(res.status).toBe(403);
  });

  it('3. Unassigned Field Officer is forbidden (403) from uploading evidence to another incident', async () => {
    const res = await request(app)
      .post(`/api/v1/problems/${activeProblem.id}/media`)
      .set('Authorization', 'Bearer token-field-unassigned')
      .send({
        file_name: 'attempted_tampering.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 1024000
      });

    expect(res.status).toBe(403);
    expect(res.body.error?.message).toContain('only upload resolution evidence for explicitly assigned problems');
  });

  it('4. Rejects file size exceeding 10MB limit with 400 Bad Request', async () => {
    const res = await request(app)
      .post(`/api/v1/problems/${activeProblem.id}/media`)
      .set('Authorization', 'Bearer token-field-assigned')
      .send({
        file_name: 'huge_payload.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 15 * 1024 * 1024 // 15MB > 10MB limit
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.message).toContain('10 MB');
  });

  it('5. POST /api/v1/problems/:id/media/:mediaId/complete finalizes upload', async () => {
    const mediaId = 'evd_med_12345_test';
    const res = await request(app)
      .post(`/api/v1/problems/${activeProblem.id}/media/${mediaId}/complete`)
      .set('Authorization', 'Bearer token-field-assigned')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ATTACHED');
    expect(res.body.data.problem_id).toBe(activeProblem.id);
  });

  it('6. Production runtime enforces storage.objectExists and rejects unuploaded fake paths', async () => {
    (env as any).DEMO_MODE = false;
    (env as any).STORAGE_PROVIDER = 'r2';
    (env as any).DATABASE_PROVIDER = 'postgres';

    // Mock storage objectExists returning false (file not actually uploaded)
    vi.spyOn(storage, 'objectExists').mockResolvedValue(false);

    const res = await request(app)
      .post(`/api/v1/problems/${activeProblem.id}/evidence`)
      .set('Authorization', 'Bearer token-field-assigned')
      .send({
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        before_or_after: BeforeOrAfter.AFTER,
        storage_path: 'evidence/PRB-2026-8415/evd_med_fake-unuploaded.jpg',
        description: 'Claimed repair without actual file upload'
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.message).toContain('Resolution evidence media object not found in storage');

    // Reset env
    (env as any).DEMO_MODE = true;
    (env as any).STORAGE_PROVIDER = 'local';
    (env as any).DATABASE_PROVIDER = 'mock';
  });

  it('7. Submitting resolution evidence transitions incident IN_PROGRESS -> AWAITING_VERIFICATION', async () => {
    (env as any).DEMO_MODE = false;
    (env as any).STORAGE_PROVIDER = 'r2';
    (env as any).DATABASE_PROVIDER = 'postgres';

    // Mock storage objectExists returning true (file actually uploaded to R2)
    vi.spyOn(storage, 'objectExists').mockResolvedValue(true);

    const validStoragePath = 'evidence/PRB-2026-8415/evd_med_verified-completion.jpg';

    const res = await request(app)
      .post(`/api/v1/problems/${activeProblem.id}/evidence`)
      .set('Authorization', 'Bearer token-field-assigned')
      .send({
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        before_or_after: BeforeOrAfter.AFTER,
        storage_path: validStoragePath,
        description: 'Replaced faulty luminaries and restored illumination',
        location: {
          lat: 20.3179,
          lng: 85.8182,
          reference: 'Nayapalli, Ward 13'
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.data.evidence.storage_path).toBe(validStoragePath);
    expect(res.body.data.problem_status).toBe(ProblemStatus.AWAITING_VERIFICATION);

    // Verify persisted state in database
    const updatedProblem = await db.getProblemCluster(activeProblem.id);
    expect(updatedProblem?.status).toBe(ProblemStatus.AWAITING_VERIFICATION);

    // Reset env
    (env as any).DEMO_MODE = true;
    (env as any).STORAGE_PROVIDER = 'local';
    (env as any).DATABASE_PROVIDER = 'mock';
  });
});
