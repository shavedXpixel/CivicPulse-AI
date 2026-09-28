import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgresDatabaseProvider } from '../src/providers/database/postgres.provider';
import { ProblemStatus, ActionType, UserRole, ERROR_CODES } from '@civicpulse/shared';
import { AppError } from '../src/middleware/error.middleware';

describe('Regression: atomicTransitionStatus & RESOLVED -> CLOSED Lifecycle', () => {
  let mockClient: any;
  let mockPool: any;
  let provider: PostgresDatabaseProvider;

  const mockResolvedProblem = {
    id: 'PRB-2026-TEST',
    status: 'RESOLVED',
    title: 'Broken water main',
    category: 'water_supply',
    department_id: 'WATCO',
    ward_id: 'ward_12',
    impact_score: 65,
    impact_level: 'HIGH',
    assigned_to: 'officer-123',
    resolved_at: '2026-09-28T17:53:45.000Z',
    closed_at: null,
    created_at: new Date('2026-09-28T10:00:00Z'),
    updated_at: new Date('2026-09-28T17:53:45Z')
  };

  beforeEach(() => {
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn()
    };
    mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn().mockResolvedValue(undefined)
    };
    provider = new PostgresDatabaseProvider({ pool: mockPool as any });
  });

  it('1. RESOLVED -> CLOSED succeeds and correctly binds closed_at without index mismatch', async () => {
    const closedTime = '2026-09-29T00:00:00.000Z';
    const mockClosedProblem = {
      ...mockResolvedProblem,
      status: 'CLOSED',
      closed_at: closedTime,
      updated_at: new Date(closedTime)
    };

    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [mockResolvedProblem] }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({ rows: [mockClosedProblem] }) // UPDATE problem_clusters
      .mockResolvedValueOnce({ rows: [] }) // createAction INSERT
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await provider.atomicTransitionStatus(
      'PRB-2026-TEST',
      ProblemStatus.RESOLVED,
      ProblemStatus.CLOSED,
      {
        id: 'act_close_001',
        problem_id: 'PRB-2026-TEST',
        actor_id: 'officer_watco_01',
        actor_role: UserRole.DEPARTMENT_OFFICER,
        action_type: ActionType.CLOSED,
        previous_state: ProblemStatus.RESOLVED,
        new_state: ProblemStatus.CLOSED,
        note: 'Incident administrative audit complete. Case closed.',
        created_at: closedTime
      },
      {
        closed_at: closedTime
      }
    );

    // Verify returned problem state
    expect(result.problem.status).toBe(ProblemStatus.CLOSED);
    expect(result.problem.closed_at).toBe(closedTime);

    // Verify exact UPDATE SQL and parameters
    const updateCall = mockClient.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('UPDATE problem_clusters')
    );
    expect(updateCall).toBeDefined();

    const [sql, params] = updateCall;
    // Expected: status = $1, updated_at = NOW(), closed_at = $2 WHERE id = $3
    expect(sql).toBe(
      'UPDATE problem_clusters SET status = $1, updated_at = NOW(), closed_at = $2 WHERE id = $3 RETURNING *;'
    );
    expect(params).toEqual([
      ProblemStatus.CLOSED,
      closedTime,
      'PRB-2026-TEST'
    ]);
  });

  it('2. Stale expected_status throws 409 CONFLICT without mutating database', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [mockResolvedProblem] }) // SELECT ... FOR UPDATE (returns status: RESOLVED)
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      provider.atomicTransitionStatus(
        'PRB-2026-TEST',
        ProblemStatus.AWAITING_VERIFICATION, // Stale expectation
        ProblemStatus.CLOSED,
        {
          id: 'act_close_stale',
          problem_id: 'PRB-2026-TEST',
          actor_id: 'officer_watco_01',
          actor_role: UserRole.DEPARTMENT_OFFICER,
          action_type: ActionType.CLOSED,
          created_at: new Date().toISOString()
        }
      )
    ).rejects.toThrow(AppError);

    // Verify ROLLBACK was executed
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    // Verify no UPDATE query was executed
    const updateCall = mockClient.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('UPDATE problem_clusters')
    );
    expect(updateCall).toBeUndefined();
  });

  it('3. CLOSED -> REOPENED workflow correctly resets assignments and sets status', async () => {
    const mockClosedProblem = {
      ...mockResolvedProblem,
      status: 'CLOSED',
      closed_at: '2026-09-28T18:00:00.000Z'
    };

    const mockReopenedProblem = {
      ...mockClosedProblem,
      status: 'REOPENED',
      assigned_to: null,
      assigned_at: null,
      updated_at: new Date('2026-09-29T00:05:00.000Z')
    };

    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [mockClosedProblem] }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({ rows: [mockReopenedProblem] }) // UPDATE problem_clusters
      .mockResolvedValueOnce({ rows: [] }) // UPDATE assignments (cancel active)
      .mockResolvedValueOnce({ rows: [] }) // createAction INSERT
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await provider.atomicTransitionStatus(
      'PRB-2026-TEST',
      ProblemStatus.CLOSED,
      ProblemStatus.REOPENED,
      {
        id: 'act_reopen_001',
        problem_id: 'PRB-2026-TEST',
        actor_id: 'officer_watco_01',
        actor_role: UserRole.DEPARTMENT_OFFICER,
        action_type: ActionType.REOPENED,
        previous_state: ProblemStatus.CLOSED,
        new_state: ProblemStatus.REOPENED,
        note: 'Reopened for investigation.',
        created_at: '2026-09-29T00:05:00.000Z'
      },
      {
        assigned_to: null as any,
        assigned_at: null as any
      }
    );

    expect(result.problem.status).toBe(ProblemStatus.REOPENED);

    // Verify the cancellation of active assignments was issued
    const cancelAssignmentsCall = mockClient.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes("SET status = 'CANCELLED'")
    );
    expect(cancelAssignmentsCall).toBeDefined();
    expect(cancelAssignmentsCall[1]).toEqual(['PRB-2026-TEST']);
  });

  it('4. AWAITING_VERIFICATION -> RESOLVED populates resolved_at with matching placeholders', async () => {
    const resolvedTime = '2026-09-28T17:53:45.000Z';
    const mockAwaitingProblem = {
      ...mockResolvedProblem,
      status: 'AWAITING_VERIFICATION',
      resolved_at: null
    };

    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [mockAwaitingProblem] }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ ...mockAwaitingProblem, status: 'RESOLVED', resolved_at: resolvedTime }] })
      .mockResolvedValueOnce({ rows: [] }) // createAction
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await provider.atomicTransitionStatus(
      'PRB-2026-TEST',
      ProblemStatus.AWAITING_VERIFICATION,
      ProblemStatus.RESOLVED,
      {
        id: 'act_resolve_001',
        problem_id: 'PRB-2026-TEST',
        actor_id: 'officer_watco_01',
        actor_role: UserRole.DEPARTMENT_OFFICER,
        action_type: ActionType.RESOLVED,
        previous_state: ProblemStatus.AWAITING_VERIFICATION,
        new_state: ProblemStatus.RESOLVED,
        created_at: resolvedTime
      },
      {
        resolved_at: resolvedTime
      }
    );

    expect(result.problem.status).toBe(ProblemStatus.RESOLVED);

    const updateCall = mockClient.query.mock.calls.find((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes('UPDATE problem_clusters')
    );
    expect(updateCall).toBeDefined();
    const [sql, params] = updateCall;
    expect(sql).toBe(
      'UPDATE problem_clusters SET status = $1, updated_at = NOW(), resolved_at = $2 WHERE id = $3 RETURNING *;'
    );
    expect(params).toEqual([
      ProblemStatus.RESOLVED,
      resolvedTime,
      'PRB-2026-TEST'
    ]);
  });
});
