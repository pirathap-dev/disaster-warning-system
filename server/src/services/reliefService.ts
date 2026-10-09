import { Types } from 'mongoose';
import { ReliefAllocationModel } from '../models/ReliefAllocation';
import { ReliefResourceModel } from '../models/ReliefResource';
import { IShelter, ShelterModel } from '../models/Shelter';
import {
  ReliefAllocationStatus,
  ShelterCapacityStatus,
  ShelterStatus,
} from '../types';
import { ServiceError } from './serviceError';

const validTransitions: Partial<
  Record<ReliefAllocationStatus, ReliefAllocationStatus[]>
> = {
  [ReliefAllocationStatus.REQUESTED]: [
    ReliefAllocationStatus.ALLOCATED,
    ReliefAllocationStatus.CANCELLED,
  ],
  [ReliefAllocationStatus.ALLOCATED]: [ReliefAllocationStatus.DISPATCHED],
  [ReliefAllocationStatus.RECEIVED]: [ReliefAllocationStatus.COMPLETED],
};

export interface CapacityMetrics {
  availableCapacity: number;
  occupancyPercentage: number;
  capacityStatus: ShelterCapacityStatus;
}

export function calculateCapacityMetrics(
  shelter: Pick<IShelter, 'capacity' | 'currentOccupancy' | 'status'>
): CapacityMetrics {
  const occupancyPercentage = Math.round(
    (shelter.currentOccupancy / shelter.capacity) * 100
  );
  let capacityStatus = ShelterCapacityStatus.OPEN;

  if (shelter.status === ShelterStatus.CLOSED) {
    capacityStatus = ShelterCapacityStatus.CLOSED;
  } else if (shelter.currentOccupancy >= shelter.capacity) {
    capacityStatus = ShelterCapacityStatus.FULL;
  } else if (occupancyPercentage >= 90) {
    capacityStatus = ShelterCapacityStatus.NEAR_FULL;
  }

  return {
    availableCapacity: shelter.capacity - shelter.currentOccupancy,
    occupancyPercentage,
    capacityStatus,
  };
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ServiceError(`${field} must be a positive whole number`, 400, 'INVALID_QUANTITY');
  }
}

async function reserveInventory(
  resourceId: string | Types.ObjectId,
  quantity: number
): Promise<void> {
  const resource = await ReliefResourceModel.findOneAndUpdate(
    { _id: resourceId, availableQuantity: { $gte: quantity } },
    { $inc: { availableQuantity: -quantity } },
    { new: true, runValidators: true }
  );

  if (resource) return;

  const currentResource = await ReliefResourceModel.findById(resourceId);
  if (!currentResource) {
    throw new ServiceError('Relief resource not found', 404, 'RESOURCE_NOT_FOUND');
  }
  throw new ServiceError(
    `Insufficient inventory: ${currentResource.availableQuantity} ${currentResource.unit} available`,
    409,
    'INSUFFICIENT_INVENTORY'
  );
}

async function restoreInventory(
  resourceId: string | Types.ObjectId,
  quantity: number
): Promise<void> {
  const result = await ReliefResourceModel.updateOne(
    { _id: resourceId },
    { $inc: { availableQuantity: quantity } }
  );
  if (result.matchedCount !== 1) {
    throw new ServiceError(
      'Could not restore resource inventory after allocation failure',
      500,
      'INVENTORY_RESTORE_FAILED'
    );
  }
}

export async function getShelters() {
  const shelters = await ShelterModel.find().sort({ name: 1 });
  return shelters.map((shelter) => ({
    ...shelter.toObject(),
    ...calculateCapacityMetrics(shelter),
  }));
}

export async function getShelterById(id: string) {
  const shelter = await ShelterModel.findById(id);
  if (!shelter) {
    throw new ServiceError('Shelter not found', 404, 'SHELTER_NOT_FOUND');
  }
  return { ...shelter.toObject(), ...calculateCapacityMetrics(shelter) };
}

export async function updateShelterOccupancy(id: string, ownerUserId: string, occupancy: number) {
  if (!Number.isInteger(occupancy) || occupancy < 0) {
    throw new ServiceError('Occupancy must be a non-negative whole number', 400, 'INVALID_OCCUPANCY');
  }
  const shelter = await ShelterModel.findById(id);
  if (!shelter) throw new ServiceError('Shelter not found', 404, 'SHELTER_NOT_FOUND');
  if (shelter.coordinatorUserId !== ownerUserId) {
    throw new ServiceError('You can only update your assigned shelter', 403, 'FORBIDDEN');
  }
  if (occupancy > shelter.capacity) {
    throw new ServiceError('Occupancy cannot exceed shelter capacity', 400, 'CAPACITY_EXCEEDED');
  }
  shelter.currentOccupancy = occupancy;
  await shelter.save();
  return { ...shelter.toObject(), ...calculateCapacityMetrics(shelter) };
}

