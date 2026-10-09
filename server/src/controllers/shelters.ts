import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler';
import { getShelterById, getShelters } from '../services/reliefService';
import { ServiceError } from '../services/serviceError';

export const listShelters = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: await getShelters() });
});

export const readShelter = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new ServiceError('Invalid shelter ID', 400, 'INVALID_ID');
  }
  res.status(200).json({ success: true, data: await getShelterById(req.params.id) });
});
