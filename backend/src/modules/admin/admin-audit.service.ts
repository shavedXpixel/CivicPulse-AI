import { createHash, randomUUID } from 'crypto';
import { AdminAuditRecord } from '@civicpulse/shared';
import { getDatabaseProvider } from '../../providers';
import { sanitizeObject } from '../../middleware/logger.middleware';

export interface RecordAdminActionParams {
  actor_user_id: string;
  actor_email?: string;
  action: 'PROVISION_USER' | 'RESEND_INVITE' | 'DISABLE_USER' | 'ENABLE_USER' | 'ACTIVATE_STAFF';
  target_user_id?: string;
  target_email: string;
  target_role: string;
  department_id?: string;
  result?: 'SUCCESS' | 'FAILURE';
  details?: Record<string, any>;
}

export class AdminAuditService {
  /**
   * Persists an immutable administrative audit record with cryptographic hash chaining.
   * Strictly sanitizes details to guarantee no secrets, credentials, or tokens are logged.
   */
  public static async recordAction(params: RecordAdminActionParams): Promise<AdminAuditRecord> {
    const db = getDatabaseProvider();
    const id = `audit_${Date.now()}_${randomUUID().substring(0, 8)}`;
    const timestamp = new Date().toISOString();

    // 1. Retrieve latest audit record to establish previous_hash
    let previousHash = 'GENESIS_CIVICPULSE_ADMIN_AUDIT';
    try {
      if (typeof db.listAdminAuditLogs === 'function') {
        const latestLogs = await db.listAdminAuditLogs({ limit: 1 });
        if (latestLogs && latestLogs.length > 0 && latestLogs[0].record_hash) {
          previousHash = latestLogs[0].record_hash;
        }
      }
    } catch {
      // Fallback to genesis hash if audit log retrieval fails
    }

    // 2. Sanitize details — never store raw tokens, passwords, action links, or secrets
    let safeDetails: Record<string, any> | undefined = undefined;
    if (params.details) {
      const sanitized = sanitizeObject(params.details);
      // Explicitly delete sensitive keys if present
      delete sanitized.password;
      delete sanitized.token;
      delete sanitized.access_token;
      delete sanitized.refresh_token;
      delete sanitized.action_link;
      delete sanitized.invitation_token;
      delete sanitized.secret;
      delete sanitized.service_role_key;
      safeDetails = sanitized;
    }

    // 3. Compute SHA-256 cryptographic record hash
    const hashPayload = [
      previousHash,
      id,
      params.actor_user_id,
      params.action,
      params.target_email.toLowerCase(),
      params.target_role,
      params.department_id || 'NONE',
      params.result || 'SUCCESS',
      timestamp
    ].join('|');

    const recordHash = createHash('sha256').update(hashPayload).digest('hex');

    const auditRecord: AdminAuditRecord = {
      id,
      actor_user_id: params.actor_user_id,
      actor_email: params.actor_email,
      action: params.action,
      target_user_id: params.target_user_id,
      target_email: params.target_email.toLowerCase(),
      target_role: params.target_role,
      department_id: params.department_id,
      result: params.result || 'SUCCESS',
      details: safeDetails,
      previous_hash: previousHash,
      record_hash: recordHash,
      created_at: timestamp
    };

    let persistedRecord = auditRecord;
    // 4. Persist to authoritative database (transactionally serialized)
    if (typeof db.createAdminAuditLog === 'function') {
      persistedRecord = await db.createAdminAuditLog(auditRecord);
    }

    // 5. Structured logger output
    console.info(
      '[ADMIN_AUDIT]',
      JSON.stringify({
        id: persistedRecord.id,
        actor: persistedRecord.actor_user_id,
        action: persistedRecord.action,
        target: persistedRecord.target_email,
        role: persistedRecord.target_role,
        department: persistedRecord.department_id,
        result: persistedRecord.result,
        hash: persistedRecord.record_hash
      })
    );

    return persistedRecord;
  }

  /**
   * Retrieves administrative audit records with optional email filtering.
   */
  public static async listAuditLogs(filter?: { target_email?: string; limit?: number }): Promise<AdminAuditRecord[]> {
    const db = getDatabaseProvider();
    if (typeof db.listAdminAuditLogs === 'function') {
      return db.listAdminAuditLogs(filter);
    }
    return [];
  }
}
