import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { getReliefResources } from '../services/reliefService';

export const listReliefResources = asyncHandler(
  async (_req: Request, res: Response) => {
    res.status(200).json({ success: true, data: await getReliefResources() });
  }
);
