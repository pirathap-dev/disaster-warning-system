import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { createReliefResource, getReliefResources, updateReliefResource } from '../services/reliefService';
import { ServiceError } from '../services/serviceError';

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ServiceError(`${field} is required`, 400, 'VALIDATION_ERROR');
  }
  return value.trim();
}

export const listReliefResources = asyncHandler(
  async (req: Request, res: Response) => {
    const ownerUserId = req.user?.role === 'RESOURCE_ORGANIZATION' ? req.user.id : undefined;
    res.status(200).json({ success: true, data: await getReliefResources(ownerUserId) });
  }
);

export const createReliefResourceRecord = asyncHandler(
  async (req: Request, res: Response) => {
    const availableQuantity = req.body?.availableQuantity;
    if (typeof availableQuantity !== 'number' || !Number.isInteger(availableQuantity) || availableQuantity < 0) {
      throw new ServiceError('Available quantity must be a non-negative whole number', 400, 'INVALID_QUANTITY');
    }
    const resource = await createReliefResource({
      ownerUserId: req.user!.id,
      name: requiredText(req.body.name, 'Name'),
      category: requiredText(req.body.category, 'Category'),
      availableQuantity,
      unit: requiredText(req.body.unit, 'Unit'),
      source: typeof req.body.source === 'string' ? req.body.source.trim() : undefined,
    });
    res.status(201).json({ success: true, data: resource });
  }
);

export const updateReliefResourceRecord = asyncHandler(
  async (req: Request, res: Response) => {
    const updates: Record<string, unknown> = {};
    for (const field of ['name', 'category', 'unit', 'source'] as const) {
      if (req.body?.[field] !== undefined) {
        updates[field] = field === 'source'
          ? (typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field])
          : requiredText(req.body[field], field);
      }
    }
    if (req.body?.availableQuantity !== undefined) {
      updates.availableQuantity = req.body.availableQuantity;
    }
    if (Object.keys(updates).length === 0) {
      throw new ServiceError('At least one stock field must be provided', 400, 'VALIDATION_ERROR');
    }
    const resource = await updateReliefResource(req.params.id, req.user!.id, updates);
    res.status(200).json({ success: true, data: resource });
  }
);
