import { describe, it, expect, beforeEach } from 'vitest';
import { MockAIProvider } from '../src/providers/ai/mock.ai';
import { GeminiAIProvider } from '../src/providers/ai/gemini.provider';
import { ProviderContainer } from '../src/providers';
import { env } from '../src/config/env';
import { SignalAnalysisOutputSchema, AppError } from '@civicpulse/shared';

describe('Phase 3: AI Provider Architecture & Fallback Guardrails', () => {
  beforeEach(() => {
    ProviderContainer.setAIProvider(null);
  });

  it('selects MockAIProvider when DEMO_MODE=true', () => {
    env.DEMO_MODE = true;
    const provider = ProviderContainer.getAIProvider();
    expect(provider).toBeInstanceOf(MockAIProvider);
    expect(provider.getModelName()).toBe('mock-multilingual-civic-v1');
  });

  it('selects GeminiAIProvider when DEMO_MODE=false', () => {
    env.DEMO_MODE = false;
    const provider = ProviderContainer.getAIProvider();
    expect(provider).toBeInstanceOf(GeminiAIProvider);
    expect(provider.getModelName()).toContain('gemini');
    // Restore demo mode
    env.DEMO_MODE = true;
  });

  it('never silently falls back to MockAIProvider when credentials missing in non-demo mode', async () => {
    // Instantiate GeminiAIProvider directly or through ProviderContainer with DEMO_MODE=false and empty key
    const origKey = env.GEMINI_API_KEY;
    try {
      env.DEMO_MODE = false;
      env.GEMINI_API_KEY = '';
      const gemini = new GeminiAIProvider();

      await expect(
        gemini.analyzeSignal({
          text: 'Burst pipe on VIP road',
          location_reference: 'Nayapalli'
        })
      ).rejects.toThrow();

      try {
        await gemini.analyzeSignal({
          text: 'Burst pipe on VIP road'
        });
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe('CONFIGURATION_ERROR');
        expect(err.statusCode).toBe(500);
      }
    } finally {
      env.GEMINI_API_KEY = origKey;
      env.DEMO_MODE = true;
    }
  });

  it('MockAIProvider produces schema-compliant extraction for English civic report with critical facility', async () => {
    const mock = new MockAIProvider();
    const result = await mock.analyzeSignal({
      text: 'Sewage overflow outside Capital Hospital in Unit 6, blocking emergency entrance for 2 days.',
      location_reference: 'Capital Hospital Unit 6'
    });

    const parsed = SignalAnalysisOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.detected_language).toBe('en');
    expect(result.category).toBe('sanitation');
    expect(result.critical_facility).toContain('Capital Hospital');
    expect(result.recommended_department).toBe('BMC_SAN');
    expect(result.severity).toBe('CRITICAL');
    expect(result.confidence).toBeGreaterThan(0.85);
  });

  it('MockAIProvider correctly processes Odia language civic report', async () => {
    const mock = new MockAIProvider();
    const result = await mock.analyzeSignal({
      text: 'ୱାର୍ଡ ୧୮ ରେ ପାଇପ୍ ଲାଇନ୍ ଫାଟି ପାଣି ରାସ୍ତାରେ ଭାସୁଛି'
    });

    const parsed = SignalAnalysisOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.detected_language).toBe('od');
    expect(result.category).toBe('water_supply');
    expect(result.recommended_department).toBe('WATCO');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('MockAIProvider correctly processes Hindi language civic report', async () => {
    const mock = new MockAIProvider();
    const result = await mock.analyzeSignal({
      text: 'मुख्य सड़क पर बड़ा गड्ढा है और स्ट्रीट लाइट खराब है'
    });

    const parsed = SignalAnalysisOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.detected_language).toBe('hi');
    expect(['roads', 'streetlights']).toContain(result.category);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('MockAIProvider simulation hooks throw on simulated failure', async () => {
    const mock = new MockAIProvider();
    mock.simulateFailure(true);

    await expect(
      mock.analyzeSignal({
        text: 'Normal signal'
      })
    ).rejects.toThrow('Simulated Mock AI analysis failure for resilience testing');
  });

  it('MockAIProvider simulation hooks trigger low confidence score', async () => {
    const mock = new MockAIProvider();
    mock.simulateLowConfidence(true);

    const result = await mock.analyzeSignal({
      text: 'Vague complaint'
    });

    expect(result.confidence).toBe(0.45);
    expect(result.explanation).toContain('Low-confidence simulated extraction');
  });
});