export async function getReliefResources(ownerUserId?: string) {
  return ReliefResourceModel.find(ownerUserId ? { ownerUserId } : {}).sort({ name: 1 });
}

export async function createReliefResource(input: {
  ownerUserId: string;
  name: string;
  category: string;
  availableQuantity: number;
  unit: string;
  source?: string;
}) {
  if (!Number.isInteger(input.availableQuantity) || input.availableQuantity < 0) {
    throw new ServiceError('Available quantity must be a non-negative whole number', 400, 'INVALID_QUANTITY');
  }
  return ReliefResourceModel.create(input);
}

export async function updateReliefResource(
  id: string,
  ownerUserId: string,
  updates: Partial<Pick<{
    name: string;
    category: string;
    availableQuantity: number;
    unit: string;
    source?: string;
  }, 'name' | 'category' | 'availableQuantity' | 'unit' | 'source'>>
) {
  if (updates.availableQuantity !== undefined &&
      (!Number.isInteger(updates.availableQuantity) || updates.availableQuantity < 0)) {
    throw new ServiceError('Available quantity must be a non-negative whole number', 400, 'INVALID_QUANTITY');
  }
  const resource = await ReliefResourceModel.findOneAndUpdate(
    { _id: id, ownerUserId },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (resource) return resource;
  const exists = await ReliefResourceModel.exists({ _id: id });
  if (exists) throw new ServiceError('You can only manage your own stock', 403, 'FORBIDDEN');
  throw new ServiceError('Relief resource not found', 404, 'RESOURCE_NOT_FOUND');
}

export async function createReliefAllocation(input: {
  shelterId: string;
  resourceId: string;
  requestedQuantity: number;
  createdBy: string;
  notes?: string;
}) {
  requirePositiveInteger(input.requestedQuantity, 'Requested quantity');
  const [shelter, resource] = await Promise.all([
    ShelterModel.findById(input.shelterId),
    ReliefResourceModel.findById(input.resourceId),
  ]);

  if (!shelter) {
    throw new ServiceError('Shelter not found', 404, 'SHELTER_NOT_FOUND');
  }
  if (shelter.status === ShelterStatus.CLOSED) {
    throw new ServiceError('Cannot allocate supplies to a closed shelter', 409, 'SHELTER_CLOSED');
  }
  if (!resource) {
    throw new ServiceError('Relief resource not found', 404, 'RESOURCE_NOT_FOUND');
  }

  await reserveInventory(input.resourceId, input.requestedQuantity);
  try {
    return await ReliefAllocationModel.create({
      shelter: input.shelterId,
      resource: input.resourceId,
      requestedQuantity: input.requestedQuantity,
      allocatedQuantity: input.requestedQuantity,
      deliveredQuantity: 0,
      status: ReliefAllocationStatus.ALLOCATED,
      createdBy: input.createdBy,
      notes: input.notes,
      allocatedAt: new Date(),
    });
  } catch (error) {
    await restoreInventory(input.resourceId, input.requestedQuantity);
    throw error;
  }
}

export async function getReliefAllocations(filters: {
  shelterId?: string;
  resourceId?: string;
  status?: ReliefAllocationStatus;
  shelterCoordinatorUserId?: string;
} = {}) {
  const query: Record<string, unknown> = {};
  if (filters.shelterId) query.shelter = filters.shelterId;
  if (filters.resourceId) query.resource = filters.resourceId;
  if (filters.status) query.status = filters.status;
  if (filters.shelterCoordinatorUserId) {
    const shelters = await ShelterModel.find({ coordinatorUserId: filters.shelterCoordinatorUserId });
    query.shelter = { $in: shelters.map((shelter) => shelter._id) };
  }
  return ReliefAllocationModel.find(query).sort({ createdAt: -1 });
}

async function assertShelterCoordinator(allocation: { shelter: Types.ObjectId }, ownerUserId?: string) {
  if (!ownerUserId) return;
  const shelter = await ShelterModel.findById(allocation.shelter);
  if (!shelter || shelter.coordinatorUserId !== ownerUserId) {
    throw new ServiceError('You can only manage allocations for your assigned shelter', 403, 'FORBIDDEN');
  }
}

export async function getReliefAllocationById(id: string, ownerUserId?: string) {
  const allocation = await ReliefAllocationModel.findById(id)
    .populate('shelter')
    .populate('resource');
  if (!allocation) {
    throw new ServiceError('Relief allocation not found', 404, 'ALLOCATION_NOT_FOUND');
  }
  if (ownerUserId) {
    const shelter = allocation.shelter as unknown as { coordinatorUserId?: string };
    if (shelter.coordinatorUserId !== ownerUserId) {
      throw new ServiceError('You can only view allocations for your assigned shelter', 403, 'FORBIDDEN');
    }
  }
  return allocation;
}

function timestampFor(status: ReliefAllocationStatus): string | undefined {
  switch (status) {
    case ReliefAllocationStatus.ALLOCATED:
      return 'allocatedAt';
    case ReliefAllocationStatus.DISPATCHED:
      return 'dispatchedAt';
    case ReliefAllocationStatus.COMPLETED:
      return 'completedAt';
    case ReliefAllocationStatus.CANCELLED:
      return 'cancelledAt';
    default:
      return undefined;
  }
}

export async function updateReliefAllocationStatus(
  id: string,
  status: ReliefAllocationStatus,
  ownerUserId?: string
) {
  const allocation = await ReliefAllocationModel.findById(id);
  if (!allocation) {
    throw new ServiceError('Relief allocation not found', 404, 'ALLOCATION_NOT_FOUND');
  }
  await assertShelterCoordinator(allocation, ownerUserId);
  if (!validTransitions[allocation.status]?.includes(status)) {
    throw new ServiceError(
      `Cannot transition allocation from ${allocation.status} to ${status}`,
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  if (status === ReliefAllocationStatus.ALLOCATED) {
    await reserveInventory(allocation.resource, allocation.requestedQuantity);
  }

  const timestampField = timestampFor(status);
  const update: Record<string, unknown> = { status };
  if (timestampField) update[timestampField] = new Date();
  let updated;
  try {
    updated = await ReliefAllocationModel.findOneAndUpdate(
      { _id: id, status: allocation.status },
      { $set: update },
      { new: true, runValidators: true }
    );
  } catch (error) {
    if (status === ReliefAllocationStatus.ALLOCATED) {
      await restoreInventory(allocation.resource, allocation.requestedQuantity);
    }
    throw error;
  }

  if (!updated) {
    if (status === ReliefAllocationStatus.ALLOCATED) {
      await restoreInventory(allocation.resource, allocation.requestedQuantity);
    }
    throw new ServiceError(
      'Allocation changed before this update could be applied',
      409,
      'ALLOCATION_CONFLICT'
    );
  }
  return updated;
}

export async function confirmReliefReceipt(
  id: string,
  receivedQuantity: number,
  notes?: string,
  ownerUserId?: string
) {
  requirePositiveInteger(receivedQuantity, 'Received quantity');
  const allocation = await ReliefAllocationModel.findById(id);
  if (!allocation) {
    throw new ServiceError('Relief allocation not found', 404, 'ALLOCATION_NOT_FOUND');
  }
  await assertShelterCoordinator(allocation, ownerUserId);
  if (allocation.status !== ReliefAllocationStatus.DISPATCHED) {
    throw new ServiceError(
      'Receipt can only be confirmed for a dispatched allocation',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }
  if (receivedQuantity > allocation.allocatedQuantity) {
    throw new ServiceError(
      'Received quantity cannot exceed the allocated quantity',
      400,
      'INVALID_RECEIVED_QUANTITY'
    );
  }

  const update: Record<string, unknown> = {
    status: ReliefAllocationStatus.RECEIVED,
    deliveredQuantity: receivedQuantity,
    receivedAt: new Date(),
  };
  if (notes !== undefined) update.notes = notes;
  const updated = await ReliefAllocationModel.findOneAndUpdate(
    { _id: id, status: ReliefAllocationStatus.DISPATCHED },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!updated) {
    throw new ServiceError(
      'Allocation changed before receipt could be confirmed',
      409,
      'ALLOCATION_CONFLICT'
    );
  }
  const undeliveredQuantity = allocation.allocatedQuantity - receivedQuantity;
  if (undeliveredQuantity > 0) {
    await restoreInventory(allocation.resource, undeliveredQuantity);
  }
  return updated;
}
