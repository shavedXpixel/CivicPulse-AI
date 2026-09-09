import { Request, Response, NextFunction } from 'express';
import { SignalService } from './signal.service';
import { SignalAIService } from './signal-ai.service';
import { clusteringService } from '../clustering/clustering.service';
import { CreateSignalSchema, RegisterMediaSchema, PaginationQuerySchema } from '@civicpulse/shared';
import { AppError } from '../../middleware/error.middleware';

const signalService = new SignalService();
const signalAIService = new SignalAIService();

export class SignalController {
  public static async createSignal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const validationResult = CreateSignalSchema.safeParse(req.body);

      if (!validationResult.success) {
        const message = validationResult.error.errors.map((e) => e.message).join(', ');
        return next(
          new AppError({
            statusCode: 400,
            code: 'INVALID_REQUEST',
            message
          })
        );
      }

      // 1. Create and persist raw signal to database
      const signal = await signalService.createSignal(user, validationResult.data);

      // If auto_process is enabled, execute the automated end-to-end pipeline
      if (validationResult.data.auto_process) {
        // 2. Automated AI Analysis
        await signalAIService.analyzeSignal(user, signal.id);

        // 3. Automated Embedding & Clustering (Promote to cluster or attach to existing)
        const clusterResult = await clusteringService.clusterSignal(signal.id, {
          autoCreate: true,
          failOnEmbeddingError: true
        });

        // 4. Retrieve updated signal with latest state and link
        const updatedSignal = await signalService.getSignal(user, signal.id);

        res.status(201).json({
          data: {
            ...updatedSignal,
            cluster: clusterResult
          },
          cluster: clusterResult
        });
        return;
      }

      // Default: Return persisted raw signal
      res.status(201).json({
        data: signal
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getSignal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;

      const signal = await signalService.getSignal(user, id);

      res.status(200).json({
        data: signal
      });
    } catch (err) {
      next(err);
    }
  }

  public static async listSignals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const queryParsed = PaginationQuerySchema.safeParse(req.query);

      const query = queryParsed.success ? queryParsed.data : { limit: 20 };
      const result = await signalService.listSignals(user, {
        limit: query.limit,
        cursor: query.cursor,
        ward_id: query.ward_id,
        category: query.category,
        status: query.status,
        citizen_id: req.query.citizen_id as string
      });

      res.status(200).json({
        data: result.data,
        pagination: {
          limit: query.limit || 20,
          next_cursor: result.nextCursor
        }
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getMySignals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const limit = Number(req.query.limit) || 20;
      const cursor = req.query.cursor as string | undefined;

      const result = await signalService.listSignals(user, {
        limit,
        cursor,
        citizen_id: user.id
      });

      res.status(200).json({
        data: result.data,
        pagination: {
          limit,
          next_cursor: result.nextCursor
        }
      });
    } catch (err) {
      next(err);
    }
  }

  public static async registerMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;

      const validation = RegisterMediaSchema.safeParse(req.body);
      if (!validation.success) {
        const message = validation.error.errors.map((e) => e.message).join(', ');
        return next(
          new AppError({
            statusCode: 400,
            code: 'INVALID_REQUEST',
            message
          })
        );
      }

      const mediaResult = await signalService.registerMedia(user, id, validation.data);

      res.status(201).json({
        data: mediaResult
      });
    } catch (err) {
      next(err);
    }
  }

  public static async completeMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const mediaId = Array.isArray(req.params.mediaId) ? req.params.mediaId[0]! : req.params.mediaId!;

      await signalService.completeMedia(user, id, mediaId);

      res.status(200).json({
        data: {
          signal_id: id,
          media_id: mediaId,
          status: 'ATTACHED'
        }
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getSignalMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;

      const mediaItems = await signalService.getSignalMedia(user, id);

      res.status(200).json({
        data: mediaItems
      });
    } catch (err) {
      next(err);
    }
  }

  public static async analyzeSignal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;

      const result = await signalAIService.analyzeSignal(user, id);

      res.status(200).json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getSignalAI(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;

      const result = await signalAIService.getSignalAI(user, id);

      res.status(200).json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  public static async clusterSignal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const autoCreate = req.body?.auto_create === true;

      const result = await clusteringService.clusterSignal(id, { autoCreate });

      res.status(200).json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

