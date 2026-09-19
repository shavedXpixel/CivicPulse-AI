import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  GeminiAIProvider,
  isTransientError,
  calculateBackoffWithJitter
} from '../src/providers/ai/gemini.provider';
import { ProviderContainer, MockDatabaseProvider, FirebaseAuthProvider } from '../src/providers';
import { SignalRepository } from '../src/modules/signals/signal.repository';
import { SignalAIService } from '../src/modules/signals/signal-ai.service';
import { env } from '../src/config/env';
import {
  SignalStatus,
  SignalSeverity,
  SignalProcessingStatus,
  SignalSourceType,
  UserRole,
  AppError
} from '@civicpulse/shared';
import * as firebaseAdminModule from '../src/infrastructure/firebase/firebase-admin';

function makeGeminiSuccessPayload(summary = 'Severe stormwater drain collapse causing road waterlogging') {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                detected_language: 'en',
                normalized_summary: summary,
                category: 'drainage',
                subcategory: 'stormwater_drain',
                severity: 'HIGH',
                urgency: 'HIGH',
                affected_scope: 'neighborhood',
                duration_days: 2,
                location_reference: 'Near Damana Square',
                recommended_department: 'BMC_DRAINAGE',
                entities: ['Damana Square', 'stormwater drain'],
                critical_facility: null,
                confidence: 0.94,
                explanation: 'Critical drainage infrastructure blockage requiring desilting.',
                image_findings: []
              })
            }
          ]
        }
      }
    ]
  };
}

function makeEmbeddingPayload() {
  return {
    embedding: {
      values: [0.05, 0.12, 0.35, 0.48, 0.22, 0.18, 0.09, 0.61, 0.44, 0.11]
    }
  };
}

