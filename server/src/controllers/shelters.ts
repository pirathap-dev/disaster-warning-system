import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  clearShelterOccupancy,
  createShelterRecord,
  getShelterById,
  getShelters,
} from '../services/reliefService';
import { ServiceError } from '../services/serviceError';

function requestBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ServiceError('Request body must be a JSON object', 400, 'VALIDATION_ERROR');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new ServiceError(`${field} is required and must be ${maxLength} characters or fewer`, 400, 'VALIDATION_ERROR');
  }
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ServiceError(`${field} must be a positive whole number`, 400, 'INVALID_QUANTITY');
  }
  return value;
}

export const listShelters = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: await getShelters() });
});

export const createShelter = asyncHandler(async (req: Request, res: Response) => {
  const body = requestBody(req.body);
  if (!Array.isArray(body.facilities) ||
      body.facilities.some((facility) => typeof facility !== 'string' || facility.trim().length === 0 || facility.trim().length > 80)) {
    throw new ServiceError('Facilities must be a list of names up to 80 characters each', 400, 'VALIDATION_ERROR');
  }
  const facilities = [...new Set(body.facilities.map((facility) => (facility as string).trim()))];
  res.status(201).json({
    success: true,
    data: await createShelterRecord({
      name: requiredString(body.name, 'Shelter name', 120),
      location: requiredString(body.location, 'Location', 200),
      capacity: positiveInteger(body.capacity, 'Capacity'),
      facilities,
    }),
  });
});

export const readShelter = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new ServiceError('Invalid shelter ID', 400, 'INVALID_ID');
  }
  res.status(200).json({ success: true, data: await getShelterById(req.params.id) });
});

export const clearShelter = asyncHandler(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new ServiceError('Invalid shelter ID', 400, 'INVALID_ID');
  }
  res.status(200).json({ success: true, data: await clearShelterOccupancy(req.params.id) });
});
