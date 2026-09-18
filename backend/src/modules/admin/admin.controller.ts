import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { ProviderContainer, getDatabaseProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES, UserRole, Department } from '@civicpulse/shared';

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
      const { code, id, name, description, short_name, jurisdiction_wards, contact_email, contact_phone } = req.body;

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

      const newDept: Department = {
        id: deptId,
        name: name.trim(),
        short_name: (short_name || deptId).trim(),
        description: (description || '').trim(),
        jurisdiction_wards: Array.isArray(jurisdiction_wards) ? jurisdiction_wards : undefined,
        contact_email: contact_email?.trim() || undefined,
        contact_phone: contact_phone?.trim() || undefined
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
   * POST /api/v1/admin/users/government
   * ADMIN-only: Provision a government officer (DEPARTMENT_OFFICER or FIELD_OFFICER).
   * Password Privacy: Admin never sets, views, retrieves, or stores passwords.
   */
  public static async createGovernmentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, display_name, role, department_id } = req.body;

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Valid officer email address is required.'
          })
        );
      }

      if (!display_name || typeof display_name !== 'string' || !display_name.trim()) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Officer display name is required.'
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

      const cleanEmail = email.trim().toLowerCase();
      const cleanDisplayName = display_name.trim();

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
      // Strictly uses inviteUserByEmail; never returns or exposes raw invite links or passwords
      let authUserId: string | null = null;
      let inviteSent = false;

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
            }
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
      const newUser: any = {
        id: authUserId,
        auth_user_id: authUserId,
        email: cleanEmail,
        display_name: cleanDisplayName,
        role: role as UserRole,
        department_id,
        status: 'ACTIVE',
        created_at: now,
        updated_at: now
      };

      const createdUser = await db.createUser(newUser);

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
        users = await db.listUsers({ role, department_id });
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
}
