import { Request, Response, NextFunction } from 'express';
import {
  SimulationScenarioInputSchema,
  BudgetAllocationInputSchema
} from '@civicpulse/shared';
import { simulationService } from './simulation.service';

export class SimulationController {
  public static async simulateProblem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = SimulationScenarioInputSchema.parse(req.body);
      const user = (req as any).user;
      const result = await simulationService.simulateProblem(validatedInput, user);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async getPresets(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const problemId = Array.isArray(req.params.problemId) ? req.params.problemId[0] : (req.params.problemId as string);
      const user = (req as any).user;
      const result = await simulationService.getPresets(problemId, user);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async simulateBudgetAllocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = BudgetAllocationInputSchema.parse(req.body);
      const user = (req as any).user;
      const result = await simulationService.simulateBudgetAllocation(validatedInput.total_budget_inr, user);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
