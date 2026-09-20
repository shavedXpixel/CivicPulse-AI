import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiAIProvider } from '../src/providers/ai/gemini.provider';
import { env } from '../src/config/env';
import { AppError } from '@civicpulse/shared';

describe('PHASE 15B.5.3.18-HF2 — Gemini Embedding Model Resolution & Invariants', () => {
  const MOCK_API_KEY = 'mock-gemini-key-12345';
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. Configuration Resolution Invariants', () => {
    it('proves text-embedding-004 is NEVER selected in the active production path', () => {
      expect(env.AI_EMBEDDING_MODEL).not.toBe('text-embedding-004');
      expect(env.AI_MODEL_EMBEDDING).not.toBe('text-embedding-004');
    });

    it('proves the intended embedding model (gemini-embedding-001) is selected as default', () => {
      expect(env.AI_EMBEDDING_MODEL).toBe('gemini-embedding-001');
      expect(env.AI_MODEL_EMBEDDING).toBe('gemini-embedding-001');
    });

    it('allows explicit configuration override via GeminiAIProviderConfig', async () => {
      const customProvider = new GeminiAIProvider({
        apiKey: MOCK_API_KEY,
        embeddingModel: 'gemini-embedding-2'
      });

      let requestedUrl = '';
      let requestedBody: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        requestedUrl = String(url);
        requestedBody = JSON.parse(String(init?.body));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            embedding: { values: new Array(1536).fill(0.01) }
          })
        } as any;
      });

      await customProvider.generateEmbedding('test text');

      expect(requestedUrl).toContain('models/gemini-embedding-2:embedContent');
      expect(requestedBody.model).toBe('models/gemini-embedding-2');
    });
  });

  describe('2. Provider Endpoint & Payload Verification', () => {
    it('dispatches embedding requests to the correct gemini-embedding-001 endpoint and model', async () => {
      const provider = new GeminiAIProvider({
        apiKey: MOCK_API_KEY,
        maxRetries: 1
      });

      let requestedUrl = '';
      let requestedBody: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        requestedUrl = String(url);
        requestedBody = JSON.parse(String(init?.body));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            embedding: { values: new Array(1536).fill(0.02) }
          })
        } as any;
      });

      const vector = await provider.generateEmbedding('Potable water pipeline rupture Ward 18');

      // 1. Endpoint must target gemini-embedding-001, never text-embedding-004
      expect(requestedUrl).toContain('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent');
      expect(requestedUrl).not.toContain('text-embedding-004');

      // 2. Request body must declare model and outputDimensionality
      expect(requestedBody.model).toBe('models/gemini-embedding-001');
      expect(requestedBody.content.parts[0].text).toBe('Potable water pipeline rupture Ward 18');
      expect(requestedBody.outputDimensionality).toBe(1536);

      // 3. Return values
      expect(vector).toHaveLength(1536);
    });
  });

  describe('3. Vector Dimensionality Compatibility', () => {
    it('requests 1536 dimensions matching PostgreSQL signals.new_embedding vector(1536)', async () => {
      const provider = new GeminiAIProvider({ apiKey: MOCK_API_KEY });

      let capturedPayload: any = null;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedPayload = JSON.parse(String(init?.body));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            embedding: { values: new Array(1536).fill(0.05) }
          })
        } as any;
      });

      const embedding = await provider.generateEmbedding('drainage overflow');

      expect(capturedPayload.outputDimensionality).toBe(1536);
      expect(embedding).toHaveLength(1536);
      expect(typeof embedding[0]).toBe('number');
    });

    it('throws 502 if the provider returns a malformed or missing vector', async () => {
      const provider = new GeminiAIProvider({ apiKey: MOCK_API_KEY, maxRetries: 1 });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ embedding: {} }) // Missing values array
      } as any);

      await expect(provider.generateEmbedding('test text')).rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining('Invalid embedding vector')
      });
    });
  });

  describe('4. Transient and Non-Transient Error Resilience', () => {
    it('retries transient 503 errors up to maxRetries and succeeds on subsequent attempt', async () => {
      const provider = new GeminiAIProvider({
        apiKey: MOCK_API_KEY,
        maxRetries: 3,
        baseDelayMs: 5
      });

      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          return {
            ok: false,
            status: 503,
            text: async () => '503 Service Unavailable: High demand on models/gemini-embedding-001'
          } as any;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            embedding: { values: new Array(1536).fill(0.01) }
          })
        } as any;
      });

      const vector = await provider.generateEmbedding('transient retry test');
      expect(callCount).toBe(2);
      expect(vector).toHaveLength(1536);
    });

    it('fails immediately without retry on non-transient 404 (Model Not Found)', async () => {
      const provider = new GeminiAIProvider({
        apiKey: MOCK_API_KEY,
        maxRetries: 3,
        baseDelayMs: 5
      });

      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        return {
          ok: false,
          status: 404,
          text: async () => 'models/invalid-model is not found for API version v1beta'
        } as any;
      });

      await expect(provider.generateEmbedding('test 404')).rejects.toMatchObject({
        statusCode: 404,
        code: 'AI_PROVIDER_ERROR',
        message: expect.stringContaining('non-transient error')
      });

      // Must NOT retry 404!
      expect(callCount).toBe(1);
    });

    it('fails immediately without retry on 400 Bad Request or 403 Forbidden', async () => {
      const provider = new GeminiAIProvider({
        apiKey: MOCK_API_KEY,
        maxRetries: 3,
        baseDelayMs: 5
      });

      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        return {
          ok: false,
          status: 400,
          text: async () => 'Bad Request: Output dimensionality not supported'
        } as any;
      });

      await expect(provider.generateEmbedding('test 400')).rejects.toMatchObject({
        statusCode: 400,
        code: 'AI_PROVIDER_ERROR'
      });

      expect(callCount).toBe(1);
    });

    it('throws CONFIGURATION_ERROR if GEMINI_API_KEY is not configured', async () => {
      const provider = new GeminiAIProvider({ apiKey: '' });

      await expect(provider.generateEmbedding('no key test')).rejects.toMatchObject({
        statusCode: 500,
        code: 'CONFIGURATION_ERROR',
        message: expect.stringContaining('GEMINI_API_KEY is not configured')
      });
    });
  });
});
