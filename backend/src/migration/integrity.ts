import fs from 'fs';
import path from 'path';
import { computeSha256 } from './canonical';

export interface OrphanFinding {
  entity_type: string;
  entity_id: string;
  field_name: string;
  missing_reference_type: string;
  missing_reference_id: string;
  severity: 'BLOCKER' | 'WARNING';
  details?: string;
}

export interface MediaInventoryItem {
  owning_record_type: string;
  owning_record_id: string;
  field_name: string;
  storage_path: string;
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
  physical_exists: boolean;
  sha256?: string;
  status: 'PRESENT' | 'MISSING_REMOTE' | 'STORAGE_UNAVAILABLE';
  error_message?: string;
}

export interface IntegrityCheckReport {
  timestamp: string;
  total_orphans: number;
  blocker_count: number;
  warning_count: number;
  orphan_findings: OrphanFinding[];
  media_inventory: MediaInventoryItem[];
  missing_media_count: number;
  summary: {
    orphan_signal_citizens: number;
    orphan_problem_references: number;
    orphan_cluster_members: number;
    orphan_assignment_users: number;
    orphan_assignment_departments: number;
    orphan_evidence_users: number;
    orphan_verification_records: number;
    orphan_media_references: number;
    orphan_action_actors: number;
    orphan_target_officers: number;
  };
}

export interface CollectionsData {
  users?: any[];
  citizen_profiles?: any[];
  departments?: any[];
  signals?: any[];
  problem_clusters?: any[];
  cluster_members?: any[];
  signal_media?: any[];
  assignments?: any[];
  problem_actions?: any[];
  resolution_evidence?: any[];
  verification_results?: any[];
  ai_operations?: any[];
  idempotency_records?: any[];
  [key: string]: any[] | undefined;
}

const KNOWN_SYSTEM_ACTORS = new Set([
  'civicpulse_ai_advisory',
  'SYSTEM',
  'SYSTEM_AUTO',
  'SLA_TIMER',
  'SIMULATION_ENGINE',
  'BACKGROUND_WORKER'
]);

/**
 * Validates relationship integrity across Firestore collections without mutating records.
 */
