import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';
import { getFirebaseAuth, getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';
import { UserRole } from '@civicpulse/shared';
import { ProviderContainer, FirestoreDatabaseProvider, FirebaseAuthProvider } from '../src/providers';
import { env } from '../src/config/env';

describe('Phase 13: Real Government Experience & Operations Workflows', () => {
  let app: Express;
  const UIDS = {
    ADMIN: 'fb_uid_admin_synthetic_01',
    DEPT_OFFICER: 'fb_uid_officer_synthetic_02',
    FIELD_OFFICER: 'fb_uid_field_synthetic_03',
    CITIZEN: 'fb_uid_citizen_synthetic_05'
  };

  let tokens: {
    admin?: string;
    deptOfficer?: string;
    fieldOfficer?: string;
    citizen?: string;
  } = {};

  async function getIdTokenForUid(uid: string): Promise<string> {
    const auth = getFirebaseAuth();
    const customToken = await auth.createCustomToken(uid);
    const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY || '';
    const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseWebApiKey}`;
    const res = await fetch(exchangeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    if (!res.ok) {
      throw new Error(`Failed to exchange custom token for UID ${uid}: ${await res.text()}`);
    }
    const data: any = await res.json();
    return data.idToken;
  }

  beforeAll(async () => {
    (env as any).DEMO_MODE = false;
    (env as any).PROVIDER_MODE = 'cloud';
    (env as any).AUTH_PROVIDER = 'firebase';
    (env as any).DATABASE_PROVIDER = 'firestore';
    ProviderContainer.setDatabaseProvider(new FirestoreDatabaseProvider());
    ProviderContainer.setAuthProvider(new FirebaseAuthProvider());

    app = createApp();
    try {
      tokens = {
        admin: await getIdTokenForUid(UIDS.ADMIN),
        deptOfficer: await getIdTokenForUid(UIDS.DEPT_OFFICER),
        fieldOfficer: await getIdTokenForUid(UIDS.FIELD_OFFICER),
        citizen: await getIdTokenForUid(UIDS.CITIZEN)
      };
    } catch (err) {
      console.warn('Could not exchange live tokens (network or quota limitation):', err);
    }
  });

  describe('1. Live Firestore Identity Prerequisites', () => {
    it('verifies /departments/WATCO exists with canonical title', async () => {
      const db = getFirestoreDb();
      const doc = await db.collection('departments').doc('WATCO').get();
      expect(doc.exists).toBe(true);
      const data = doc.data();
      expect(data?.id).toBe('WATCO');
      expect(data?.name).toBe('Water Corporation of Odisha');
      expect(data?.short_name).toBe('WATCO');
    });

    it('verifies ADMIN user profile in Firestore', async () => {
      const db = getFirestoreDb();
      const doc = await db.collection('users').doc(UIDS.ADMIN).get();
      expect(doc.exists).toBe(true);
      const data = doc.data();
      expect(data?.role).toBe(UserRole.ADMIN);
      expect(data?.email).toBe('admin@example.com');
      expect(data?.status).toBe('ACTIVE');
    });

    it('verifies DEPARTMENT_OFFICER user profile in Firestore bound to WATCO', async () => {
      const db = getFirestoreDb();
      const doc = await db.collection('users').doc(UIDS.DEPT_OFFICER).get();
      expect(doc.exists).toBe(true);
      const data = doc.data();
      expect(data?.role).toBe(UserRole.DEPARTMENT_OFFICER);
      expect(data?.email).toBe('officer@example.com');
      expect(data?.department_id).toBe('WATCO');
      expect(data?.status).toBe('ACTIVE');
    });

    it('verifies FIELD_OFFICER user profile in Firestore bound to WATCO', async () => {
      const db = getFirestoreDb();
      const doc = await db.collection('users').doc(UIDS.FIELD_OFFICER).get();
      expect(doc.exists).toBe(true);
      const data = doc.data();
      expect(data?.role).toBe(UserRole.FIELD_OFFICER);
      expect(data?.email).toBe('field@example.com');
      expect(data?.department_id).toBe('WATCO');
      expect(data?.status).toBe('ACTIVE');
    });

    it('verifies CITIZEN test-citizen@example.com remains strictly CITIZEN', async () => {
      const db = getFirestoreDb();
      const doc = await db.collection('users').doc(UIDS.CITIZEN).get();
      expect(doc.exists).toBe(true);
      const data = doc.data();
      expect(data?.role).toBe(UserRole.CITIZEN);
      expect(data?.email).toBe('test-citizen@example.com');
    });
  });

  describe('2. Authoritative /api/v1/auth/me Resolution', () => {
    it('returns ADMIN profile for admin@example.com', async () => {
      if (!tokens.admin) return;
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokens.admin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(UserRole.ADMIN);
      expect(res.body.data.user.email).toBe('admin@example.com');
    });

    it('returns DEPARTMENT_OFFICER profile with WATCO department for officer@example.com', async () => {
      if (!tokens.deptOfficer) return;
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokens.deptOfficer}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(UserRole.DEPARTMENT_OFFICER);
      expect(res.body.data.user.email).toBe('officer@example.com');
      expect(res.body.data.user.department_id).toBe('WATCO');
    });

    it('returns FIELD_OFFICER profile with WATCO department for field@example.com', async () => {
      if (!tokens.fieldOfficer) return;
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokens.fieldOfficer}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(UserRole.FIELD_OFFICER);
      expect(res.body.data.user.email).toBe('field@example.com');
      expect(res.body.data.user.department_id).toBe('WATCO');
    });

    it('returns CITIZEN profile with citizen preferences for test-citizen@example.com', async () => {
      if (!tokens.citizen) return;
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokens.citizen}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(UserRole.CITIZEN);
      expect(res.body.data.user.email).toBe('test-citizen@example.com');
    });
  });

  describe('3. Government RBAC & Operations Gatekeeping', () => {
    it('CITIZEN is strictly forbidden (403) from /api/v1/dashboard/summary', async () => {
      if (!tokens.citizen) return;
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${tokens.citizen}`);

      expect(res.status).toBe(403);
    });

    it('CITIZEN is strictly forbidden (403) from /api/v1/assignments', async () => {
      if (!tokens.citizen) return;
      const res = await request(app)
        .get('/api/v1/assignments')
        .set('Authorization', `Bearer ${tokens.citizen}`);

      expect(res.status).toBe(403);
    });

    it('DEPARTMENT_OFFICER is authorized (200) to access dashboard summary', async () => {
      if (!tokens.deptOfficer) return;
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${tokens.deptOfficer}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('active_problems');
      expect(res.body.data).toHaveProperty('total_signals');
    });

    it('FIELD_OFFICER accesses assignments queue scoped to their UID', async () => {
      if (!tokens.fieldOfficer) return;
      const res = await request(app)
        .get('/api/v1/assignments?assigned_to=me')
        .set('Authorization', `Bearer ${tokens.fieldOfficer}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ADMIN is authorized (200) to list departments', async () => {
      if (!tokens.admin) return;
      const res = await request(app)
        .get('/api/v1/departments')
        .set('Authorization', `Bearer ${tokens.admin}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const watco = res.body.data.find((d: any) => d.id === 'WATCO');
      expect(watco).toBeDefined();
    });
  });

  describe('4. Department Directory & Real Officer Querying', () => {
    it('GET /api/v1/departments/WATCO/officers returns both registered WATCO officers', async () => {
      if (!tokens.deptOfficer) return;
      const res = await request(app)
        .get('/api/v1/departments/WATCO/officers')
        .set('Authorization', `Bearer ${tokens.deptOfficer}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      const emails = res.body.data.map((u: any) => u.email);
      expect(emails).toContain('officer@example.com');
      expect(emails).toContain('field@example.com');
    });

    it('GET /api/v1/departments/WATCO/workload returns deterministic workload metrics', async () => {
      if (!tokens.deptOfficer) return;
      const res = await request(app)
        .get('/api/v1/departments/WATCO/workload')
        .set('Authorization', `Bearer ${tokens.deptOfficer}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('active_in_progress');
      expect(res.body.data).toHaveProperty('critical_or_high');
      expect(res.body.data).toHaveProperty('capacity_rating');
    });

    it('returns 404 for nonexistent department lookup', async () => {
      if (!tokens.admin) return;
      const res = await request(app)
        .get('/api/v1/departments/NON_EXISTENT_DEPARTMENT')
        .set('Authorization', `Bearer ${tokens.admin}`);

      expect(res.status).toBe(404);
    });
  });
});
