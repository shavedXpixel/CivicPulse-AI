import { describe, it, expect } from 'vitest';
import { validateRealModeConfig, assertRealModeConfig } from '../src/config/env';

describe('Phase 10: REAL_MODE Environment Configuration Validation', () => {
  it('validates successfully when DEMO_MODE is true even without Firebase credentials', () => {
    const result = validateRealModeConfig({
      DEMO_MODE: true,
      FIREBASE_PROJECT_ID: ''
    } as any);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails validation when DEMO_MODE is false and FIREBASE_PROJECT_ID is empty', () => {
    const result = validateRealModeConfig({
      DEMO_MODE: false,
      FIREBASE_PROJECT_ID: ''
    } as any);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('FIREBASE_PROJECT_ID is required when DEMO_MODE=false');
  });

  it('validates successfully when DEMO_MODE is false and FIREBASE_PROJECT_ID is provided', () => {
    const result = validateRealModeConfig({
      DEMO_MODE: false,
      FIREBASE_PROJECT_ID: 'civicpulse-prod'
    } as any);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('assertRealModeConfig throws an explicit error when REAL_MODE configuration is invalid', () => {
    expect(() => {
      assertRealModeConfig({
        DEMO_MODE: false,
        FIREBASE_PROJECT_ID: ''
      } as any);
    }).toThrow(/REAL_MODE is active \(DEMO_MODE=false\) but configuration is incomplete/);
  });

  it('assertRealModeConfig passes silently when configuration is valid', () => {
    expect(() => {
      assertRealModeConfig({
        DEMO_MODE: false,
        FIREBASE_PROJECT_ID: 'civicpulse-prod'
      } as any);
    }).not.toThrow();
  });
});
