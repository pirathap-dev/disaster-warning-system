import { ReliefAllocationModel } from '../models/ReliefAllocation';
import { ReliefResourceModel } from '../models/ReliefResource';
import { ShelterModel } from '../models/Shelter';
import {
  calculateCapacityMetrics,
  confirmReliefReceipt,
  createReliefAllocation,
  getReliefAllocationById,
  getReliefAllocations,
  getReliefResources,
  getShelterById,
  getShelters,
  updateReliefAllocationStatus,
} from '../services/reliefService';
import {
  ReliefAllocationStatus,
  ShelterCapacityStatus,
  ShelterStatus,
} from '../types';

jest.mock('../models/ReliefAllocation', () => ({
  ReliefAllocationModel: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));
jest.mock('../models/ReliefResource', () => ({
  ReliefResourceModel: {
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock('../models/Shelter', () => ({
  ShelterModel: {
    find: jest.fn(),
    findById: jest.fn(),
  },
}));

const modelMocks = {
  allocation: ReliefAllocationModel as jest.Mocked<typeof ReliefAllocationModel>,
  resource: ReliefResourceModel as jest.Mocked<typeof ReliefResourceModel>,
  shelter: ShelterModel as jest.Mocked<typeof ShelterModel>,
};

function shelter(overrides: Record<string, unknown> = {}) {
  const value = {
    _id: 'shelter-1',
    name: 'Central Shelter',
    location: 'District Centre',
    capacity: 500,
    currentOccupancy: 420,
    status: ShelterStatus.OPEN,
    toObject: jest.fn(function (this: Record<string, unknown>) {
      const { toObject: _toObject, ...record } = this;
      return record;
    }),
    ...overrides,
  };
  return value;
}

function allocation(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'allocation-1',
    shelter: 'shelter-1',
    resource: 'resource-1',
    requestedQuantity: 100,
    allocatedQuantity: 100,
    deliveredQuantity: 0,
    status: ReliefAllocationStatus.ALLOCATED,
    createdBy: 'Officer',
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('shelter capacity', () => {
  it('retrieves shelters with calculated occupancy and available capacity', async () => {
    const record = shelter();
    (modelMocks.shelter.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockResolvedValue([record]),
    });

    const results = await getShelters();

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      name: 'Central Shelter',
      availableCapacity: 80,
      occupancyPercentage: 84,
      capacityStatus: ShelterCapacityStatus.OPEN,
    });
  });

  it('calculates occupancy percent and available capacity without storing a duplicate', () => {
    expect(calculateCapacityMetrics(shelter())).toEqual({
      availableCapacity: 80,
      occupancyPercentage: 84,
      capacityStatus: ShelterCapacityStatus.OPEN,
    });
  });

  it('marks a shelter near-full at 90 percent occupancy', () => {
    expect(calculateCapacityMetrics(shelter({ currentOccupancy: 450 })).capacityStatus)
      .toBe(ShelterCapacityStatus.NEAR_FULL);
  });

  it('marks a shelter full at capacity and closed shelters as closed', () => {
    expect(calculateCapacityMetrics(shelter({ currentOccupancy: 500 })).capacityStatus)
      .toBe(ShelterCapacityStatus.FULL);
    expect(calculateCapacityMetrics(shelter({
      currentOccupancy: 500,
      status: ShelterStatus.CLOSED,
    })).capacityStatus).toBe(ShelterCapacityStatus.CLOSED);
  });

  it('returns a shelter by id and reports missing records', async () => {
    (modelMocks.shelter.findById as jest.Mock)
      .mockResolvedValueOnce(shelter())
      .mockResolvedValueOnce(null);
    await expect(getShelterById('shelter-1')).resolves.toMatchObject({
      availableCapacity: 80,
    });
    await expect(getShelterById('missing')).rejects.toMatchObject({
      statusCode: 404,
      code: 'SHELTER_NOT_FOUND',
    });
  });
});

describe('relief inventory allocations', () => {
  const input = {
    shelterId: 'shelter-1',
    resourceId: 'resource-1',
    requestedQuantity: 300,
    createdBy: 'District Officer',
  };

  beforeEach(() => {
    (modelMocks.shelter.findById as jest.Mock).mockResolvedValue(shelter());
    (modelMocks.resource.findById as jest.Mock).mockResolvedValue({
      availableQuantity: 1000,
      unit: 'litres',
    });
    (modelMocks.resource.findOneAndUpdate as jest.Mock).mockResolvedValue({
      availableQuantity: 700,
    });
    (modelMocks.allocation.create as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.ALLOCATED })
    );
    (modelMocks.resource.updateOne as jest.Mock).mockResolvedValue({ matchedCount: 1 });
  });

  it('creates a valid allocation and atomically decrements stock', async () => {
    const result = await createReliefAllocation(input);

    expect(result.status).toBe(ReliefAllocationStatus.ALLOCATED);
    expect(modelMocks.resource.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'resource-1', availableQuantity: { $gte: 300 } },
      { $inc: { availableQuantity: -300 } },
      { new: true, runValidators: true }
    );
    expect(modelMocks.allocation.create).toHaveBeenCalledWith(expect.objectContaining({
      requestedQuantity: 300,
      allocatedQuantity: 300,
      deliveredQuantity: 0,
      status: ReliefAllocationStatus.ALLOCATED,
    }));
  });

  it.each([0, -1, 1.5])('rejects invalid allocation quantity %s', async (quantity) => {
    await expect(createReliefAllocation({
      ...input,
      requestedQuantity: quantity,
    })).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_QUANTITY' });
    expect(modelMocks.resource.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects insufficient inventory without allowing stock to become negative', async () => {
    (modelMocks.resource.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
    (modelMocks.resource.findById as jest.Mock).mockResolvedValue({
      availableQuantity: 1000,
      unit: 'litres',
    });

    await expect(createReliefAllocation({
      ...input,
      requestedQuantity: 1200,
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'INSUFFICIENT_INVENTORY',
    });
    expect(modelMocks.resource.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ availableQuantity: { $gte: 1200 } }),
      expect.anything(),
      expect.anything()
    );
    expect(modelMocks.allocation.create).not.toHaveBeenCalled();
  });

  it('restores reserved inventory if allocation persistence fails', async () => {
    (modelMocks.allocation.create as jest.Mock).mockRejectedValue(new Error('database write failed'));
    await expect(createReliefAllocation(input)).rejects.toThrow('database write failed');
    expect(modelMocks.resource.updateOne).toHaveBeenCalledWith(
      { _id: 'resource-1' },
      { $inc: { availableQuantity: 300 } }
    );
  });

  it('rejects allocations to closed shelters before reserving stock', async () => {
    (modelMocks.shelter.findById as jest.Mock).mockResolvedValue(
      shelter({ status: ShelterStatus.CLOSED })
    );
    await expect(createReliefAllocation(input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'SHELTER_CLOSED',
    });
    expect(modelMocks.resource.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('reports database errors instead of silently returning empty inventory', async () => {
    (modelMocks.shelter.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockRejectedValue(new Error('database unavailable')),
    });
    await expect(getShelters()).rejects.toThrow('database unavailable');
  });

  it('reports missing shelters, resources, and deleted inventory during allocation', async () => {
    (modelMocks.shelter.findById as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(shelter());
    (modelMocks.resource.findById as jest.Mock).mockResolvedValue(null);
    await expect(createReliefAllocation(input)).rejects.toMatchObject({
      code: 'SHELTER_NOT_FOUND',
    });
    await expect(createReliefAllocation(input)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });

    (modelMocks.shelter.findById as jest.Mock).mockResolvedValue(shelter());
    (modelMocks.resource.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
    (modelMocks.resource.findById as jest.Mock).mockResolvedValue(null);
    await expect(createReliefAllocation(input)).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
    expect(modelMocks.allocation.create).not.toHaveBeenCalled();
  });

  it('reports inventory restoration failures instead of hiding a partial write', async () => {
    (modelMocks.allocation.create as jest.Mock).mockRejectedValue(new Error('allocation write failed'));
    (modelMocks.resource.updateOne as jest.Mock).mockResolvedValue({ matchedCount: 0 });
    await expect(createReliefAllocation(input)).rejects.toMatchObject({
      code: 'INVENTORY_RESTORE_FAILED',
      statusCode: 500,
    });
  });
});

describe('allocation lifecycle and receipt', () => {
  it('allows a valid status transition and records its timestamp', async () => {
    (modelMocks.allocation.findById as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.ALLOCATED })
    );
    (modelMocks.allocation.findOneAndUpdate as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.DISPATCHED })
    );

    await expect(updateReliefAllocationStatus('allocation-1', ReliefAllocationStatus.DISPATCHED))
      .resolves.toMatchObject({ status: ReliefAllocationStatus.DISPATCHED });
    expect(modelMocks.allocation.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'allocation-1', status: ReliefAllocationStatus.ALLOCATED },
      { $set: expect.objectContaining({ status: ReliefAllocationStatus.DISPATCHED, dispatchedAt: expect.any(Date) }) },
      { new: true, runValidators: true }
    );
  });

  it('rejects invalid status transitions', async () => {
    (modelMocks.allocation.findById as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.ALLOCATED })
    );
    await expect(updateReliefAllocationStatus('allocation-1', ReliefAllocationStatus.COMPLETED))
      .rejects.toMatchObject({ statusCode: 409, code: 'INVALID_STATUS_TRANSITION' });
    expect(modelMocks.allocation.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('reserves stock when a requested allocation is approved', async () => {
    (modelMocks.allocation.findById as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.REQUESTED })
    );
    (modelMocks.resource.findOneAndUpdate as jest.Mock).mockResolvedValue({});
    (modelMocks.allocation.findOneAndUpdate as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.ALLOCATED })
    );

    await expect(updateReliefAllocationStatus('allocation-1', ReliefAllocationStatus.ALLOCATED))
      .resolves.toMatchObject({ status: ReliefAllocationStatus.ALLOCATED });
    expect(modelMocks.resource.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'resource-1', availableQuantity: { $gte: 100 } },
      { $inc: { availableQuantity: -100 } },
      { new: true, runValidators: true }
    );
  });

  it('cancels an unallocated request but requires the receipt endpoint to mark received', async () => {
    (modelMocks.allocation.findById as jest.Mock)
      .mockResolvedValueOnce(allocation({ status: ReliefAllocationStatus.REQUESTED }))
      .mockResolvedValueOnce(allocation({ status: ReliefAllocationStatus.DISPATCHED }));
    (modelMocks.allocation.findOneAndUpdate as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.CANCELLED })
    );

    await updateReliefAllocationStatus('allocation-1', ReliefAllocationStatus.CANCELLED);
    expect(modelMocks.allocation.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'allocation-1', status: ReliefAllocationStatus.REQUESTED },
      { $set: expect.objectContaining({
        status: ReliefAllocationStatus.CANCELLED,
        cancelledAt: expect.any(Date),
      }) },
      { new: true, runValidators: true }
    );
    await expect(updateReliefAllocationStatus(
      'allocation-1',
      ReliefAllocationStatus.RECEIVED
    )).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
  });

  it('reports missing allocations during status updates and receipt confirmation', async () => {
    (modelMocks.allocation.findById as jest.Mock).mockResolvedValue(null);
    await expect(updateReliefAllocationStatus(
      'missing',
      ReliefAllocationStatus.DISPATCHED
    )).rejects.toMatchObject({ code: 'ALLOCATION_NOT_FOUND' });
    await expect(confirmReliefReceipt('missing', 1))
      .rejects.toMatchObject({ code: 'ALLOCATION_NOT_FOUND' });
  });

  it('restores inventory if a concurrent status update defeats allocation', async () => {
    (modelMocks.allocation.findById as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.REQUESTED })
    );
    (modelMocks.resource.findOneAndUpdate as jest.Mock).mockResolvedValue({});
    (modelMocks.allocation.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
    (modelMocks.resource.updateOne as jest.Mock).mockResolvedValue({ matchedCount: 1 });

    await expect(updateReliefAllocationStatus('allocation-1', ReliefAllocationStatus.ALLOCATED))
      .rejects.toMatchObject({ statusCode: 409, code: 'ALLOCATION_CONFLICT' });
    expect(modelMocks.resource.updateOne).toHaveBeenCalledWith(
      { _id: 'resource-1' },
      { $inc: { availableQuantity: 100 } }
    );
  });

  it('confirms a dispatched receipt and records the received amount', async () => {
    (modelMocks.allocation.findById as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.DISPATCHED })
    );
    (modelMocks.allocation.findOneAndUpdate as jest.Mock).mockResolvedValue(
      allocation({
        status: ReliefAllocationStatus.RECEIVED,
        deliveredQuantity: 80,
      })
    );
    (modelMocks.resource.updateOne as jest.Mock).mockResolvedValue({ matchedCount: 1 });

    await expect(confirmReliefReceipt('allocation-1', 80, 'Two boxes damaged'))
      .resolves.toMatchObject({
        status: ReliefAllocationStatus.RECEIVED,
        deliveredQuantity: 80,
      });
    expect(modelMocks.allocation.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'allocation-1', status: ReliefAllocationStatus.DISPATCHED },
      { $set: expect.objectContaining({
        status: ReliefAllocationStatus.RECEIVED,
        deliveredQuantity: 80,
        receivedAt: expect.any(Date),
        notes: 'Two boxes damaged',
      }) },
      { new: true, runValidators: true }
    );
    expect(modelMocks.resource.updateOne).toHaveBeenCalledWith(
      { _id: 'resource-1' },
      { $inc: { availableQuantity: 20 } }
    );
  });

  it('rejects receipt quantities over allocation and receipt before dispatch', async () => {
    (modelMocks.allocation.findById as jest.Mock)
      .mockResolvedValueOnce(allocation({ status: ReliefAllocationStatus.DISPATCHED }))
      .mockResolvedValueOnce(allocation({ status: ReliefAllocationStatus.ALLOCATED }));
    await expect(confirmReliefReceipt('allocation-1', 101))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_RECEIVED_QUANTITY' });
    await expect(confirmReliefReceipt('allocation-1', 80))
      .rejects.toMatchObject({ statusCode: 409, code: 'INVALID_STATUS_TRANSITION' });
    expect(modelMocks.allocation.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects zero and fractional receipt quantities', async () => {
    await expect(confirmReliefReceipt('allocation-1', 0))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_QUANTITY' });
    await expect(confirmReliefReceipt('allocation-1', 1.25))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_QUANTITY' });
    expect(modelMocks.allocation.findById).not.toHaveBeenCalled();
  });

  it('rejects a status update if another request already changed the allocation', async () => {
    (modelMocks.allocation.findById as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.ALLOCATED })
    );
    (modelMocks.allocation.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
    await expect(updateReliefAllocationStatus('allocation-1', ReliefAllocationStatus.DISPATCHED))
      .rejects.toMatchObject({ statusCode: 409, code: 'ALLOCATION_CONFLICT' });
  });

  it('restores reserved stock if a database error prevents allocation approval', async () => {
    (modelMocks.allocation.findById as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.REQUESTED })
    );
    (modelMocks.resource.findOneAndUpdate as jest.Mock).mockResolvedValue({});
    (modelMocks.allocation.findOneAndUpdate as jest.Mock).mockRejectedValue(
      new Error('database write failed')
    );
    (modelMocks.resource.updateOne as jest.Mock).mockResolvedValue({ matchedCount: 1 });

    await expect(updateReliefAllocationStatus(
      'allocation-1',
      ReliefAllocationStatus.ALLOCATED
    )).rejects.toThrow('database write failed');
    expect(modelMocks.resource.updateOne).toHaveBeenCalledWith(
      { _id: 'resource-1' },
      { $inc: { availableQuantity: 100 } }
    );
  });

  it('reports a receipt race if dispatch status changed concurrently', async () => {
    (modelMocks.allocation.findById as jest.Mock).mockResolvedValue(
      allocation({ status: ReliefAllocationStatus.DISPATCHED })
    );
    (modelMocks.allocation.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
    await expect(confirmReliefReceipt('allocation-1', 80))
      .rejects.toMatchObject({ statusCode: 409, code: 'ALLOCATION_CONFLICT' });
  });

  it('retrieves sorted resource and allocation records with optional filters', async () => {
    (modelMocks.resource.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockResolvedValue([{ name: 'Water' }]),
    });
    (modelMocks.allocation.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockResolvedValue([allocation()]),
    });

    await expect(getReliefResources()).resolves.toEqual([{ name: 'Water' }]);
    await expect(getReliefAllocations({
      shelterId: 'shelter-1',
      resourceId: 'resource-1',
      status: ReliefAllocationStatus.DISPATCHED,
    })).resolves.toEqual([allocation()]);
    expect(modelMocks.allocation.find).toHaveBeenCalledWith({
      shelter: 'shelter-1',
      resource: 'resource-1',
      status: ReliefAllocationStatus.DISPATCHED,
    });
    await getReliefAllocations();
    expect(modelMocks.allocation.find).toHaveBeenLastCalledWith({});
  });

  it('populates allocation details and reports an unknown allocation', async () => {
    const query = {
      populate: jest.fn().mockReturnThis(),
    };
    query.populate
      .mockReturnValueOnce(query)
      .mockResolvedValueOnce(allocation());
    (modelMocks.allocation.findById as jest.Mock).mockReturnValueOnce(query);

    await expect(getReliefAllocationById('allocation-1')).resolves.toMatchObject({
      _id: 'allocation-1',
    });
    expect(query.populate).toHaveBeenNthCalledWith(1, 'shelter');
    expect(query.populate).toHaveBeenNthCalledWith(2, 'resource');

    const missingQuery = {
      populate: jest.fn().mockReturnThis(),
    };
    missingQuery.populate
      .mockReturnValueOnce(missingQuery)
      .mockResolvedValueOnce(null);
    (modelMocks.allocation.findById as jest.Mock).mockReturnValueOnce(missingQuery);
    await expect(getReliefAllocationById('missing'))
      .rejects.toMatchObject({ code: 'ALLOCATION_NOT_FOUND' });
  });
});
