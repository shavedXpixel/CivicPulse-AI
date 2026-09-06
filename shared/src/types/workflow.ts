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

export interface Assignment {
  id: string;
  problem_id: string;
  department_id: string;
  assigned_to?: string;
  assigned_by: string;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  assigned_at: string;
  due_at?: string;
  completed_at?: string;
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
  note?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}
