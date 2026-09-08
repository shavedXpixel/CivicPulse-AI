import { describe, it, expect } from 'vitest';
import {
  CreateSignalSchema,
  RegisterMediaSchema,
  SignalAnalysisOutputSchema,
  IMPACT_WEIGHTS,
  IMPACT_MAX_SCORES,
  CIVIC_CATEGORIES
} from '../src/index';

describe('Shared Library', () => {
  it('validates a correct signal payload', () => {
    const validSignal = {
      original_text: 'Water supply stopped in Ward 18',
      location: { lat: 20.2961, lng: 85.8245 },
      ward_id: 'ward_18',
      media_ids: []
    };
    const result = CreateSignalSchema.safeParse(validSignal);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid signal with too short text', () => {
    const invalidSignal = {
      original_text: 'ab'
    };
    const result = CreateSignalSchema.safeParse(invalidSignal);
    expect(result.success).toBe(false);
  });

  it('impact weights sum up to exactly 1.0', () => {
    const sum =
      IMPACT_WEIGHTS.SEVERITY +
      IMPACT_WEIGHTS.POPULATION +
      IMPACT_WEIGHTS.DURATION +
      IMPACT_WEIGHTS.CONCENTRATION +
      IMPACT_WEIGHTS.CRITICAL_FACILITY +
      IMPACT_WEIGHTS.RECURRENCE +
      IMPACT_WEIGHTS.EVIDENCE;
    expect(Math.round(sum * 100) / 100).toBe(1.0);
  });

  it('impact maximum component scores sum up to 100', () => {
    const sum =
      IMPACT_MAX_SCORES.SEVERITY +
      IMPACT_MAX_SCORES.POPULATION +
      IMPACT_MAX_SCORES.DURATION +
      IMPACT_MAX_SCORES.CONCENTRATION +
      IMPACT_MAX_SCORES.CRITICAL_FACILITY +
      IMPACT_MAX_SCORES.RECURRENCE +
      IMPACT_MAX_SCORES.EVIDENCE;
    expect(sum).toBe(100);
  });

  it('contains water_supply in civic categories', () => {
    expect(CIVIC_CATEGORIES).toContain('water_supply');
  });

  it('validates a correct media registration within 10 MB limit', () => {
    const validMedia = {
      file_name: 'broken_pipe.jpg',
      mime_type: 'image/jpeg',
      file_size_bytes: 4 * 1024 * 1024 // 4 MB
    };
    const result = RegisterMediaSchema.safeParse(validMedia);
    expect(result.success).toBe(true);
  });

  it('rejects media exceeding the 10 MB canonical limit', () => {
    const oversizedMedia = {
      file_name: 'huge_recording.jpg',
      mime_type: 'image/jpeg',
      file_size_bytes: 11 * 1024 * 1024 // 11 MB > 10 MB
    };
    const result = RegisterMediaSchema.safeParse(oversizedMedia);
    expect(result.success).toBe(false);
  });

  it('rejects unsupported media MIME types', () => {
    const invalidTypeMedia = {
      file_name: 'script.sh',
      mime_type: 'application/x-sh',
      file_size_bytes: 1024
    };
    const result = RegisterMediaSchema.safeParse(invalidTypeMedia);
    expect(result.success).toBe(false);
  });
});

