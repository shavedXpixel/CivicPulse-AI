import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ProviderContainer,
  MockDatabaseProvider,
  MockAIProvider
} from '../src/providers';
import { SignalAIService } from '../src/modules/signals/signal-ai.service';
import { SignalRepository } from '../src/modules/signals/signal.repository';
import { SignalService } from '../src/modules/signals/signal.service';
import { UserProfile, UserRole, UserStatus, SignalProcessingStatus } from '@civicpulse/shared';

describe('Signal AI Language Normalization & Text Invariance', () => {
  let app: ReturnType<typeof createApp>;
  let mockAI: MockAIProvider;
  let mockDb: MockDatabaseProvider;
  let signalAIService: SignalAIService;
  let signalService: SignalService;
  let signalRepo: SignalRepository;

  const citizenUser: UserProfile = {
    id: 'usr_citizen_01',
    role: UserRole.CITIZEN,
    email: 'citizen1@bhubaneswar.gov.in',
    status: UserStatus.ACTIVE,
    display_name: 'Priyadarshini Dash',
    ward_id: 'ward_18',
    created_at: new Date().toISOString()
  };

  beforeEach(() => {
    mockDb = new MockDatabaseProvider();
    mockAI = new MockAIProvider();
    ProviderContainer.setDatabaseProvider(mockDb);
    ProviderContainer.setAIProvider(mockAI);

    signalRepo = new SignalRepository();
    signalService = new SignalService(signalRepo);
    signalAIService = new SignalAIService(signalRepo, signalService);

    app = createApp();
  });

  it('Odia original_text remains unchanged after AI analysis', async () => {
    const odiaText = 'ୱାର୍ଡ ୧୮ ରେ ପାଇପ୍ ଲାଇନ୍ ଫାଟି ପାଣି ରାସ୍ତାରେ ଭାସୁଛି';

    const createRes = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: odiaText,
        ward_id: 'WARD-018',
        location_reference: 'Nayapalli Market',
        auto_process: false
      });

    expect(createRes.status).toBe(201);
    const signalId = createRes.body.data.id;
    expect(createRes.body.data.original_text).toBe(odiaText);

    const analyzeRes = await request(app)
      .post(`/api/v1/signals/${signalId}/analyze`)
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(analyzeRes.status).toBe(200);
    const { signal } = analyzeRes.body.data;

    // Verify original_text is preserved exactly
    expect(signal.original_text).toBe(odiaText);

    // Verify in database as well
    const persisted = await signalRepo.findById(signalId);
    expect(persisted?.original_text).toBe(odiaText);
  });

  it('Odia is normalized to canonical language "or" when AI responds with "od"', async () => {
    const odiaText = 'ୱାର୍ଡ ୧୮ ରେ ପାଇପ୍ ଲାଇନ୍ ଫାଟି ପାଣି ରାସ୍ତାରେ ଭାସୁଛି';

    // MockAI returns detected_language: 'od' for Odia text
    const aiOutput = await mockAI.analyzeSignal({ text: odiaText });
    expect(aiOutput.detected_language).toBe('od');

    // Submit signal and run analysis through SignalAIService
    const createdSignal = await signalService.createSignal(citizenUser, {
      original_text: odiaText,
      ward_id: 'WARD-018'
    });

    const result = await signalAIService.analyzeSignal(citizenUser, createdSignal.id);

    // AI analysis output must normalize "od" to canonical "or"
    expect(result.analysis.detected_language).toBe('or');
    expect(result.signal.language).toBe('or');

    // Persisted record must have language "or"
    const fetched = await signalRepo.findById(createdSignal.id);
    expect(fetched?.language).toBe('or');
  });

  it('normalized_text is English for non-English reports', async () => {
    const odiaText = 'ୱାର୍ଡ ୧୮ ରେ ପାଇପ୍ ଲାଇନ୍ ଫାଟି ପାଣି ରାସ୍ତାରେ ଭାସୁଛି';

    const createdSignal = await signalService.createSignal(citizenUser, {
      original_text: odiaText,
      ward_id: 'WARD-018'
    });

    const result = await signalAIService.analyzeSignal(citizenUser, createdSignal.id);

    // normalized_text must be present, in English (ASCII / Latin), not Odia script
    expect(result.signal.normalized_text).toBeDefined();
    expect(typeof result.signal.normalized_text).toBe('string');
    expect(result.signal.normalized_text!.length).toBeGreaterThan(10);

    // Must NOT contain Odia script characters (\u0B00-\u0B7F)
    expect(/[\u0B00-\u0B7F]/.test(result.signal.normalized_text!)).toBe(false);

    // Must contain English words appropriate for civic triage
    expect(/[a-zA-Z]/.test(result.signal.normalized_text!)).toBe(true);
    expect(result.signal.normalized_text).toContain('water pipeline leakage');
  });

  it('Hindi remains language "hi" and normalized_text is English', async () => {
    const hindiText = 'मुख्य सड़क पर बड़ा गड्ढा है और पानी बह रहा है';

    const createdSignal = await signalService.createSignal(citizenUser, {
      original_text: hindiText,
      ward_id: 'WARD-018'
    });

    const result = await signalAIService.analyzeSignal(citizenUser, createdSignal.id);

    // Language remains "hi"
    expect(result.analysis.detected_language).toBe('hi');
    expect(result.signal.language).toBe('hi');

    // original_text preserved
    expect(result.signal.original_text).toBe(hindiText);

    // normalized_text is English representation
    expect(result.signal.normalized_text).toBeDefined();
    expect(/[\u0900-\u097F]/.test(result.signal.normalized_text!)).toBe(false);
    expect(/[a-zA-Z]/.test(result.signal.normalized_text!)).toBe(true);
  });

  it('English remains language "en" and original_text is preserved', async () => {
    const englishText = 'Severe water pipe burst on VIP Road flooding entire lane';

    const createdSignal = await signalService.createSignal(citizenUser, {
      original_text: englishText,
      ward_id: 'WARD-018'
    });

    const result = await signalAIService.analyzeSignal(citizenUser, createdSignal.id);

    // Language is "en"
    expect(result.analysis.detected_language).toBe('en');
    expect(result.signal.language).toBe('en');

    // original_text preserved
    expect(result.signal.original_text).toBe(englishText);

    // normalized_text is English
    expect(result.signal.normalized_text).toBeDefined();
    expect(result.signal.normalized_text).toContain('water pipeline leakage');
  });

  it('AI re-analysis never overwrites original_text', async () => {
    const odiaText = 'ୱାର୍ଡ ୧୮ ରେ ପାଇପ୍ ଲାଇନ୍ ଫାଟି ପାଣି ରାସ୍ତାରେ ଭାସୁଛି';

    const createdSignal = await signalService.createSignal(citizenUser, {
      original_text: odiaText,
      ward_id: 'WARD-018'
    });

    expect(createdSignal.original_text).toBe(odiaText);

    // 1st analysis
    const firstAnalysis = await signalAIService.analyzeSignal(citizenUser, createdSignal.id);
    expect(firstAnalysis.signal.original_text).toBe(odiaText);
    expect(firstAnalysis.signal.processing_status).toBe(SignalProcessingStatus.COMPLETED);

    // 2nd analysis (re-analysis)
    const secondAnalysis = await signalAIService.analyzeSignal(citizenUser, createdSignal.id);
    expect(secondAnalysis.signal.original_text).toBe(odiaText);
    expect(secondAnalysis.signal.processing_status).toBe(SignalProcessingStatus.COMPLETED);

    // Verify in database after repeated analysis
    const finalPersisted = await signalRepo.findById(createdSignal.id);
    expect(finalPersisted?.original_text).toBe(odiaText);
    expect(finalPersisted?.language).toBe('or');
  });
});
