import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ProviderContainer,
  MockDatabaseProvider,
  FirestoreDatabaseProvider,
  getDatabaseProvider
} from '../src/providers';
import { env } from '../src/config/env';

describe('Phase 10: Centralized Database Provider Switching', () => {
  const originalDemoMode = env.DEMO_MODE;

  beforeEach(() => {
    ProviderContainer.resetAllProviders();
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    ProviderContainer.resetAllProviders();
  });

  it('returns MockDatabaseProvider when DEMO_MODE=true', () => {
    (env as any).DEMO_MODE = true;
    ProviderContainer.resetAllProviders();

    const db = getDatabaseProvider();
    expect(db).toBeInstanceOf(MockDatabaseProvider);
  });

  it('returns FirestoreDatabaseProvider when DEMO_MODE=false', () => {
    (env as any).DEMO_MODE = false;
    ProviderContainer.resetAllProviders();

    const db = getDatabaseProvider();
    expect(db).toBeInstanceOf(FirestoreDatabaseProvider);
  });

  it('preserves singleton instance across multiple getDatabaseProvider() calls in DEMO_MODE', () => {
    (env as any).DEMO_MODE = true;
    ProviderContainer.resetAllProviders();

    const db1 = getDatabaseProvider();
    const db2 = getDatabaseProvider();
    expect(db1).toBe(db2);
  });

  it('allows resetting providers cleanly via resetAllProviders()', () => {
    (env as any).DEMO_MODE = true;
    const dbMock = getDatabaseProvider();
    expect(dbMock).toBeInstanceOf(MockDatabaseProvider);

    (env as any).DEMO_MODE = false;
    ProviderContainer.resetAllProviders();

    const dbReal = getDatabaseProvider();
    expect(dbReal).toBeInstanceOf(FirestoreDatabaseProvider);
  });

  it('DEMO_MODE preserves Golden Demo problem PRB-2026-0819 with score 92', async () => {
    (env as any).DEMO_MODE = true;
    ProviderContainer.resetAllProviders();

    const db = getDatabaseProvider();
    const goldenProblem = await db.getProblemCluster('PRB-2026-0819');
    expect(goldenProblem).not.toBeNull();
    expect(goldenProblem?.impact_score).toBe(92);
    expect(goldenProblem?.ward_id).toBe('WARD-018');
    expect(goldenProblem?.estimated_population).toBe(18400);
  });
});