export function checkRelationshipIntegrity(collections: CollectionsData): IntegrityCheckReport {
  const users = collections.users || [];
  const departments = collections.departments || [];
  const signals = collections.signals || [];
  const problemClusters = collections.problem_clusters || [];
  const clusterMembers = collections.cluster_members || [];
  const signalMedia = collections.signal_media || [];
  const assignments = collections.assignments || [];
  const problemActions = collections.problem_actions || [];
  const resolutionEvidence = collections.resolution_evidence || [];
  const verificationResults = collections.verification_results || [];

  const userIds = new Set(users.map((u) => u.id));
  const departmentIds = new Set(departments.map((d) => d.id));
  const signalIds = new Set(signals.map((s) => s.id));
  const problemIds = new Set(problemClusters.map((p) => p.id));

  const findings: OrphanFinding[] = [];

  let orphanSignalCitizens = 0;
  let orphanProblemReferences = 0;
  let orphanClusterMembers = 0;
  let orphanAssignmentUsers = 0;
  let orphanAssignmentDepartments = 0;
  let orphanEvidenceUsers = 0;
  let orphanVerificationRecords = 0;
  let orphanMediaReferences = 0;
  let orphanActionActors = 0;
  let orphanTargetOfficers = 0;

  // 1. Orphan signal citizen IDs
  for (const sig of signals) {
    if (sig.citizen_id && !userIds.has(sig.citizen_id)) {
      orphanSignalCitizens++;
      findings.push({
        entity_type: 'signals',
        entity_id: sig.id,
        field_name: 'citizen_id',
        missing_reference_type: 'users',
        missing_reference_id: sig.citizen_id,
        severity: 'BLOCKER',
        details: `Signal references citizen_id "${sig.citizen_id}" which is not present in users collection.`
      });
    }
  }

  // 2. Orphan cluster members (problem_id or signal_id)
  for (const cm of clusterMembers) {
    if (cm.problem_id && !problemIds.has(cm.problem_id)) {
      orphanProblemReferences++;
      findings.push({
        entity_type: 'cluster_members',
        entity_id: cm.id,
        field_name: 'problem_id',
        missing_reference_type: 'problem_clusters',
        missing_reference_id: cm.problem_id,
        severity: 'BLOCKER',
        details: `Cluster member references problem_id "${cm.problem_id}" not found in problem_clusters.`
      });
    }
    if (cm.signal_id && !signalIds.has(cm.signal_id)) {
      orphanClusterMembers++;
      findings.push({
        entity_type: 'cluster_members',
        entity_id: cm.id,
        field_name: 'signal_id',
        missing_reference_type: 'signals',
        missing_reference_id: cm.signal_id,
        severity: 'BLOCKER',
        details: `Cluster member references signal_id "${cm.signal_id}" not found in signals.`
      });
    }
  }

  // 3. Orphan assignments (problem_id, assigned_to, assigned_by, department_id)
  for (const asgn of assignments) {
    if (asgn.problem_id && !problemIds.has(asgn.problem_id)) {
      orphanProblemReferences++;
      findings.push({
        entity_type: 'assignments',
        entity_id: asgn.id,
        field_name: 'problem_id',
        missing_reference_type: 'problem_clusters',
        missing_reference_id: asgn.problem_id,
        severity: 'BLOCKER',
        details: `Assignment references problem_id "${asgn.problem_id}" not found in problem_clusters.`
      });
    }
    if (asgn.assigned_to && !userIds.has(asgn.assigned_to)) {
      orphanAssignmentUsers++;
      findings.push({
        entity_type: 'assignments',
        entity_id: asgn.id,
        field_name: 'assigned_to',
        missing_reference_type: 'users',
        missing_reference_id: asgn.assigned_to,
        severity: 'BLOCKER',
        details: `Assignment assigned_to "${asgn.assigned_to}" not found in users collection.`
      });
    }
    if (asgn.assigned_by && !userIds.has(asgn.assigned_by) && !KNOWN_SYSTEM_ACTORS.has(asgn.assigned_by)) {
      orphanAssignmentUsers++;
      findings.push({
        entity_type: 'assignments',
        entity_id: asgn.id,
        field_name: 'assigned_by',
        missing_reference_type: 'users',
        missing_reference_id: asgn.assigned_by,
        severity: 'BLOCKER',
        details: `Assignment assigned_by "${asgn.assigned_by}" not found in users collection.`
      });
    }
    if (asgn.department_id && !departmentIds.has(asgn.department_id)) {
      orphanAssignmentDepartments++;
      findings.push({
        entity_type: 'assignments',
        entity_id: asgn.id,
        field_name: 'department_id',
        missing_reference_type: 'departments',
        missing_reference_id: asgn.department_id,
        severity: 'BLOCKER',
        details: `Assignment department_id "${asgn.department_id}" not found in departments.`
      });
    }
  }

  // 4. Orphan problem_actions (problem_id, actor_id, target_officer_id)
  for (const act of problemActions) {
    if (act.problem_id && !problemIds.has(act.problem_id)) {
      orphanProblemReferences++;
      findings.push({
        entity_type: 'problem_actions',
        entity_id: act.id,
        field_name: 'problem_id',
        missing_reference_type: 'problem_clusters',
        missing_reference_id: act.problem_id,
        severity: 'BLOCKER',
        details: `Problem action references problem_id "${act.problem_id}" not found in problem_clusters.`
      });
    }
    if (act.actor_id && !userIds.has(act.actor_id) && !KNOWN_SYSTEM_ACTORS.has(act.actor_id)) {
      orphanActionActors++;
      findings.push({
        entity_type: 'problem_actions',
        entity_id: act.id,
        field_name: 'actor_id',
        missing_reference_type: 'users',
        missing_reference_id: act.actor_id,
        severity: 'BLOCKER',
        details: `Problem action actor_id "${act.actor_id}" not found in users collection.`
      });
    }
    if (act.target_officer_id && !userIds.has(act.target_officer_id)) {
      orphanTargetOfficers++;
      findings.push({
        entity_type: 'problem_actions',
        entity_id: act.id,
        field_name: 'target_officer_id',
        missing_reference_type: 'users',
        missing_reference_id: act.target_officer_id,
        severity: 'BLOCKER',
        details: `Problem action target_officer_id "${act.target_officer_id}" not found in users collection.`
      });
    }
  }

  // 5. Orphan resolution_evidence (problem_id, submitted_by)
  for (const ev of resolutionEvidence) {
    if (ev.problem_id && !problemIds.has(ev.problem_id)) {
      orphanProblemReferences++;
      findings.push({
        entity_type: 'resolution_evidence',
        entity_id: ev.id,
        field_name: 'problem_id',
        missing_reference_type: 'problem_clusters',
        missing_reference_id: ev.problem_id,
        severity: 'BLOCKER',
        details: `Resolution evidence references problem_id "${ev.problem_id}" not found in problem_clusters.`
      });
    }
    if (ev.submitted_by && !userIds.has(ev.submitted_by)) {
      orphanEvidenceUsers++;
      findings.push({
        entity_type: 'resolution_evidence',
        entity_id: ev.id,
        field_name: 'submitted_by',
        missing_reference_type: 'users',
        missing_reference_id: ev.submitted_by,
        severity: 'BLOCKER',
        details: `Resolution evidence submitted_by "${ev.submitted_by}" not found in users collection.`
      });
    }
  }

  // 6. Orphan verification_results (problem_id, verified_by)
  for (const ver of verificationResults) {
    if (ver.problem_id && !problemIds.has(ver.problem_id)) {
      orphanProblemReferences++;
      findings.push({
        entity_type: 'verification_results',
        entity_id: ver.id,
        field_name: 'problem_id',
        missing_reference_type: 'problem_clusters',
        missing_reference_id: ver.problem_id,
        severity: 'BLOCKER',
        details: `Verification result references problem_id "${ver.problem_id}" not found in problem_clusters.`
      });
    }
    if (ver.verified_by && !userIds.has(ver.verified_by) && !KNOWN_SYSTEM_ACTORS.has(ver.verified_by)) {
      orphanVerificationRecords++;
      findings.push({
        entity_type: 'verification_results',
        entity_id: ver.id,
        field_name: 'verified_by',
        missing_reference_type: 'users',
        missing_reference_id: ver.verified_by,
        severity: 'BLOCKER',
        details: `Verification result verified_by "${ver.verified_by}" not found in users collection.`
      });
    }
  }

  // 7. Orphan signal_media (signal_id, uploaded_by)
  for (const sm of signalMedia) {
    if (sm.signal_id && !signalIds.has(sm.signal_id)) {
      orphanMediaReferences++;
      findings.push({
        entity_type: 'signal_media',
        entity_id: sm.id,
        field_name: 'signal_id',
        missing_reference_type: 'signals',
        missing_reference_id: sm.signal_id,
        severity: 'BLOCKER',
        details: `Signal media references signal_id "${sm.signal_id}" not found in signals.`
      });
    }
    if (sm.uploaded_by && !userIds.has(sm.uploaded_by)) {
      orphanMediaReferences++;
      findings.push({
        entity_type: 'signal_media',
        entity_id: sm.id,
        field_name: 'uploaded_by',
        missing_reference_type: 'users',
        missing_reference_id: sm.uploaded_by,
        severity: 'BLOCKER',
        details: `Signal media uploaded_by "${sm.uploaded_by}" not found in users collection.`
      });
    }
  }

  // Media inventory scan
  const mediaInventory = inventoryAllMedia(collections);
  const missingMediaCount = mediaInventory.filter((m) => !m.physical_exists).length;

  const blockerCount = findings.filter((f) => f.severity === 'BLOCKER').length;
  const warningCount = findings.filter((f) => f.severity === 'WARNING').length;

  return {
    timestamp: new Date().toISOString(),
    total_orphans: findings.length,
    blocker_count: blockerCount,
    warning_count: warningCount,
    orphan_findings: findings,
    media_inventory: mediaInventory,
    missing_media_count: missingMediaCount,
    summary: {
      orphan_signal_citizens: orphanSignalCitizens,
      orphan_problem_references: orphanProblemReferences,
      orphan_cluster_members: orphanClusterMembers,
      orphan_assignment_users: orphanAssignmentUsers,
      orphan_assignment_departments: orphanAssignmentDepartments,
      orphan_evidence_users: orphanEvidenceUsers,
      orphan_verification_records: orphanVerificationRecords,
      orphan_media_references: orphanMediaReferences,
      orphan_action_actors: orphanActionActors,
      orphan_target_officers: orphanTargetOfficers
    }
  };
}

