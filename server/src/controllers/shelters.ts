import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  createShelter as createShelterRecord,
  getCoordinatorShelterRequests,
  getShelterById,
  getShelters,
  requestShelterCoordinator,
  respondToCoordinatorShelterRequest,
  updateShelterOccupancy,
} from '../services/reliefService';
import { ServiceError } from '../services/serviceError';

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ServiceError(`${field} is required`, 400, 'VALIDATION_ERROR');
  }
  return value.trim();
}

export const listShelters = asyncHandler(async (req: Request, res: Response) => {
  const shelters = await getShelters();
  const data = req.user?.role === 'SHELTER_COORDINATOR'
    ? shelters.filter((shelter) => shelter.coordinatorUserId === req.user!.id)
    : shelters;
  res.status(200).json({ success: true, data });
});

export const createShelter = asyncHandler(async (req: Request, res: Response) => {
  const capacity = req.body?.capacity;
  if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity <= 0) {
    throw new ServiceError('Capacity must be a positive whole number', 400, 'INVALID_CAPACITY');
  }
  const shelter = await createShelterRecord({
    name: requiredText(req.body?.name, 'Name'),
    location: requiredText(req.body?.location, 'Location'),
    capacity,
  });
  res.status(201).json({ success: true, data: shelter });
});

function optionalRequestMessage(value: string): string | undefined {
  const message = value.trim();
  if (message.length > 500) {
    throw new ServiceError('Coordinator request message must be 500 characters or fewer', 400, 'VALIDATION_ERROR');
  }
  return message || undefined;
}

export const listCoordinatorRequests = asyncHandler(async (req: Request, res: Response) => {
  const data = await getCoordinatorShelterRequests(req.user!.id);
  res.status(200).json({ success: true, data });
});

export const requestCoordinator = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new ServiceError('Invalid shelter ID', 400, 'INVALID_ID');
  }
  const message = typeof req.body?.message === 'string'
    ? optionalRequestMessage(req.body.message)
    : undefined;
  const shelter = await requestShelterCoordinator(req.params.id, {
    requestedByUserId: req.user!.id,
    message,
  });
  res.status(201).json({ success: true, data: shelter });
});

export const respondToCoordinatorRequest = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new ServiceError('Invalid shelter ID', 400, 'INVALID_ID');
  }
  const decision = req.body?.decision;
  if (decision !== 'ACCEPTED' && decision !== 'DECLINED') {
    throw new ServiceError('Decision must be ACCEPTED or DECLINED', 400, 'VALIDATION_ERROR');
  }
  const shelter = await respondToCoordinatorShelterRequest(
    req.params.id,
    req.user!.id,
    decision
  );
  res.status(200).json({ success: true, data: shelter });
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
