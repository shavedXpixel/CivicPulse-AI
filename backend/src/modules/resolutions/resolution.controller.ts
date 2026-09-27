import { Request, Response, NextFunction } from 'express';
import { SubmitEvidenceSchema, ResolutionReviewSchema, RegisterMediaSchema, ERROR_CODES } from '@civicpulse/shared';
import { ResolutionService } from './resolution.service';
import { VerificationService } from './verification.service';
import { AppError } from '../../middleware/error.middleware';

export class ResolutionController {
  /**
   * POST /api/v1/problems/:id/media
   * Requests presigned R2 upload URL for resolution evidence photo.
   */
  public static async registerEvidenceMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const problemId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;

      const validation = RegisterMediaSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.errors.map((e) => e.message).join(', ');
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message
          })
        );
      }

      const mediaResult = await ResolutionService.registerEvidenceMedia(user, problemId, validation.data);

      res.status(201).json({
        data: mediaResult
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/problems/:id/media/:mediaId/complete
   * Finalizes presigned R2 upload for resolution evidence.
   */
  public static async completeEvidenceMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const problemId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const mediaId = Array.isArray(req.params.mediaId) ? req.params.mediaId[0]! : req.params.mediaId!;

      const result = await ResolutionService.completeEvidenceMedia(user, problemId, mediaId);

      res.status(200).json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/problems/:id/evidence (and /problems/:id/resolution-evidence)
   * Submits resolution proof. Successful submission from IN_PROGRESS transitions to AWAITING_VERIFICATION.
   * Evidence submission succeeds independently of AI availability.
   */
  public static async submitEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const problemId = req.params.id as string;
      const validatedInput = SubmitEvidenceSchema.parse(req.body);

      const result = await ResolutionService.submitEvidence(user, problemId, validatedInput);

      // Trigger AI verification asynchronously without blocking evidence submission
      // If AI fails or is unavailable, evidence submission remains completely successful
      VerificationService.verifyProblemEvidence(user, problemId, result.evidence.id).catch((err) => {
        console.warn(`[ResolutionController] Async AI verification skipped or delayed for ${problemId}:`, err.message);
      });

      res.status(201).json({
        data: {
          evidence: result.evidence,
          problem_status: result.problem_status,
          verification_status: 'PROCESSING'
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/problems/:id/evidence (and /problems/:id/resolution-evidence)
   * Returns list of submitted resolution evidence records for problem.
   */
  public static async listEvidence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const problemId = req.params.id as string;

      const evidence = await ResolutionService.listEvidence(user, problemId);
      res.status(200).json({ data: evidence });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/resolution-evidence/:id
   */
  public static async getEvidenceById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const evidenceId = req.params.id as string;

      const evidence = await ResolutionService.getEvidenceById(user, evidenceId);
      res.status(200).json({ data: evidence });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/problems/:id/verify (and /resolution-evidence/:id/verify)
   * Triggers or recalculates AI advisory evidence verification.
   */
  public static async verifyProblem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const problemId = req.params.id as string;
      const evidenceId = req.body?.evidence_id || (req.params.evidenceId as string | undefined);
      const forceReverify = req.body?.force === true || req.query.force === 'true';

      const verification = await VerificationService.verifyProblemEvidence(user, problemId, evidenceId, forceReverify);
      res.status(200).json({ data: verification });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/problems/:id/verification (and /resolution-evidence/:id/verification)
   * Returns the latest advisory verification result for a problem.
   */
  public static async getVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const problemId = req.params.id as string;

      const verification = await VerificationService.getLatestVerification(user, problemId);
      res.status(200).json({ data: verification });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/problems/:id/verification-history
   */
  public static async getVerificationHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const problemId = req.params.id as string;

      const history = await VerificationService.getVerificationHistory(user, problemId);
      res.status(200).json({ data: history });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/problems/:id/review-resolution
   * Authoritative human supervisor decision: ACCEPT (moves to RESOLVED) or REJECT (moves to IN_PROGRESS).
   */
  public static async reviewResolution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const problemId = req.params.id as string;
      const validatedInput = ResolutionReviewSchema.parse(req.body);

      const result = await ResolutionService.reviewResolution(user, problemId, validatedInput);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
