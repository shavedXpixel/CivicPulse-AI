import { describe, it, expect } from 'vitest';
import { WorkflowStateMachine, CANONICAL_TRANSITIONS } from '../src/modules/workflow/workflow.machine';
import {
  ProblemStatus,
  UserRole,
  ActionType,
  UserProfile,
  UserStatus,
  ProblemCluster,
  ImpactLevel,
  ERROR_CODES
} from '@civicpulse/shared';
import { AppError } from '../src/middleware/error.middleware';

describe('WorkflowStateMachine — 8-Step Canonical Lifecycle', () => {
  const baseProblem: ProblemCluster = {
    id: 'PRB-TEST-001',
    title: 'Water Pipe Rupture',
    category: 'water_supply',
    status: ProblemStatus.NEW,
    signal_count: 5,
    severity_score: 20,
    population_score: 15,
    duration_score: 10,
    concentration_score: 10,
    critical_exposure_score: 8,
    recurrence_score: 6,
    evidence_score: 4,
    impact_score: 73,
    impact_level: ImpactLevel.HIGH,
    first_detected_at: '2026-09-01T08:00:00Z',
    last_updated_at: '2026-09-01T08:00:00Z',
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z'
  };

  const adminUser: UserProfile = {
    id: 'usr_admin',
    email: 'admin@bmc.gov.in',
    display_name: 'Admin User',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z'
  };

  const deptOfficer: UserProfile = {
    id: 'usr_dept_watco',
    email: 'dept@watco.gov.in',
    display_name: 'WATCO Dept Officer',
    role: UserRole.DEPARTMENT_OFFICER,
    status: UserStatus.ACTIVE,
    department_id: 'WATCO',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z'
  };

  const assignedOfficer: UserProfile = {
    id: 'usr_field_assigned',
    email: 'field1@watco.gov.in',
    display_name: 'Assigned Field Officer',
    role: UserRole.FIELD_OFFICER,
    status: UserStatus.ACTIVE,
    department_id: 'WATCO',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z'
  };

  const unassignedOfficer: UserProfile = {
    id: 'usr_field_unassigned',
    email: 'field2@watco.gov.in',
    display_name: 'Unassigned Field Officer',
    role: UserRole.FIELD_OFFICER,
    status: UserStatus.ACTIVE,
    department_id: 'WATCO',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z'
  };

  const citizenUser: UserProfile = {
    id: 'usr_citizen',
    email: 'citizen@example.com',
    display_name: 'Citizen User',
    role: UserRole.CITIZEN,
    status: UserStatus.ACTIVE,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z'
  };

  it('1. NEW -> TRIAGED succeeds for Department Officer and Admin', () => {
    const p = { ...baseProblem, status: ProblemStatus.NEW };
    const rule = WorkflowStateMachine.validateTransition(p, ProblemStatus.TRIAGED, ActionType.TRIAGED, deptOfficer);
    expect(rule.to).toBe(ProblemStatus.TRIAGED);

    const ruleAdmin = WorkflowStateMachine.validateTransition(p, ProblemStatus.TRIAGED, ActionType.TRIAGED, adminUser);
    expect(ruleAdmin.to).toBe(ProblemStatus.TRIAGED);
  });

  it('2. TRIAGED -> ASSIGNED succeeds for Department Officer and Admin', () => {
    const p = { ...baseProblem, status: ProblemStatus.TRIAGED, department_id: 'WATCO' };
    const rule = WorkflowStateMachine.validateTransition(p, ProblemStatus.ASSIGNED, ActionType.ASSIGNED, deptOfficer);
    expect(rule.to).toBe(ProblemStatus.ASSIGNED);
  });

  it('3. ASSIGNED -> IN_PROGRESS succeeds for assigned Field Officer', () => {
    const p = {
      ...baseProblem,
      status: ProblemStatus.ASSIGNED,
      department_id: 'WATCO',
      assigned_to: assignedOfficer.id
    };
    const rule = WorkflowStateMachine.validateTransition(
      p,
      ProblemStatus.IN_PROGRESS,
      ActionType.STARTED_WORK,
      assignedOfficer
    );
    expect(rule.to).toBe(ProblemStatus.IN_PROGRESS);
  });

  it('4. ASSIGNED -> IN_PROGRESS is FORBIDDEN for unassigned Field Officer even in same department', () => {
    const p = {
      ...baseProblem,
      status: ProblemStatus.ASSIGNED,
      department_id: 'WATCO',
      assigned_to: assignedOfficer.id
    };
    expect(() =>
      WorkflowStateMachine.validateTransition(
        p,
        ProblemStatus.IN_PROGRESS,
        ActionType.STARTED_WORK,
        unassignedOfficer
      )
    ).toThrow(AppError);

    try {
      WorkflowStateMachine.validateTransition(
        p,
        ProblemStatus.IN_PROGRESS,
        ActionType.STARTED_WORK,
        unassignedOfficer
      );
    } catch (e: any) {
      expect(e.statusCode).toBe(403);
      expect(e.code).toBe(ERROR_CODES.FORBIDDEN);
    }
  });

  it('5. IN_PROGRESS -> AWAITING_VERIFICATION succeeds for assigned Field Officer', () => {
    const p = {
      ...baseProblem,
      status: ProblemStatus.IN_PROGRESS,
      department_id: 'WATCO',
      assigned_to: assignedOfficer.id
    };
    const rule = WorkflowStateMachine.validateTransition(
      p,
      ProblemStatus.AWAITING_VERIFICATION,
      ActionType.VERIFICATION_REQUESTED,
      assignedOfficer
    );
    expect(rule.to).toBe(ProblemStatus.AWAITING_VERIFICATION);
  });

  it('6. AWAITING_VERIFICATION -> RESOLVED succeeds for Department Officer / Admin', () => {
    const p = {
      ...baseProblem,
      status: ProblemStatus.AWAITING_VERIFICATION,
      department_id: 'WATCO',
      assigned_to: assignedOfficer.id
    };
    const rule = WorkflowStateMachine.validateTransition(
      p,
      ProblemStatus.RESOLVED,
      ActionType.RESOLVED,
      deptOfficer
    );
    expect(rule.to).toBe(ProblemStatus.RESOLVED);
  });

  it('7. RESOLVED -> CLOSED succeeds for Department Officer / Admin', () => {
    const p = {
      ...baseProblem,
      status: ProblemStatus.RESOLVED,
      department_id: 'WATCO'
    };
    const rule = WorkflowStateMachine.validateTransition(p, ProblemStatus.CLOSED, ActionType.CLOSED, deptOfficer);
    expect(rule.to).toBe(ProblemStatus.CLOSED);
  });

  it('8. CLOSED -> REOPENED and REOPENED -> TRIAGED succeed', () => {
    const pClosed = { ...baseProblem, status: ProblemStatus.CLOSED, department_id: 'WATCO' };
    const ruleReopen = WorkflowStateMachine.validateTransition(
      pClosed,
      ProblemStatus.REOPENED,
      ActionType.REOPENED,
      deptOfficer
    );
    expect(ruleReopen.to).toBe(ProblemStatus.REOPENED);

    const pReopened = { ...baseProblem, status: ProblemStatus.REOPENED, department_id: 'WATCO' };
    const ruleTriaged = WorkflowStateMachine.validateTransition(
      pReopened,
      ProblemStatus.TRIAGED,
      ActionType.TRIAGED,
      deptOfficer
    );
    expect(ruleTriaged.to).toBe(ProblemStatus.TRIAGED);
  });

  it('Rejects invalid transitions with 400 INVALID_STATE_TRANSITION', () => {
    const p = { ...baseProblem, status: ProblemStatus.NEW };

    // NEW cannot go directly to RESOLVED
    try {
      WorkflowStateMachine.validateTransition(p, ProblemStatus.RESOLVED, ActionType.RESOLVED, adminUser);
      expect.unreachable('Should have thrown error');
    } catch (e: any) {
      expect(e.statusCode).toBe(400);
      expect(e.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
    }

    // CLOSED cannot go directly to IN_PROGRESS without REOPENED
    const pClosed = { ...baseProblem, status: ProblemStatus.CLOSED };
    try {
      WorkflowStateMachine.validateTransition(
        pClosed,
        ProblemStatus.IN_PROGRESS,
        ActionType.STARTED_WORK,
        adminUser
      );
      expect.unreachable('Should have thrown error');
    } catch (e: any) {
      expect(e.statusCode).toBe(400);
      expect(e.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
    }
  });

  it('Citizens are strictly blocked with 403 Forbidden', () => {
    const p = { ...baseProblem, status: ProblemStatus.NEW };
    try {
      WorkflowStateMachine.validateTransition(p, ProblemStatus.TRIAGED, ActionType.TRIAGED, citizenUser);
      expect.unreachable('Should have thrown error');
    } catch (e: any) {
      expect(e.statusCode).toBe(403);
      expect(e.code).toBe(ERROR_CODES.FORBIDDEN);
    }
  });
});
