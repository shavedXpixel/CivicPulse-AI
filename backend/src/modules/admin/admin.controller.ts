import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { ProviderContainer, getDatabaseProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES, UserRole, UserStatus, Department, UserProfile } from '@civicpulse/shared';
import { AdminAuditService } from './admin-audit.service';

export class AdminController {
  /**
   * POST /api/v1/admin/reset-demo
   * DEMO-ONLY: Restores the in-memory MockDatabaseProvider state to canonical Golden Demo.
   * Strictly disabled in REAL_MODE.
   */
  public static async resetDemo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 1. Strictly disabled when DEMO_MODE is false (protects REAL_MODE & Firestore)
      if (!env.DEMO_MODE) {
        return next(
          new AppError({
            statusCode: 403,
            code: ERROR_CODES.FORBIDDEN,
            message: 'Demo reset is strictly disabled when DEMO_MODE is false (REAL_MODE active). Firestore data is protected.'
          })
        );
      }

      // 2. RBAC: Strictly restricted to municipal administrators
      if (req.user?.role !== UserRole.ADMIN) {
        return next(
          new AppError({
            statusCode: 403,
            code: ERROR_CODES.FORBIDDEN,
            message: 'Access denied. Only municipal administrators can reset the demo state.'
          })
        );
      }

      // 3. Reset in-memory demo database
      ProviderContainer.resetToGoldenDemo();

      // 4. Retrieve canonical Golden Demo problem to verify state
      const db = getDatabaseProvider();
      const canonicalProblem = await db.getProblemCluster('PRB-2026-0819');

