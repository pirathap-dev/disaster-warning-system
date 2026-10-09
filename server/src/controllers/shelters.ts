import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler';
import { getShelterById, getShelters, updateShelterOccupancy } from '../services/reliefService';
import { ServiceError } from '../services/serviceError';

export const listShelters = asyncHandler(async (req: Request, res: Response) => {
  const shelters = await getShelters();
  const data = req.user?.role === 'SHELTER_COORDINATOR'
    ? shelters.filter((shelter) => shelter.coordinatorUserId === req.user!.id)
    : shelters;
  res.status(200).json({ success: true, data });
});

export const readShelter = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new ServiceError('Invalid shelter ID', 400, 'INVALID_ID');
  }
  const shelter = await getShelterById(req.params.id);
  if (req.user?.role === 'SHELTER_COORDINATOR' && shelter.coordinatorUserId !== req.user.id) {
    throw new ServiceError('You can only view your assigned shelter', 403, 'FORBIDDEN');
  }
  res.status(200).json({ success: true, data: shelter });
});

export const updateOccupancy = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new ServiceError('Invalid shelter ID', 400, 'INVALID_ID');
  }
  const updated = await updateShelterOccupancy(
    req.params.id,
    req.user!.id,
    req.body?.currentOccupancy
  );
  res.status(200).json({ success: true, data: updated });
});
