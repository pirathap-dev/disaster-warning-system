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
  [ReliefAllocationStatus.ALLOCATED]: [
    ReliefAllocationStatus.DISPATCHED,
    ReliefAllocationStatus.CANCELLED,
  ],
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

export async function clearShelterOccupancy(id: string) {
  const shelter = await ShelterModel.findOneAndUpdate(
    { _id: id },
    { $set: { currentOccupancy: 0 } },
    { new: true }
  );
  if (!shelter) {
    throw new ServiceError('Shelter not found', 404, 'SHELTER_NOT_FOUND');
  }
  return { ...shelter.toObject(), ...calculateCapacityMetrics(shelter) };
}

export async function createShelterRecord(input: {
  name: string;
  location: string;
  capacity: number;
  facilities: string[];
}) {
  requirePositiveInteger(input.capacity, 'Capacity');
  return ShelterModel.create({
    ...input,
    currentOccupancy: 0,
    status: ShelterStatus.OPEN,
  });
}

export async function getReliefResources() {
  return ReliefResourceModel.find().sort({ name: 1 });
}

export async function createReliefAllocation(input: {
  shelterId: string;
  resourceId: string;
  requestedQuantity: number;
  createdBy: string;
  notes?: string;
  peopleExpected?: number;
}) {
  requirePositiveInteger(input.requestedQuantity, 'Requested quantity');
  const peopleExpected = input.peopleExpected ?? 0;
  if (!Number.isInteger(peopleExpected) || peopleExpected < 0) {
    throw new ServiceError('People arriving must be a non-negative whole number', 400, 'INVALID_QUANTITY');
  }
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
  if (peopleExpected > shelter.capacity - shelter.currentOccupancy) {
    throw new ServiceError('People arriving exceed the shelter available capacity', 409, 'SHELTER_CAPACITY_EXCEEDED');
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
      peopleExpected,
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

export async function createReliefAllocations(input: {
  shelterId: string;
  items: { resourceId: string; requestedQuantity: number }[];
  createdBy: string;
  notes?: string;
  peopleExpected?: number;
}) {
  const peopleExpected = input.peopleExpected ?? 0;
  if (!Number.isInteger(peopleExpected) || peopleExpected < 0) {
    throw new ServiceError('People arriving must be a non-negative whole number', 400, 'INVALID_QUANTITY');
  }
  if (input.items.length === 0) {
    throw new ServiceError('Select at least one relief resource', 400, 'VALIDATION_ERROR');
  }
  const seenResources = new Set<string>();
  for (const item of input.items) {
    requirePositiveInteger(item.requestedQuantity, 'Requested quantity');
    if (seenResources.has(item.resourceId)) {
      throw new ServiceError('A relief resource can only be selected once', 400, 'VALIDATION_ERROR');
    }
    seenResources.add(item.resourceId);
  }

  const shelter = await ShelterModel.findById(input.shelterId);
  if (!shelter) {
    throw new ServiceError('Shelter not found', 404, 'SHELTER_NOT_FOUND');
  }
  if (shelter.status === ShelterStatus.CLOSED) {
    throw new ServiceError('Cannot allocate supplies to a closed shelter', 409, 'SHELTER_CLOSED');
  }
  if (peopleExpected > shelter.capacity - shelter.currentOccupancy) {
    throw new ServiceError('People arriving exceed the shelter available capacity', 409, 'SHELTER_CAPACITY_EXCEEDED');
  }
  for (const item of input.items) {
    if (!(await ReliefResourceModel.findById(item.resourceId))) {
      throw new ServiceError('Relief resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
  }

  const reserved: typeof input.items = [];
  const created: { _id: Types.ObjectId }[] = [];
  try {
    for (const item of input.items) {
      await reserveInventory(item.resourceId, item.requestedQuantity);
      reserved.push(item);
    }
    for (const [index, item] of input.items.entries()) {
      const allocation = await ReliefAllocationModel.create({
        shelter: input.shelterId,
        resource: item.resourceId,
        requestedQuantity: item.requestedQuantity,
        allocatedQuantity: item.requestedQuantity,
        deliveredQuantity: 0,
        peopleExpected: index === 0 ? peopleExpected : 0,
        peopleReceived: 0,
        status: ReliefAllocationStatus.ALLOCATED,
        createdBy: input.createdBy,
        notes: input.notes,
        allocatedAt: new Date(),
      });
      created.push(allocation);
    }
    return created;
  } catch (error) {
    try {
      if (created.length > 0) {
        await ReliefAllocationModel.deleteMany({ _id: { $in: created.map(({ _id }) => _id) } });
      }
      for (const item of reserved.reverse()) {
        await restoreInventory(item.resourceId, item.requestedQuantity);
      }
    } catch (rollbackError) {
      throw new ServiceError(
        `Allocation failed and inventory rollback was unsuccessful: ${rollbackError instanceof Error ? rollbackError.message : 'unknown rollback error'}`,
        500,
        'ALLOCATION_ROLLBACK_FAILED'
      );
    }
    throw error;
  }
}

export async function getReliefAllocations(filters: {
  shelterId?: string;
  resourceId?: string;
  status?: ReliefAllocationStatus;
} = {}) {
  const query: Record<string, unknown> = {};
  if (filters.shelterId) query.shelter = filters.shelterId;
  if (filters.resourceId) query.resource = filters.resourceId;
  if (filters.status) query.status = filters.status;
  return ReliefAllocationModel.find(query).sort({ createdAt: -1 });
}

export async function getReliefAllocationById(id: string) {
  const allocation = await ReliefAllocationModel.findById(id)
    .populate('shelter')
    .populate('resource');
  if (!allocation) {
    throw new ServiceError('Relief allocation not found', 404, 'ALLOCATION_NOT_FOUND');
  }
  return allocation;
}

export async function deleteCancelledReliefAllocation(id: string) {
  const allocation = await ReliefAllocationModel.findById(id);
  if (!allocation) {
    throw new ServiceError('Relief allocation not found', 404, 'ALLOCATION_NOT_FOUND');
  }
  if (allocation.status !== ReliefAllocationStatus.CANCELLED) {
    throw new ServiceError(
      'Only cancelled allocations can be deleted',
      409,
      'ALLOCATION_NOT_CANCELLED'
    );
  }

  const result = await ReliefAllocationModel.deleteOne({
    _id: id,
    status: ReliefAllocationStatus.CANCELLED,
  });
  if (result.deletedCount !== 1) {
    throw new ServiceError(
      'Allocation changed before it could be deleted',
      409,
      'ALLOCATION_CONFLICT'
    );
  }
  return { id };
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
  status: ReliefAllocationStatus
) {
  const allocation = await ReliefAllocationModel.findById(id);
  if (!allocation) {
    throw new ServiceError('Relief allocation not found', 404, 'ALLOCATION_NOT_FOUND');
  }
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
  if (status === ReliefAllocationStatus.CANCELLED &&
      allocation.status === ReliefAllocationStatus.ALLOCATED) {
    try {
      await restoreInventory(allocation.resource, allocation.requestedQuantity);
    } catch (error) {
      try {
        const restored = await ReliefAllocationModel.findOneAndUpdate(
          { _id: id, status: ReliefAllocationStatus.CANCELLED },
          {
            $set: { status: ReliefAllocationStatus.ALLOCATED },
            $unset: { cancelledAt: 1 },
          },
          { new: true, runValidators: true }
        );
        if (!restored) {
          throw new Error('Allocation status changed before cancellation rollback');
        }
      } catch (rollbackError) {
        throw new ServiceError(
          `Could not restore inventory or roll back allocation cancellation: ${rollbackError instanceof Error ? rollbackError.message : 'unknown rollback error'}`,
          500,
          'CANCELLATION_ROLLBACK_FAILED'
        );
      }
      throw error;
    }
  }
  return updated;
}

export async function confirmReliefReceipt(
  id: string,
  receivedQuantity: number,
  notes?: string,
  receivedPeople?: number
) {
  requirePositiveInteger(receivedQuantity, 'Received quantity');
  const allocation = await ReliefAllocationModel.findById(id);
  if (!allocation) {
    throw new ServiceError('Relief allocation not found', 404, 'ALLOCATION_NOT_FOUND');
  }
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
  const expectedPeople = allocation.peopleExpected ?? 0;
  const peopleToReceive = receivedPeople ?? expectedPeople;
  if (!Number.isInteger(peopleToReceive) || peopleToReceive < 0) {
    throw new ServiceError('People received must be a non-negative whole number', 400, 'INVALID_QUANTITY');
  }
  if (peopleToReceive > expectedPeople) {
    throw new ServiceError('People received cannot exceed the expected arrival count', 400, 'INVALID_PEOPLE_COUNT');
  }

  let shelterUpdated = false;
  if (peopleToReceive > 0) {
    const updatedShelter = await ShelterModel.findOneAndUpdate(
      {
        _id: allocation.shelter,
        status: ShelterStatus.OPEN,
        $expr: { $lte: [{ $add: ['$currentOccupancy', peopleToReceive] }, '$capacity'] },
      },
      { $inc: { currentOccupancy: peopleToReceive } },
      { new: true, runValidators: true }
    );
    if (!updatedShelter) {
      const currentShelter = await ShelterModel.findById(allocation.shelter);
      if (!currentShelter) {
        throw new ServiceError('Shelter not found', 404, 'SHELTER_NOT_FOUND');
      }
      if (currentShelter.status === ShelterStatus.CLOSED) {
        throw new ServiceError('Cannot receive people at a closed shelter', 409, 'SHELTER_CLOSED');
      }
      throw new ServiceError(
        `People received exceed the ${currentShelter.capacity - currentShelter.currentOccupancy} available places`,
        409,
        'SHELTER_CAPACITY_EXCEEDED'
      );
    }
    shelterUpdated = true;
  }

  const update: Record<string, unknown> = {
    status: ReliefAllocationStatus.RECEIVED,
    deliveredQuantity: receivedQuantity,
    peopleReceived: peopleToReceive,
    receivedAt: new Date(),
  };
  if (notes !== undefined) update.notes = notes;
  let updated;
  try {
    updated = await ReliefAllocationModel.findOneAndUpdate(
      { _id: id, status: ReliefAllocationStatus.DISPATCHED },
      { $set: update },
      { new: true, runValidators: true }
    );
  } catch (error) {
    if (shelterUpdated) await rollbackShelterOccupancy(allocation.shelter, peopleToReceive);
    throw error;
  }
  if (!updated) {
    if (shelterUpdated) await rollbackShelterOccupancy(allocation.shelter, peopleToReceive);
    throw new ServiceError(
      'Allocation changed before receipt could be confirmed',
      409,
      'ALLOCATION_CONFLICT'
    );
  }
  return updated;
}

async function rollbackShelterOccupancy(
  shelterId: string | Types.ObjectId,
  count: number
): Promise<void> {
  const result = await ShelterModel.updateOne(
    { _id: shelterId, currentOccupancy: { $gte: count } },
    { $inc: { currentOccupancy: -count } }
  );
  if (result.matchedCount !== 1) {
    throw new ServiceError(
      'Could not roll back shelter occupancy after receipt failure',
      500,
      'OCCUPANCY_ROLLBACK_FAILED'
    );
  }
}