      res.status(200).json({
        data: {
          status: 'RESET_SUCCESS',
          message: 'Golden Demo state restored to canonical baseline.',
          canonical_problem: canonicalProblem
            ? {
                id: canonicalProblem.id,
                title: canonicalProblem.title,
                ward_id: canonicalProblem.ward_id,
                impact_score: canonicalProblem.impact_score,
                department_id: canonicalProblem.department_id,
                status: canonicalProblem.status
              }
            : null,
          is_demo_only: true,
          reset_at: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/departments
   * ADMIN-only: Create a new municipal department with server-side validation.
   */
  public static async createDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, id, name, description, short_name, jurisdiction_wards, contact_email, contact_phone, status } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Department name is required.'
          })
        );
      }

      const rawCode = (code || id || short_name || name).trim().toUpperCase();
      const deptId = rawCode.replace(/[^A-Z0-9_]/g, '_');

      if (!deptId) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid department code or identifier.'
          })
        );
      }

      const db = getDatabaseProvider();
      const existing = await db.getDepartment(deptId);
      if (existing) {
        return next(
          new AppError({
            statusCode: 409,
            code: ERROR_CODES.CONFLICT,
            message: `Department with ID '${deptId}' already exists.`
          })
        );
      }

      const deptStatus: 'ACTIVE' | 'INACTIVE' = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

      const newDept: Department = {
        id: deptId,
        name: name.trim(),
        short_name: (short_name || deptId).trim(),
        description: (description || '').trim(),
        jurisdiction_wards: Array.isArray(jurisdiction_wards) ? jurisdiction_wards : undefined,
        contact_email: contact_email?.trim() || undefined,
        contact_phone: contact_phone?.trim() || undefined,
        status: deptStatus
      };

      let created: Department = newDept;
      if (typeof db.createDepartment === 'function') {
        created = await db.createDepartment(newDept);
      }

      res.status(201).json({
        data: {
          department: created,
          message: `Department '${deptId}' created successfully.`
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/departments/:id
   * ADMIN-only: Update department details (status, name, description, contact details).
   */
  public static async updateDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const db = getDatabaseProvider();
      const existing = await db.getDepartment(id);
      if (!existing) {
        return next(
          new AppError({
            statusCode: 404,
            code: ERROR_CODES.NOT_FOUND,
            message: `Department '${id}' not found.`
          })
        );
      }

      const { name, short_name, description, contact_email, contact_phone, jurisdiction_wards, status } = req.body;

      if (status && status !== 'ACTIVE' && status !== 'INACTIVE') {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: "Status must be either 'ACTIVE' or 'INACTIVE'."
          })
        );
      }

      const updates: Partial<Department> = {};
      if (name !== undefined) updates.name = String(name).trim();
      if (short_name !== undefined) updates.short_name = String(short_name).trim();
      if (description !== undefined) updates.description = String(description).trim();
      if (contact_email !== undefined) updates.contact_email = String(contact_email).trim() || undefined;
      if (contact_phone !== undefined) updates.contact_phone = String(contact_phone).trim() || undefined;
      if (jurisdiction_wards !== undefined && Array.isArray(jurisdiction_wards)) updates.jurisdiction_wards = jurisdiction_wards;
      if (status !== undefined) updates.status = status;

      let updated: Department = { ...existing, ...updates };
      if (typeof db.updateDepartment === 'function') {
        updated = await db.updateDepartment(id, updates);
      }

      res.status(200).json({
        data: {
          department: updated,
          message: `Department '${id}' updated successfully.`
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/users/government
   * ADMIN-only: Provision a government officer (DEPARTMENT_OFFICER or FIELD_OFFICER).
   * Password Privacy: Admin never sets, views, retrieves, or stores passwords.
   */
  /**
   * POST /api/v1/admin/users/government
   * ADMIN-only: Provision a government officer (DEPARTMENT_OFFICER or FIELD_OFFICER).
   * Lifecycle: Newly invited staff start in INVITED status.
   * Password Privacy: Admin never sets, views, retrieves, or stores passwords.
   */
  public static async createGovernmentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, role, department_id } = req.body;
      const rawName = req.body.full_name || req.body.display_name;

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Valid officer email address is required.'
          })
        );
      }

      if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Officer full name or display name is required.'
          })
        );
      }

      // Role validation: Role must be exactly DEPARTMENT_OFFICER or FIELD_OFFICER
      if (role !== UserRole.DEPARTMENT_OFFICER && role !== UserRole.FIELD_OFFICER) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Government user role must be exactly DEPARTMENT_OFFICER or FIELD_OFFICER.'
          })
        );
      }

      // Department validation: department_id required and department must exist
      if (!department_id || typeof department_id !== 'string') {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'department_id is required for government users.'
          })
        );
      }

      const db = getDatabaseProvider();
      const department = await db.getDepartment(department_id);
      if (!department) {
        return next(
          new AppError({
            statusCode: 404,
            code: ERROR_CODES.NOT_FOUND,
            message: `Department '${department_id}' does not exist.`
          })
        );
      }

      if (department.status === 'INACTIVE') {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Cannot assign staff to inactive department '${department_id}'.`
          })
        );
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanDisplayName = rawName.trim();

      // Explicitly disallow passwords in admin provisioning request
      if ((req.body as any).password) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Admin cannot set passwords. Officer passwords must be established directly by the officer via official invitation.'
          })
        );
      }

      // Check for duplicate email in database
      let existingUsers: any[] = [];
      if (typeof db.listUsers === 'function') {
        existingUsers = await db.listUsers();
      }
      const duplicateUser = existingUsers.find((u) => u.email?.toLowerCase() === cleanEmail);
      if (duplicateUser) {
        return next(
          new AppError({
            statusCode: 409,
            code: ERROR_CODES.CONFLICT,
            message: `User with email '${cleanEmail}' already exists in the system.`
          })
        );
      }

      // Safe production invitation flow (Password Privacy)
      // Uses inviteUserByEmail with redirect to account-setup page
      let authUserId: string | null = null;
      let inviteSent = false;
      const targetRedirect = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/update-password?type=invite`;

      if (env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseAdmin = createClient(env.SUPABASE_URL, supabaseKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          cleanEmail,
          {
            data: {
              full_name: cleanDisplayName,
              role,
              department_id
            },
            redirectTo: targetRedirect
          }
        );

        if (inviteErr || !inviteData?.user) {
          return next(
            new AppError({
              statusCode: 502,
              code: ERROR_CODES.INTERNAL_ERROR,
              message: `Failed to dispatch officer invitation email via Supabase Auth: ${inviteErr?.message || 'Unknown invitation error'}`
            })
          );
        }

        authUserId = inviteData.user.id;
        inviteSent = true;
      } else {
        // Test / mock environment fallback
        const { randomUUID } = await import('crypto');
        authUserId = randomUUID();
        inviteSent = true;
      }

      const now = new Date().toISOString();
      // Explicit Lifecycle State: Newly provisioned government staff starts in INVITED status
      const newUser: UserProfile = {
        id: authUserId,
        auth_user_id: authUserId,
        email: cleanEmail,
        display_name: cleanDisplayName,
        role: role as UserRole,
        department_id,
        status: UserStatus.INVITED,
        created_at: now,
        updated_at: now
      };

      const createdUser = await db.createUser(newUser);

      // Persist administrative audit record with cryptographic hash chain
      await AdminAuditService.recordAction({
        actor_user_id: req.user?.id || 'admin',
        actor_email: req.user?.email || 'admin@civicpulse.gov.in',
        action: 'PROVISION_USER',
        target_user_id: createdUser.id,
        target_email: cleanEmail,
        target_role: role,
        department_id,
        result: 'SUCCESS',
        details: { notice: 'Official government invitation dispatched to officer via Supabase Auth' }
      });

      res.status(201).json({
        data: {
          user: createdUser,
          invitation_sent: inviteSent,
          notice: 'Official government invitation dispatched to officer via Supabase Auth.'
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/users/:id/resend-invite
   * ADMIN-only: Resend/reissue an invitation for a pending unconfirmed INVITED government officer.
   */
  public static async resendInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const db = getDatabaseProvider();
      const user = await db.getUser(id);
      if (!user) {
        return next(
          new AppError({
            statusCode: 404,
            code: ERROR_CODES.NOT_FOUND,
            message: `User '${id}' not found.`
          })
        );
      }

      if (user.role !== UserRole.DEPARTMENT_OFFICER && user.role !== UserRole.FIELD_OFFICER) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invitations can only be managed for government staff accounts (DEPARTMENT_OFFICER or FIELD_OFFICER).'
          })
        );
      }

      if (user.status === UserStatus.ACTIVE) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Account for '${user.email}' is already activated. Cannot resend invitation.`
          })
        );
      }

      if (user.status === UserStatus.INACTIVE || user.status === UserStatus.SUSPENDED) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Account for '${user.email}' is currently ${user.status.toLowerCase()}. Please re-enable the account first.`
          })
        );
      }

      if (user.status !== UserStatus.INVITED) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Invitations can only be resent for users in INVITED status. Current status: ${user.status}.`
          })
        );
      }

      // Pending invitation reissue
      const targetRedirect = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/update-password?type=invite`;
      let actionLink: string | null = null;

      if (env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseAdmin = createClient(env.SUPABASE_URL, supabaseKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        const authId = user.auth_user_id || user.id;
        try {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(authId);
          if (userData?.user?.email_confirmed_at) {
            if (typeof db.updateUser === 'function') {
              await db.updateUser(user.id, { status: UserStatus.ACTIVE });
            }
            return next(
              new AppError({
                statusCode: 400,
                code: ERROR_CODES.VALIDATION_ERROR,
                message: `Account for '${user.email}' is already confirmed and active.`
              })
            );
          }
        } catch {
          // Continue with reissue
        }

        // Generate reissued invitation link server-side (never exposed to client/logs)
        const { data: linkData, error: inviteErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'invite',
          email: user.email!,
          options: {
            redirectTo: targetRedirect
          }
        });

        if (inviteErr || !linkData?.properties?.action_link) {
          return next(
            new AppError({
              statusCode: 502,
              code: ERROR_CODES.INTERNAL_ERROR,
              message: `Failed to reissue invitation via Supabase Auth: ${inviteErr?.message || 'Missing action link'}`
            })
          );
        }

        actionLink = linkData.properties.action_link;
      } else {
        // Dev / Test environment mock action link
        actionLink = `${targetRedirect}#access_token=mock_invite_token_${user.id}`;
      }

      // Retrieve department name for professional branding
      let departmentName = user.department_id || 'Municipal Operations';
      if (user.department_id) {
        const dept = await db.getDepartment(user.department_id);
        if (dept?.name) {
          departmentName = dept.name;
        }
      }

      // Deliver actual government invitation email via EmailProvider abstraction
      const emailProvider = ProviderContainer.getEmailProvider();
      await emailProvider.sendGovernmentInvitation({
        to: user.email!,
        fullName: user.display_name || 'Municipal Officer',
        role: user.role,
        departmentName,
        actionLink
      });

      // Record administrative audit log (safe metadata only; zero credentials or action links)
      await AdminAuditService.recordAction({
        actor_user_id: req.user?.id || 'admin',
        actor_email: req.user?.email || 'admin@civicpulse.gov.in',
        action: 'RESEND_INVITE',
        target_user_id: user.id,
        target_email: user.email!,
        target_role: user.role,
        department_id: user.department_id,
        result: 'SUCCESS',
        details: { notice: 'Government officer invitation reissued and dispatched via email' }
      });

      res.status(200).json({
        data: {
          success: true,
          message: `Official government invitation successfully resent to ${user.email}.`
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/users/:id/disable
   * ADMIN-only: Disable/deactivate a user account.
   */
  public static async disableUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const db = getDatabaseProvider();
      const user = await db.getUser(id);
      if (!user) {
        return next(
          new AppError({
            statusCode: 404,
            code: ERROR_CODES.NOT_FOUND,
            message: `User '${id}' not found.`
          })
        );
      }

      if (user.id === req.user?.id || (user as any).auth_user_id === req.user?.id) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Administrators cannot disable their own active administrative account.'
          })
        );
      }

      if (user.role !== UserRole.DEPARTMENT_OFFICER && user.role !== UserRole.FIELD_OFFICER) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Disable action is only available for government staff (DEPARTMENT_OFFICER or FIELD_OFFICER).'
          })
        );
      }

      let updated = user;
      if (typeof db.updateUser === 'function') {
        updated = await db.updateUser(user.id, { status: UserStatus.INACTIVE });
      }

      if (env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
          const supabaseAdmin = createClient(env.SUPABASE_URL, supabaseKey, {
            auth: { autoRefreshToken: false, persistSession: false }
          });
          const authId = user.auth_user_id || user.id;
          await supabaseAdmin.auth.admin.updateUserById(authId, {
            ban_duration: '876600h'
          });
        } catch (e: any) {
          console.warn('Could not ban Supabase user during account disable:', e.message);
        }
      }

      await AdminAuditService.recordAction({
        actor_user_id: req.user?.id || 'admin',
        actor_email: req.user?.email || 'admin@civicpulse.gov.in',
        action: 'DISABLE_USER',
        target_user_id: user.id,
        target_email: user.email!,
        target_role: user.role,
        department_id: user.department_id,
        result: 'SUCCESS',
        details: { previous_status: user.status, new_status: UserStatus.INACTIVE }
      });

      res.status(200).json({
        data: {
          user: updated,
          message: `User '${user.email}' disabled successfully.`
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/admin/users/:id/enable
   * ADMIN-only: Re-enable an inactive or suspended user account.
   */
  public static async enableUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const db = getDatabaseProvider();
      const user = await db.getUser(id);
      if (!user) {
        return next(
          new AppError({
            statusCode: 404,
            code: ERROR_CODES.NOT_FOUND,
            message: `User '${id}' not found.`
          })
        );
      }

      if (user.role !== UserRole.DEPARTMENT_OFFICER && user.role !== UserRole.FIELD_OFFICER) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Enable action is only available for government staff (DEPARTMENT_OFFICER or FIELD_OFFICER).'
          })
        );
      }

      let updated = user;
      if (typeof db.updateUser === 'function') {
        updated = await db.updateUser(user.id, { status: UserStatus.ACTIVE });
      }

      if (env.SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
          const supabaseAdmin = createClient(env.SUPABASE_URL, supabaseKey, {
            auth: { autoRefreshToken: false, persistSession: false }
          });
          const authId = user.auth_user_id || user.id;
          await supabaseAdmin.auth.admin.updateUserById(authId, {
            ban_duration: 'none'
          });
        } catch (e: any) {
          console.warn('Could not unban Supabase user during account enable:', e.message);
        }
      }

      await AdminAuditService.recordAction({
        actor_user_id: req.user?.id || 'admin',
        actor_email: req.user?.email || 'admin@civicpulse.gov.in',
        action: 'ENABLE_USER',
        target_user_id: user.id,
        target_email: user.email!,
        target_role: user.role,
        department_id: user.department_id,
        result: 'SUCCESS',
        details: { previous_status: user.status, new_status: UserStatus.ACTIVE }
      });

      res.status(200).json({
        data: {
          user: updated,
          message: `User '${user.email}' re-enabled successfully.`
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/users
   * ADMIN-only: List registered system users.
   */
  public static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = getDatabaseProvider();
      let users: any[] = [];
      if (typeof db.listUsers === 'function') {
        const role = req.query.role as UserRole | undefined;
        const department_id = req.query.department_id as string | undefined;
        const status = req.query.status as UserStatus | undefined;
        users = await db.listUsers({ role, department_id, status });
      }
      res.status(200).json({
        data: {
          users
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/audit-logs
   * ADMIN-only: List administrative audit records with hash integrity metadata.
   */
  public static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const target_email = req.query.target_email as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const logs = await AdminAuditService.listAuditLogs({ target_email, limit });
      res.status(200).json({
        data: {
          logs
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
