import { ProblemStatus } from './problem';

export enum AssignmentPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum AssignmentStatus {
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  COMPLETED = 'COMPLETED',
  ESCALATED = 'ESCALATED',
  CANCELLED = 'CANCELLED'
}

export type SLARiskStatus = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'MET';

export interface SLAState {
  problem_id: string;
  target_hours: number;
  assigned_at: string;
  due_at: string;
  resolved_at?: string;
  hours_elapsed: number;
  hours_remaining: number;
  status: SLARiskStatus;
  is_at_risk: boolean;
  is_breached: boolean;
  was_breached: boolean; // Historical indicator: true if deadline was exceeded before/at resolution
}

export interface Department {
  id: string;
  name: string;
  short_name: string;
  description: string;
  lead_officer: string;
  contact_phone: string;
  contact_email: string;
  jurisdiction_wards: number[];
}

export interface DepartmentWorkload {
  department_id: string;
  department_name?: string;
  total_assigned: number;
  active_in_progress: number;
  awaiting_verification: number;
  critical_or_high: number;
  sla_breached: number;
  sla_at_risk: number;
  capacity_rating?: string;
}

export interface Assignment {
  id: string;
  problem_id: string;
  department_id: string;
  previous_department_id?: string;
  assigned_to?: string;
  assigned_by: string;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  assigned_at: string;
  due_at?: string;
  completed_at?: string;
  notes?: string;
  sla_state?: SLAState;
  created_at: string;
  updated_at: string;
}

export enum ActionType {
  CREATED = 'CREATED',
  TRIAGED = 'TRIAGED',
  ASSIGNED = 'ASSIGNED',
  REASSIGNED = 'REASSIGNED',
  ACCEPTED = 'ACCEPTED',
  STARTED_WORK = 'STARTED_WORK',
  ESCALATED = 'ESCALATED',
  REQUESTED_INFO = 'REQUESTED_INFO',
  EVIDENCE_ADDED = 'EVIDENCE_ADDED',
  RESOLUTION_SUBMITTED = 'RESOLUTION_SUBMITTED',
  VERIFICATION_REQUESTED = 'VERIFICATION_REQUESTED',
  VERIFICATION_COMPLETED = 'VERIFICATION_COMPLETED',
  RESOLVED = 'RESOLVED',
  REOPENED = 'REOPENED',
  CLOSED = 'CLOSED'
}

export interface ProblemAction {
  id: string;
  problem_id: string;
  actor_id?: string;
  actor_role?: string;
  action_type: ActionType;
  previous_state?: ProblemStatus;
  new_state?: ProblemStatus;
  target_department_id?: string;
  target_officer_id?: string;
  note?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