describe('Gemini 503 Resilience, Bounded Exponential Backoff & Model Fallback', () => {
  const originalDemoMode = env.DEMO_MODE;
  const originalApiKey = env.GEMINI_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    (env as any).GEMINI_API_KEY = 'test-gemini-key';
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    (env as any).GEMINI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Error Classification & Backoff Math Unit Tests
  // =========================================================================
  describe('Transient Error Classification & Exponential Backoff Math', () => {
    it('classifies 503, 429, 408, 500, 502 as transient', () => {
      expect(isTransientError(503)).toBe(true);
      expect(isTransientError(429)).toBe(true);
      expect(isTransientError(408)).toBe(true);
      expect(isTransientError(500)).toBe(true);
      expect(isTransientError(502)).toBe(true);
      expect(isTransientError(504)).toBe(true);
      expect(isTransientError(undefined, new Error('This model is currently experiencing high demand.'))).toBe(true);
      expect(isTransientError(undefined, new Error('Resource has been exhausted (e.g. check quota).'))).toBe(true);
      expect(isTransientError(undefined, new Error('fetch failed'))).toBe(true);
    });

    it('classifies 400, 401, 403, 404, 422 as non-transient', () => {
      expect(isTransientError(400)).toBe(false);
      expect(isTransientError(401)).toBe(false);
      expect(isTransientError(403)).toBe(false);
      expect(isTransientError(404)).toBe(false);
      expect(isTransientError(422)).toBe(false);
    });

    it('calculates bounded exponential backoff with positive jitter', () => {
      const d1 = calculateBackoffWithJitter(1, 100, 5000);
      const d2 = calculateBackoffWithJitter(2, 100, 5000);
      const d3 = calculateBackoffWithJitter(3, 100, 5000);

      // Attempt 1: 100 + jitter (>= 100, <= 130)
      expect(d1).toBeGreaterThanOrEqual(100);
      expect(d1).toBeLessThanOrEqual(140);

      // Attempt 2: 200 + jitter (>= 200, <= 260)
      expect(d2).toBeGreaterThanOrEqual(200);
      expect(d2).toBeLessThanOrEqual(280);

      // Attempt 3: 400 + jitter (>= 400, <= 520)
      expect(d3).toBeGreaterThanOrEqual(400);
      expect(d3).toBeLessThanOrEqual(550);
    });
  });

  // =========================================================================
  // 2. Automated Gemini Provider Scenarios (Requirement 13)
  // =========================================================================
  describe('Provider Resilience Scenarios', () => {
    it('1. primary succeeds on first attempt', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeGeminiSuccessPayload()
      } as any);

      const provider = new GeminiAIProvider({
        primaryModel: 'gemini-3.6-flash',
        fallbackModel: 'gemini-3.5-flash',
        baseDelayMs: 1
      });

      const result = await provider.analyzeSignal({ text: 'Drain blockage near market' });

      expect(result.resolved_model).toBe('gemini-3.6-flash');
      expect(provider.getModelName()).toBe('gemini-3.6-flash');
      expect(result.category).toBe('drainage');
      expect(fetchSpy).toHaveBeenCalledOnce();
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('models/gemini-3.6-flash:generateContent');
    });

    it('2. primary 503 then succeeds on retry', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        // Attempt 1: 503 High Demand
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'This model is currently experiencing high demand.'
        } as any)
        // Attempt 2: 200 OK
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => makeGeminiSuccessPayload()
        } as any);

      const provider = new GeminiAIProvider({
        primaryModel: 'gemini-3.6-flash',
        fallbackModel: 'gemini-3.5-flash',
        baseDelayMs: 2
      });

      const result = await provider.analyzeSignal({ text: 'Drain blockage near market' });

      expect(result.resolved_model).toBe('gemini-3.6-flash');
      expect(provider.getModelName()).toBe('gemini-3.6-flash');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      // Both calls should target the primary model
      expect((fetchSpy.mock.calls[0][0] as string)).toContain('models/gemini-3.6-flash:generateContent');
      expect((fetchSpy.mock.calls[1][0] as string)).toContain('models/gemini-3.6-flash:generateContent');
    });

    it('3. primary repeatedly 503 then fallback succeeds', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        // Primary Attempt 1: 503
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'This model is currently experiencing high demand.'
        } as any)
        // Primary Attempt 2: 503
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'This model is currently experiencing high demand.'
        } as any)
        // Primary Attempt 3: 503
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'This model is currently experiencing high demand.'
        } as any)
        // Fallback Attempt 1: 200 OK
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => makeGeminiSuccessPayload('Stormwater drain cleared by fallback model')
        } as any);

      const provider = new GeminiAIProvider({
        primaryModel: 'gemini-3.6-flash',
        fallbackModel: 'gemini-3.5-flash',
        maxRetries: 3,
        baseDelayMs: 2
      });

      const result = await provider.analyzeSignal({ text: 'Drain blockage near market' });

      // Fallback model must be recorded
      expect(result.resolved_model).toBe('gemini-3.5-flash');
      expect(provider.getModelName()).toBe('gemini-3.5-flash');
      expect(result.normalized_summary).toBe('Stormwater drain cleared by fallback model');

      expect(fetchSpy).toHaveBeenCalledTimes(4);
      // Calls 1-3 were primary
      expect((fetchSpy.mock.calls[0][0] as string)).toContain('models/gemini-3.6-flash');
      expect((fetchSpy.mock.calls[1][0] as string)).toContain('models/gemini-3.6-flash');
      expect((fetchSpy.mock.calls[2][0] as string)).toContain('models/gemini-3.6-flash');
      // Call 4 was fallback
      expect((fetchSpy.mock.calls[3][0] as string)).toContain('models/gemini-3.5-flash');
    });

    it('4. primary 429 then fallback succeeds', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        // Primary Attempt 1: 429
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'RESOURCE_EXHAUSTED: Rate limit exceeded.'
        } as any)
        // Primary Attempt 2: 429
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'RESOURCE_EXHAUSTED: Rate limit exceeded.'
        } as any)
        // Primary Attempt 3: 429
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'RESOURCE_EXHAUSTED: Rate limit exceeded.'
        } as any)
        // Fallback Attempt 1: 200 OK
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => makeGeminiSuccessPayload()
        } as any);

      const provider = new GeminiAIProvider({
        primaryModel: 'gemini-3.6-flash',
        fallbackModel: 'gemini-3.5-flash',
        maxRetries: 3,
        baseDelayMs: 2
      });

      const result = await provider.analyzeSignal({ text: 'Drain blockage near market' });

      expect(result.resolved_model).toBe('gemini-3.5-flash');
      expect(provider.getModelName()).toBe('gemini-3.5-flash');
      expect(fetchSpy).toHaveBeenCalledTimes(4);
      expect((fetchSpy.mock.calls[3][0] as string)).toContain('models/gemini-3.5-flash');
    });

    it('5. both models unavailable returns 503 AI_PROVIDER_UNAVAILABLE', async () => {
      vi.spyOn(globalThis, 'fetch')
        // Primary attempts 1, 2, 3: 503
        .mockResolvedValue({
          ok: false,
          status: 503,
          text: async () => 'This model is currently experiencing high demand.'
        } as any);

      const provider = new GeminiAIProvider({
        primaryModel: 'gemini-3.6-flash',
        fallbackModel: 'gemini-3.5-flash',
        maxRetries: 3,
        baseDelayMs: 2
      });

      try {
        await provider.analyzeSignal({ text: 'Drain blockage near market' });
        expect.unreachable('Should have thrown 503 AI_PROVIDER_UNAVAILABLE');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(503);
        expect(err.code).toBe('AI_PROVIDER_UNAVAILABLE');
        expect(err.message).toContain('gemini-3.6-flash');
        expect(err.message).toContain('gemini-3.5-flash');
      }
    });

    it('6. non-transient 400/403 does NOT trigger unnecessary fallback or retry', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'INVALID_ARGUMENT: Bad Request'
        } as any);

      const provider = new GeminiAIProvider({
        primaryModel: 'gemini-3.6-flash',
        fallbackModel: 'gemini-3.5-flash',
        maxRetries: 3,
        baseDelayMs: 2
      });

      await expect(provider.analyzeSignal({ text: 'Invalid request' })).rejects.toThrow();

      // Must have stopped immediately without retrying or calling fallback
      expect(fetchSpy).toHaveBeenCalledOnce();
      expect((fetchSpy.mock.calls[0][0] as string)).toContain('models/gemini-3.6-flash');
    });

    it('7. AI operation records the actual successful model in repository audit record', async () => {
      // Primary fails 3 times, fallback succeeds
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'High demand' } as any)
        .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'High demand' } as any)
        .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'High demand' } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => makeGeminiSuccessPayload()
        } as any);

      const mockDb = new MockDatabaseProvider();
      ProviderContainer.setDatabaseProvider(mockDb);
      const geminiProvider = new GeminiAIProvider({
        primaryModel: 'gemini-3.6-flash',
        fallbackModel: 'gemini-3.5-flash',
        maxRetries: 3,
        baseDelayMs: 2
      });
      ProviderContainer.setAIProvider(geminiProvider);

      const signalRepo = new SignalRepository();
      const testSignal = await signalRepo.create({
        id: `sig_audit_test_${Date.now()}`,
        source_type: SignalSourceType.CITIZEN,
        citizen_id: 'usr_citizen_01',
        original_text: 'Flooded street near Patia market',
        location: { lat: 20.355, lng: 85.815 },
        status: SignalStatus.ACTIVE,
        severity: SignalSeverity.MEDIUM,
        processing_status: SignalProcessingStatus.PENDING,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const userProfile = {
        id: 'usr_citizen_01',
        email: 'citizen@test.gov.in',
        role: UserRole.CITIZEN,
        status: 'ACTIVE' as any
      };

      const aiService = new SignalAIService(signalRepo);
      const result = await aiService.analyzeSignal(userProfile as any, testSignal.id);

      // Verify the returned operation and DB operation record contains the fallback model
      expect(result.operation.model).toBe('gemini-3.5-flash');
      expect(result.operation.status).toBe('SUCCESS');

      const persistedOps = await mockDb.getAIOperations(testSignal.id);
      expect(persistedOps.length).toBeGreaterThan(0);
      expect(persistedOps[0].model).toBe('gemini-3.5-flash');
      expect(persistedOps[0].status).toBe('SUCCESS');
    });
  });

  // =========================================================================
  // 3. Complete End-to-End Live Flow (Requirement 14)
  // Citizen submits report → Gemini primary (503) → fallback (200) →
  // successful AI analysis → embedding → clustering → ProblemCluster → GET /api/v1/problems
  // =========================================================================
  describe('Full End-to-End Live Pipeline with Fallback', () => {
    let app: ReturnType<typeof createApp>;
    let mockDb: MockDatabaseProvider;

    beforeEach(() => {
      (env as any).AUTH_PROVIDER = 'firebase';
      ProviderContainer.resetAllProviders();
      mockDb = new MockDatabaseProvider();
      ProviderContainer.setDatabaseProvider(mockDb);
      ProviderContainer.setAuthProvider(new FirebaseAuthProvider());
      (env as any).DEMO_MODE = false;

      // Authenticate via token mock
      vi.spyOn(firebaseAdminModule, 'getFirebaseAuth').mockReturnValue({
        verifyIdToken: vi.fn().mockImplementation(async (token: string) => {
          if (token === 'citizen-token') {
            return { uid: 'usr_citizen_e2e', email: 'citizen@bhubaneswar.gov.in' };
          }
          if (token === 'officer-token') {
            return { uid: 'usr_officer_e2e', email: 'officer@bhubaneswar.gov.in' };
          }
          throw new Error('Invalid token');
        })
      } as any);

      app = createApp();
    });

    it('executes complete live flow with fallback model, clustering, and problem retrieval', async () => {
      let primaryAttemptCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('embedContent')) {
          return {
            ok: true,
            status: 200,
            json: async () => makeEmbeddingPayload()
          } as any;
        }
        if (urlStr.includes('gemini-3.6-flash')) {
          primaryAttemptCount++;
          return {
            ok: false,
            status: 503,
            text: async () => '503 High demand'
          } as any;
        }
        if (urlStr.includes('gemini-3.5-flash')) {
          return {
            ok: true,
            status: 200,
            json: async () => makeGeminiSuccessPayload('Collapsed drain near Rasulgarh square')
          } as any;
        }
        return { ok: false, status: 404, text: async () => 'Not found' } as any;
      });

      const geminiProvider = new GeminiAIProvider({
        primaryModel: 'gemini-3.6-flash',
        fallbackModel: 'gemini-3.5-flash',
        maxRetries: 3,
        baseDelayMs: 2
      });
      ProviderContainer.setAIProvider(geminiProvider);

      // 1. Citizen submits report with auto_process: true
      const postRes = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer citizen-token')
        .send({
          original_text: 'Severe stormwater drain collapse causing massive water accumulation on roadway',
          location: { lat: 20.3550, lng: 85.8150 },
          location_reference: 'Near Patia Big Bazaar Lane',
          auto_process: true
        });

      expect(primaryAttemptCount).toBe(3);
      expect(postRes.status).toBe(201);
      const createdSignal = postRes.body.data;
      expect(createdSignal.processing_status).toBe(SignalProcessingStatus.COMPLETED);
      expect(createdSignal.problem_cluster_id).toBeDefined();

      // 2. Verify audit record stored fallback model
      const aiOps = await mockDb.getAIOperations(createdSignal.id);
      expect(aiOps.length).toBeGreaterThan(0);
      expect(aiOps[0].model).toBe('gemini-3.5-flash');
      expect(aiOps[0].status).toBe('SUCCESS');

      // 3. Verify ProblemCluster was created
      const problemId = createdSignal.problem_cluster_id;
      const problemCluster = await mockDb.getProblemCluster(problemId);
      expect(problemCluster).not.toBeNull();
      expect(problemCluster?.id).toBe(problemId);
      expect(problemCluster?.category).toBe('drainage');
      expect(problemCluster?.signal_count).toBe(1);

      // 4. Verify problem is retrievable in GET /api/v1/problems
      const getProblemsRes = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', 'Bearer officer-token');

      expect(getProblemsRes.status).toBe(200);
      const found = getProblemsRes.body.data.some((p: any) => p.id === problemId);
      expect(found).toBe(true);
    });

    it('fails cleanly with 503 and DOES NOT create ProblemCluster when both models fail', async () => {
      // Mock fetch: all calls fail with 503
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => '503 High demand on all models'
      } as any);

      const geminiProvider = new GeminiAIProvider({
        primaryModel: 'gemini-3.6-flash',
        fallbackModel: 'gemini-3.5-flash',
        maxRetries: 2,
        baseDelayMs: 2
      });
      ProviderContainer.setAIProvider(geminiProvider);

      const postRes = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer citizen-token')
        .send({
          original_text: 'Severe gas leak near hospital',
          location: { lat: 20.2961, lng: 85.8245 },
          auto_process: true
        });

      // Must return 503 AI_PROVIDER_UNAVAILABLE
      expect(postRes.status).toBe(503);
      expect(postRes.body.error.code).toBe('AI_PROVIDER_UNAVAILABLE');

      // ProblemCluster list must not have any new cluster
      const problemsRes = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', 'Bearer officer-token');

      const clusters = problemsRes.body.data;
      const gasCluster = clusters.find((p: any) => p.title?.includes('gas') || p.description?.includes('gas'));
      expect(gasCluster).toBeUndefined();
    });

    it('rejects direct clustering on unanalyzed signal with 400 SIGNAL_AI_INCOMPLETE', async () => {
      const signalRepo = new SignalRepository();
      const pendingSignal = await signalRepo.create({
        id: `sig_pending_${Date.now()}`,
        source_type: SignalSourceType.CITIZEN,
        citizen_id: 'usr_citizen_e2e',
        original_text: 'Raw unanalyzed signal',
        location: { lat: 20.2961, lng: 85.8245 },
        status: SignalStatus.ACTIVE,
        severity: SignalSeverity.LOW,
        processing_status: SignalProcessingStatus.PENDING,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const clusterRes = await request(app)
        .post(`/api/v1/signals/${pendingSignal.id}/cluster`)
        .set('Authorization', 'Bearer officer-token')
        .send({ auto_create: true });

      expect(clusterRes.status).toBe(400);
      expect(clusterRes.body.error.code).toBe('SIGNAL_AI_INCOMPLETE');
    });
  });
});