/**
 * Scans all collections for media references and safely probes physical presence.
 */
export function inventoryAllMedia(collections: CollectionsData): MediaInventoryItem[] {
  const items: MediaInventoryItem[] = [];

  // 1. signal_media collection
  const signalMedia = collections.signal_media || [];
  for (const sm of signalMedia) {
    const storagePath = sm.storage_path || sm.url || sm.id;
    items.push(checkMediaExistence('signal_media', sm.id, 'storage_path', storagePath, sm.mime_type, sm.file_size_bytes));
  }

  // 2. signals media_urls or media_ids
  const signals = collections.signals || [];
  for (const sig of signals) {
    if (Array.isArray(sig.media_urls)) {
      for (let i = 0; i < sig.media_urls.length; i++) {
        const url = sig.media_urls[i];
        if (url) {
          items.push(checkMediaExistence('signals', sig.id, `media_urls[${i}]`, url));
        }
      }
    }
    if (Array.isArray(sig.media_ids)) {
      for (let i = 0; i < sig.media_ids.length; i++) {
        const mid = sig.media_ids[i];
        if (mid && typeof mid === 'string' && (mid.startsWith('signals/') || mid.includes('/'))) {
          items.push(checkMediaExistence('signals', sig.id, `media_ids[${i}]`, mid));
        }
      }
    }
  }

  // 3. resolution_evidence media_path / media_urls
  const evidence = collections.resolution_evidence || [];
  for (const ev of evidence) {
    if (ev.media_path) {
      items.push(checkMediaExistence('resolution_evidence', ev.id, 'media_path', ev.media_path, ev.mime_type, ev.file_size_bytes));
    }
    if (Array.isArray(ev.media_urls)) {
      for (let i = 0; i < ev.media_urls.length; i++) {
        const url = ev.media_urls[i];
        if (url) {
          items.push(checkMediaExistence('resolution_evidence', ev.id, `media_urls[${i}]`, url));
        }
      }
    }
  }

  return items;
}

