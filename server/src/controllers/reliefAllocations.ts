import { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  confirmReliefReceipt,
  createReliefAllocation,
  getReliefAllocationById,
  getReliefAllocations,
  updateReliefAllocationStatus,
} from '../services/reliefService';
import { ServiceError } from '../services/serviceError';
import { ReliefAllocationStatus } from '../types';

function requestBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ServiceError('Request body must be a JSON object', 400, 'VALIDATION_ERROR');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ServiceError(`${field} is required`, 400, 'VALIDATION_ERROR');
  }
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ServiceError(`${field} must be a positive whole number`, 400, 'INVALID_QUANTITY');
  }
  return value;
}

function optionalNotes(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 1000) {
    throw new ServiceError('Notes must be 1000 characters or fewer', 400, 'VALIDATION_ERROR');
  }
  return value.trim();
}

function validateId(id: string): void {
  if (!isValidObjectId(id)) {
    throw new ServiceError('Invalid allocation ID', 400, 'INVALID_ID');
  }
}

export const listReliefAllocations = asyncHandler(
  async (req: Request, res: Response) => {
    const { shelterId, resourceId, status } = req.query;
    if (shelterId !== undefined && (typeof shelterId !== 'string' || !isValidObjectId(shelterId))) {
      throw new ServiceError('Invalid shelter ID filter', 400, 'INVALID_ID');
    }
    if (resourceId !== undefined && (typeof resourceId !== 'string' || !isValidObjectId(resourceId))) {
      throw new ServiceError('Invalid resource ID filter', 400, 'INVALID_ID');
    }
    if (
      status !== undefined &&
      (typeof status !== 'string' ||
        !Object.values(ReliefAllocationStatus).includes(status as ReliefAllocationStatus))
    ) {
      throw new ServiceError('Invalid allocation status filter', 400, 'VALIDATION_ERROR');
    }

    const data = await getReliefAllocations({
      shelterId: shelterId as string | undefined,
      resourceId: resourceId as string | undefined,
      status: status as ReliefAllocationStatus | undefined,
    });
    res.status(200).json({ success: true, data });
  }
);

export const createAllocation = asyncHandler(
  async (req: Request, res: Response) => {
    const body = requestBody(req.body);
    const shelterId = requiredString(body.shelterId, 'Shelter');
    const resourceId = requiredString(body.resourceId, 'Resource');
    if (!isValidObjectId(shelterId) || !isValidObjectId(resourceId)) {
      throw new ServiceError('Invalid shelter or resource ID', 400, 'INVALID_ID');
    }
    const createdBy = requiredString(body.createdBy, 'Created by');
    if (createdBy.length > 120) {
      throw new ServiceError('Created by must be 120 characters or fewer', 400, 'VALIDATION_ERROR');
    }
    const notes = optionalNotes(body.notes);

    res.status(201).json({
      success: true,
      data: await createReliefAllocation({
        shelterId,
        resourceId,
        requestedQuantity: positiveInteger(body.requestedQuantity, 'Requested quantity'),
        createdBy,
        notes,
      }),
    });
  }
);

export const readAllocation = asyncHandler(
  async (req: Request, res: Response) => {
    validateId(req.params.id);
    res.status(200).json({
      success: true,
      data: await getReliefAllocationById(req.params.id),
    });
  }
);

export const updateAllocationStatus = asyncHandler(
  async (req: Request, res: Response) => {
    validateId(req.params.id);
    const body = requestBody(req.body);
    const status = body.status;
    if (
      typeof status !== 'string' ||
      !Object.values(ReliefAllocationStatus).includes(status as ReliefAllocationStatus)
    ) {
      throw new ServiceError('Invalid allocation status', 400, 'VALIDATION_ERROR');
    }
    res.status(200).json({
      success: true,
      data: await updateReliefAllocationStatus(
        req.params.id,
        status as ReliefAllocationStatus
      ),
    });
  }
);

export const confirmAllocationReceipt = asyncHandler(
  async (req: Request, res: Response) => {
    validateId(req.params.id);
    const body = requestBody(req.body);
    const notes = optionalNotes(body.notes);
    res.status(200).json({
      success: true,
      data: await confirmReliefReceipt(
        req.params.id,
        positiveInteger(body.receivedQuantity, 'Received quantity'),
        notes
      ),
    });
  }
);
