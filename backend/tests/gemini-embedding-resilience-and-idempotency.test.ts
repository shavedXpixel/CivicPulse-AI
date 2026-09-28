import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ProviderContainer,
  MockDatabaseProvider,
  MockAIProvider
} from '../src/providers';
import {
  SignalStatus,
  SignalProcessingStatus
} from '@civicpulse/shared';
import { env } from '../src/config/env';
import { GeminiAIProvider, isTransientError, calculateBackoffWithJitter } from '../src/providers/ai/gemini.provider';
import { isDuplicateSignalFingerprint } from '../src/modules/signals/signal.service';

describe('Gemini Embedding Resilience, 429 Backoff & Idempotency / Duplicate Fingerprint Suite', () => {
  let app: ReturnType<typeof createApp>;
  let mockDb: MockDatabaseProvider;
  let mockAI: MockAIProvider;

  beforeEach(() => {
    mockDb = new MockDatabaseProvider();
    mockAI = new MockAIProvider();
    ProviderContainer.setDatabaseProvider(mockDb);
    ProviderContainer.setAIProvider(mockAI);
    (env as any).DEMO_MODE = true;
    app = createApp();
  });

  // TEST 1: Same text + same location + same idempotency key -> ONE submission (cached response)
  it('1. same text + same location + same idempotency key -> one submission via idempotency cache', async () => {
    const idempotencyKey = `idem_exact_${Date.now()}_abc`;
    const text = 'Broken water tap flooding road near Jayadev Vihar';

    const res1 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        original_text: text,
        location: { lat: 20.2982, lng: 85.8436 },
        ward_id: 'WARD-018',
        auto_process: true
      });

    expect(res1.status).toBe(201);
    const signalId = res1.body.data.id;

    // Retry with SAME Idempotency-Key
    const res2 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        original_text: text,
        location: { lat: 20.2982, lng: 85.8436 },
        ward_id: 'WARD-018',
        auto_process: true
      });

    expect(res2.status).toBe(201);
    expect(res2.headers['x-cache-lookup']).toBe('HIT');
    expect(res2.body.data.id).toBe(signalId);

    // Exactly 1 signal in database with this text
    const list = await mockDb.listSignals({ citizen_id: 'usr_citizen_01' });
    const matching = list.data.filter((s) => s.original_text === text);
    expect(matching.length).toBe(1);
  });

  // TEST 2 & 7: same text + same location + no/reused logical retry -> duplicate protection (409)
  it('2 & 7. same text + same location + completed duplicate -> 409 CONFLICT', async () => {
    const res1 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Dangerous open transformer sparks on Master Canteen road',
        location: { lat: 20.2982, lng: 85.8436 },
        ward_id: 'WARD-018',
        auto_process: true
      });

    expect(res1.status).toBe(201);
    expect(res1.body.cluster).toBeDefined();

    // Duplicate submission within 60s cooldown of an already COMPLETED & clustered signal
    const res2 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Dangerous open transformer sparks on Master Canteen road',
        location: { lat: 20.2982, lng: 85.8436 },
        ward_id: 'WARD-018',
        auto_process: true
      });

    expect(res2.status).toBe(409);
    expect(res2.body.error).toBeDefined();
    expect(res2.body.error.code).toBe('CONFLICT');
  });

  // TEST 3: same text + different location within 60 seconds -> NEW signal
  it('3. same text + different location within 60 seconds -> NEW signal accepted', async () => {
    const text = 'Water leakage near road';

    const res1 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: text,
        location: { lat: 20.2980, lng: 85.8430 },
        ward_id: 'WARD-018',
        auto_process: true
      });

    expect(res1.status).toBe(201);
    const id1 = res1.body.data.id;

    // Same citizen, same text, but SUBSTANTIALLY DIFFERENT coordinates (> 25 meters, ~3.5 km away)
    const res2 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: text,
        location: { lat: 20.3300, lng: 85.8200 },
        ward_id: 'WARD-004',
        auto_process: true
      });

    expect(res2.status).toBe(201);
    const id2 = res2.body.data.id;

    // Must be distinct signals
    expect(id1).not.toBe(id2);
    const list = await mockDb.listSignals({ citizen_id: 'usr_citizen_01' });
    const matching = list.data.filter((s) => s.original_text === text);
    expect(matching.length).toBe(2);
  });

  // TEST 4: different text + same location within 60 seconds -> NEW signal
  it('4. different text + same location within 60 seconds -> NEW signal accepted', async () => {
    const coords = { lat: 20.2980, lng: 85.8430 };

    const res1 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Pothole on main lane',
        location: coords,
        ward_id: 'WARD-018',
        auto_process: true
      });

    expect(res1.status).toBe(201);
    const id1 = res1.body.data.id;

    const res2 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Fallen electric wire across pathway',
        location: coords,
        ward_id: 'WARD-018',
        auto_process: true
      });

    expect(res2.status).toBe(201);
    const id2 = res2.body.data.id;

    expect(id1).not.toBe(id2);
  });

  // TEST 5: same text + same location from different citizen -> NEW signal
  it('5. same text + same location from different citizen -> NEW signal accepted', async () => {
    const coords = { lat: 20.2980, lng: 85.8430 };
    const text = 'Sewage overflowing from manhole';

    // First citizen (usr_citizen_01) submits
    const res1 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: text,
        location: coords,
        ward_id: 'WARD-018',
        auto_process: true
      });

    expect(res1.status).toBe(201);
    const id1 = res1.body.data.id;

    // Second citizen (usr_citizen_02) submits identical text and location
    const res2 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen-2')
      .send({
        original_text: text,
        location: coords,
        ward_id: 'WARD-018',
        auto_process: true
      });

    expect(res2.status).toBe(201);
    const id2 = res2.body.data.id;

    expect(id1).not.toBe(id2);
    expect(res1.body.data.citizen_id).not.toBe(res2.body.data.citizen_id);
  });

  // TEST 6: retry after embedding PENDING -> reuses original signal
  it('6. retry after embedding PENDING reuses original signal without creating duplicate row', async () => {
    const coords = { lat: 20.2980, lng: 85.8430 };
    const text = 'Major water pipeline fracture near Unit 4 market';

    // First attempt: Gemini fails with 429
    const quotaErr: any = new Error('HTTP 429 RESOURCE_EXHAUSTED: Resource exhausted. Please try again later.');
    quotaErr.status = 429;
    vi.spyOn(mockAI, 'generateEmbedding').mockRejectedValueOnce(quotaErr);

    const res1 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: text,
        location: coords,
        ward_id: 'WARD-018',
        auto_process: true
      });

    expect(res1.status).toBe(201);
    expect(res1.body.degraded).toBe(true);
    const initialSignalId = res1.body.data.id;

    // Verify exactly 1 signal exists in DB so far with this text
    const listBefore = await mockDb.listSignals({ citizen_id: 'usr_citizen_01' });
    const matchingBefore = listBefore.data.filter((s) => s.original_text === text);
    expect(matchingBefore.length).toBe(1);

    // Second attempt (retry of SAME logical request): Gemini recovered and succeeds
    const res2 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: text,
        location: coords,
        ward_id: 'WARD-018',
        auto_process: true
      });

    // Processing now continues and succeeds
    expect(res2.status).toBe(201);
    expect(res2.body.cluster).toBeDefined();
    expect(res2.body.cluster.problem).toBeDefined();
    // Must NOT create duplicate signal: ID must match the original signal!
    expect(res2.body.data.id).toBe(initialSignalId);

    // Check DB count: still exactly 1 signal with this text
    const listAfter = await mockDb.listSignals({ citizen_id: 'usr_citizen_01' });
    const matchingAfter = listAfter.data.filter((s) => s.original_text === text);
    expect(matchingAfter.length).toBe(1);

    // Signal is now clustered and updated
    const finalSignal = await mockDb.getSignal(initialSignalId);
    expect(finalSignal!.processing_status).toBe(SignalProcessingStatus.COMPLETED);
    expect(finalSignal!.problem_cluster_id).toBeDefined();
  });

  // TEST 8: Genuinely new report -> new signal ID & existing clustering unchanged
  it('8. genuinely new report receives new signal ID and existing clustering behavior remains unchanged', async () => {
    const res1 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Sewage overflowing into stormwater drain near Rasulgarh flyover',
        location: { lat: 20.2882, lng: 85.8436 },
        ward_id: 'WARD-004',
        auto_process: true
      });

    expect(res1.status).toBe(201);
    expect(res1.body.data.status).toBe(SignalStatus.ATTACHED_TO_PROBLEM);
    expect(res1.body.data.processing_status).toBe(SignalProcessingStatus.COMPLETED);
    expect(res1.body.cluster).toBeDefined();
    expect(res1.body.cluster.isNewCluster).toBe(true);
    expect(res1.body.cluster.problem.title).toBeDefined();
  });

  // Fingerprint Unit Function Tests
  describe('Duplicate Fingerprint Unit Rules', () => {
    const baseSignal: any = {
      id: 'sig_1',
      original_text: 'Burst water pipe leaking onto road',
      category: 'WATER_SUPPLY',
      ward_id: 'WARD-018',
      location: { lat: 20.2980, lng: 85.8430 },
      location_reference: 'Near Delta Square',
      created_at: new Date(1000000).toISOString()
    };

    it('matches when text and coordinates are identical within cooldown', () => {
      const incoming: any = {
        original_text: 'Burst water pipe leaking onto road',
        category: 'WATER_SUPPLY',
        ward_id: 'WARD-018',
        location: { lat: 20.2980, lng: 85.8430 }
      };
      expect(isDuplicateSignalFingerprint(incoming, baseSignal, 60000, 1000000 + 10000)).toBe(true);
    });

    it('matches when coordinates have minor GPS jitter <= 25m', () => {
      // 0.0001 deg lat is ~11 meters
      const incoming: any = {
        original_text: '  burst water pipe leaking onto road  ',
        location: { lat: 20.2981, lng: 85.8430 }
      };
      expect(isDuplicateSignalFingerprint(incoming, baseSignal, 60000, 1000000 + 15000)).toBe(true);
    });

    it('does NOT match when coordinates are substantially different (> 25m)', () => {
      // 0.001 deg lat is ~111 meters
      const incoming: any = {
        original_text: 'Burst water pipe leaking onto road',
        location: { lat: 20.3100, lng: 85.8430 }
      };
      expect(isDuplicateSignalFingerprint(incoming, baseSignal, 60000, 1000000 + 15000)).toBe(false);
    });

    it('does NOT match when text is different', () => {
      const incoming: any = {
        original_text: 'Broken street light flashing',
        location: { lat: 20.2980, lng: 85.8430 }
      };
      expect(isDuplicateSignalFingerprint(incoming, baseSignal, 60000, 1000000 + 15000)).toBe(false);
    });

    it('does NOT match when cooldown window has expired', () => {
      const incoming: any = {
        original_text: 'Burst water pipe leaking onto road',
        location: { lat: 20.2980, lng: 85.8430 }
      };
      // 70 seconds later
      expect(isDuplicateSignalFingerprint(incoming, baseSignal, 60000, 1000000 + 70000)).toBe(false);
    });

    it('does NOT match when one has coordinates and the other does not', () => {
      const incoming: any = {
        original_text: 'Burst water pipe leaking onto road'
      };
      expect(isDuplicateSignalFingerprint(incoming, baseSignal, 60000, 1000000 + 10000)).toBe(false);
    });

    it('matches when neither has coordinates but ward and location_reference match', () => {
      const signalNoCoords: any = {
        ...baseSignal,
        location: undefined,
        ward_id: 'WARD-018',
        location_reference: 'Near Delta Square'
      };
      const incoming: any = {
        original_text: 'Burst water pipe leaking onto road',
        ward_id: 'WARD-018',
        location_reference: 'near delta square'
      };
      expect(isDuplicateSignalFingerprint(incoming, signalNoCoords, 60000, 1000000 + 10000)).toBe(true);
    });

    it('does NOT match when neither has coordinates but ward differs', () => {
      const signalNoCoords: any = {
        ...baseSignal,
        location: undefined,
        ward_id: 'WARD-018',
        location_reference: 'Near Delta Square'
      };
      const incoming: any = {
        original_text: 'Burst water pipe leaking onto road',
        ward_id: 'WARD-004',
        location_reference: 'Near Delta Square'
      };
      expect(isDuplicateSignalFingerprint(incoming, signalNoCoords, 60000, 1000000 + 10000)).toBe(false);
    });
  });

  // Additional Unit Verification: Exponential backoff with jitter and 429 transient classification
  describe('Gemini Provider 429 resilience & backoff unit behavior', () => {
    it('classifies 429 and RESOURCE_EXHAUSTED as transient errors', () => {
      expect(isTransientError(429)).toBe(true);
      expect(isTransientError(503)).toBe(true);
      expect(isTransientError(500)).toBe(true);
      expect(isTransientError(400)).toBe(false);
      expect(isTransientError(401)).toBe(false);

      const exhaustedErr = new Error('HTTP 429 RESOURCE_EXHAUSTED: Resource exhausted. Please try again later.');
      expect(isTransientError(undefined, exhaustedErr)).toBe(true);
    });

    it('calculates exponential backoff with positive jitter', () => {
      const delay1 = calculateBackoffWithJitter(1, 1000, 10000);
      const delay2 = calculateBackoffWithJitter(2, 1000, 10000);
      const delay3 = calculateBackoffWithJitter(3, 1000, 10000);

      // Attempt 1: 1000 * 2^0 = 1000 + [0, 300] jitter -> [1000, 1300]
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(1300);

      // Attempt 2: 1000 * 2^1 = 2000 + [0, 600] jitter -> [2000, 2600]
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThanOrEqual(2600);

      // Attempt 3: 1000 * 2^2 = 4000 + [0, 1200] jitter -> [4000, 5200]
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThanOrEqual(5200);
    });
  });
});
