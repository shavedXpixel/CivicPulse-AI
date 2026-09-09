import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ProviderContainer,
  MockDatabaseProvider,
  MockAIProvider
} from '../src/providers';

describe('Phase 3: Signal AI Pipeline & Explicit Processing', () => {
  let app: ReturnType<typeof createApp>;
  let mockAI: MockAIProvider;

  beforeEach(() => {
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    mockAI = new MockAIProvider();
    ProviderContainer.setAIProvider(mockAI);
    app = createApp();
  });

  it('POST /api/v1/signals creates a signal with processing_status=PENDING without invoking AI', async () => {
    const res = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Open manhole posing severe hazard near DAV Public School, Unit 8',
        ward_id: 'WARD-018',
        location_reference: 'Near DAV Public School Gate 2',
        auto_process: false
      });

    expect(res.status).toBe(201);
    const signal = res.body.data;
    expect(signal.id).toBeDefined();
    expect(signal.processing_status).toBe('PENDING');
    // AI analysis must NOT have run yet
    expect(signal.ai_analysis).toBeUndefined();
    expect(signal.recommended_department).toBeUndefined();
    expect(signal.department_id).toBeUndefined();
  });

  it('POST /api/v1/signals/:id/analyze explicitly runs AI analysis and populates advisory recommendations without writing to department_id', async () => {
    // 1. Create a signal
    const createRes = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Burst drinking water pipeline flooding VIP Road near Nayapalli for 3 days',
        ward_id: 'WARD-018',
        location_reference: 'VIP Road Crossing',
        auto_process: false
      });

    expect(createRes.status).toBe(201);
    const signalId = createRes.body.data.id;
    expect(createRes.body.data.processing_status).toBe('PENDING');
    expect(createRes.body.data.department_id).toBeUndefined();

    // 2. Explicitly trigger AI analysis
    const analyzeRes = await request(app)
      .post(`/api/v1/signals/${signalId}/analyze`)
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(analyzeRes.status).toBe(200);
    const { signal, analysis, operation } = analyzeRes.body.data;

    // Verify AI analysis output
    expect(analysis).toBeDefined();
    expect(analysis.detected_language).toBe('en');
    expect(analysis.category).toBe('water_supply');
    expect(analysis.recommended_department).toBe('WATCO');
    expect(analysis.confidence).toBeGreaterThan(0.7);

    // Verify Signal updates
    expect(signal.processing_status).toBe('COMPLETED');
    expect(signal.normalized_text).toBeDefined();
    expect(signal.category).toBe('water_supply');
    expect(signal.severity).toBe('HIGH');
    expect(signal.recommended_department).toBe('WATCO');

    // CRITICAL USER REQUIREMENT:
    // Department recommendation must remain advisory in recommended_department.
    // Do NOT write the AI recommendation into authoritative department_id.
    expect(signal.department_id).toBeUndefined();

    // Verify AI Operation Audit Record
    expect(operation).toBeDefined();
    expect(operation.entity_id).toBe(signalId);
    expect(operation.operation_type).toBe('SIGNAL_UNDERSTANDING');
    expect(operation.status).toBe('SUCCESS');
    expect(operation.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/signals/:id/ai retrieves signal analysis and audit history', async () => {
    // 1. Use existing seeded signal sig_1001
    const analyzeRes = await request(app)
      .post('/api/v1/signals/sig_1001/analyze')
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(analyzeRes.status).toBe(200);

    // 2. Retrieve AI details
    const aiRes = await request(app)
      .get('/api/v1/signals/sig_1001/ai')
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(aiRes.status).toBe(200);
    expect(aiRes.body.data.signal).toBeDefined();
    expect(aiRes.body.data.signal.id).toBe('sig_1001');
    expect(aiRes.body.data.signal.processing_status).toBe('COMPLETED');
    expect(aiRes.body.data.signal.recommended_department).toBe('WATCO');
    // Authoritative department_id remains untouched
    expect(aiRes.body.data.signal.department_id).toBeUndefined();

    expect(Array.isArray(aiRes.body.data.operations)).toBe(true);
    expect(aiRes.body.data.operations.length).toBeGreaterThanOrEqual(1);
    expect(aiRes.body.data.operations[0].status).toBe('SUCCESS');
  });

  it('handles AI analysis failure safely: transitions signal to FAILED and audits failure', async () => {
    // 1. Configure mock AI to simulate failure
    mockAI.simulateFailure(true);

    const analyzeRes = await request(app)
      .post('/api/v1/signals/sig_1001/analyze')
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(analyzeRes.status).toBe(502);

    // 2. Verify signal transitioned safely to FAILED
    const getRes = await request(app)
      .get('/api/v1/signals/sig_1001')
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.processing_status).toBe('FAILED');

    // 3. Verify audit record logged FAILED status
    const aiRes = await request(app)
      .get('/api/v1/signals/sig_1001/ai')
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(aiRes.status).toBe(200);
    const failedOp = aiRes.body.data.operations.find((op: any) => op.status === 'FAILED');
    expect(failedOp).toBeDefined();
    expect(failedOp.entity_id).toBe('sig_1001');
  });

  it('enforces privacy: Citizen A cannot analyze Citizen B private signal', async () => {
    // sig_isolated_99 belongs to usr_citizen_02
    const res = await request(app)
      .post('/api/v1/signals/sig_isolated_99/analyze')
      .set('Authorization', 'Bearer demo-token-citizen'); // usr_citizen_01

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects unauthenticated requests to analyze with 401', async () => {
    const res = await request(app).post('/api/v1/signals/sig_1001/analyze');
    expect(res.status).toBe(401);
  });
});