/**
 * Safely inspects physical media without mutating anything.
 */
function checkMediaExistence(
  recordType: string,
  recordId: string,
  fieldName: string,
  storagePath: string,
  mimeType?: string,
  fileSizeBytes?: number
): MediaInventoryItem {
  const filename = path.basename(storagePath.split('?')[0]);

  // If local file path
  if (fs.existsSync(storagePath)) {
    try {
      const stats = fs.statSync(storagePath);
      const buffer = fs.readFileSync(storagePath);
      return {
        owning_record_type: recordType,
        owning_record_id: recordId,
        field_name: fieldName,
        storage_path: storagePath,
        filename,
        mime_type: mimeType || 'application/octet-stream',
        size_bytes: stats.size,
        physical_exists: true,
        sha256: computeSha256(buffer),
        status: 'PRESENT'
      };
    } catch (err: any) {
      return {
        owning_record_type: recordType,
        owning_record_id: recordId,
        field_name: fieldName,
        storage_path: storagePath,
        filename,
        mime_type: mimeType,
        size_bytes: fileSizeBytes,
        physical_exists: false,
        status: 'STORAGE_UNAVAILABLE',
        error_message: err.message
      };
    }
  }

  // If GCS or remote storage path
  // Since GCS bucket is unprovisioned / billing blocked, mark accurately
  return {
    owning_record_type: recordType,
    owning_record_id: recordId,
    field_name: fieldName,
    storage_path: storagePath,
    filename,
    mime_type: mimeType,
    size_bytes: fileSizeBytes,
    physical_exists: false,
    status: 'MISSING_REMOTE',
    error_message: 'Remote storage object not found (GCS bucket civicpulse-ai-f1bbf.firebasestorage.app unavailable / billing blocked)'
  };
}
