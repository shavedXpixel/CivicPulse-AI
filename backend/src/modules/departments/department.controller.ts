import { Request, Response, NextFunction } from 'express';
import { getDatabaseProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES } from '@civicpulse/shared';

export class DepartmentController {
  /**
   * Returns municipal departments directory / metadata.
   * Standardized: GET /api/v1/departments -> metadata/directory list.
   */
  public static async listDepartments(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = getDatabaseProvider();
      const departments = await db.listDepartments();
      res.status(200).json({
        data: departments
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Returns metadata for a specific department.
   */
  public static async getDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = getDatabaseProvider();
      const deptId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const dept = await db.getDepartment(deptId);
      if (!dept) {
        return next(
          new AppError({
            statusCode: 404,
            code: ERROR_CODES.NOT_FOUND,
            message: `Department ${deptId} not found.`
          })
        );
      }
      res.status(200).json({
        data: dept
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Standardized: GET /api/v1/departments/:id/workload
   * Returns specific workload metrics for that department (active load, SLA risk count, capacity).
   */
  public static async getWorkload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = getDatabaseProvider();
      const deptId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const workload = await db.getDepartmentWorkload(deptId);
      res.status(200).json({
        data: workload
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Standardized: GET /api/v1/departments/:id/officers
   * Returns list of eligible officers for this department.
   */
  public static async getDepartmentOfficers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = getDatabaseProvider();
      const deptId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const officers = await db.listDepartmentOfficers(deptId);
      res.status(200).json({
        data: officers
      });
    } catch (err) {
      next(err);
    }
  }
}

