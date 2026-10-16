import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShelterRelief from '../pages/ShelterRelief';

const { api, toast } = vi.hoisted(() => ({
  api: {
    getShelters: vi.fn(),
    clearShelterOccupancy: vi.fn(),
    createShelter: vi.fn(),
    getResources: vi.fn(),
    getAllocations: vi.fn(),
    createAllocation: vi.fn(),
    updateStatus: vi.fn(),
    deleteAllocation: vi.fn(),
    confirmReceipt: vi.fn(),
  },
  toast: vi.fn(),
}));

vi.mock('../types/relief', () => ({ reliefApi: api }));
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({ toast }),
}));

const shelter = {
  _id: 'shelter-1',
  name: 'Central Shelter',
  location: 'District Centre',
  facilities: ['Drinking water'],
  capacity: 500,
  currentOccupancy: 450,
  availableCapacity: 50,
  occupancyPercentage: 90,
  capacityStatus: 'NEAR_FULL',
  status: 'OPEN',
};

const resource = {
  _id: 'resource-1',
  name: 'Drinking Water',
  category: 'Water',
  availableQuantity: 100,
  unit: 'litres',
  source: 'District Store',
};

const allocation = {
  _id: 'allocation-1',
  shelter: 'shelter-1',
  resource: 'resource-1',
  requestedQuantity: 40,
  allocatedQuantity: 40,
  deliveredQuantity: 0,
  status: 'ALLOCATED',
  createdBy: 'District Officer',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getShelters.mockResolvedValue([shelter]);
  api.clearShelterOccupancy.mockResolvedValue({
    ...shelter,
    currentOccupancy: 0,
    availableCapacity: 500,
    occupancyPercentage: 0,
    capacityStatus: 'OPEN',
  });
  api.createShelter.mockResolvedValue(shelter);
  api.getResources.mockResolvedValue([resource]);
  api.getAllocations.mockResolvedValue([allocation]);
  api.createAllocation.mockResolvedValue(allocation);
  api.updateStatus.mockResolvedValue(allocation);
  api.deleteAllocation.mockResolvedValue({ id: allocation._id });
  api.confirmReceipt.mockResolvedValue({ ...allocation, status: 'RECEIVED' });
});

describe('Shelter & Relief workspace', () => {
  it('shows shelter occupancy, near-full warnings, inventory, and active allocation conflicts', async () => {
    render(<ShelterRelief />);

    expect(await screen.findByRole('heading', { name: 'Central Shelter' })).toBeInTheDocument();
    expect(screen.getByText('Near Full')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Shelter'), { target: { value: 'shelter-1' } });
    fireEvent.change(screen.getByLabelText('Expected people arriving'), { target: { value: '50' } });
    fireEvent.click(screen.getByLabelText('Select Drinking Water'));
    expect(screen.getByText(/This shelter is near capacity/)).toBeInTheDocument();
    expect(screen.getByText(/active allocation.*already exist/i)).toBeInTheDocument();
    expect(screen.getByLabelText('90% occupied')).toBeInTheDocument();
  });

  it('lets the admin empty a shelter after confirmation and keeps shelter records', async () => {
    const clearedShelter = {
      ...shelter,
      currentOccupancy: 0,
      availableCapacity: 500,
      occupancyPercentage: 0,
      capacityStatus: 'OPEN',
    };
    vi.stubGlobal('confirm', vi.fn(() => true));
    api.getShelters
      .mockResolvedValueOnce([shelter])
      .mockResolvedValue([clearedShelter]);
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    expect(screen.queryByRole('button', { name: 'Empty shelter' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Admin' }));
    expect(screen.getByText(/Admin access is not protected by sign-in yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Empty shelter' }));

    await waitFor(() => expect(api.clearShelterOccupancy).toHaveBeenCalledWith('shelter-1'));
    expect(window.confirm).toHaveBeenCalledWith(
      'Empty Central Shelter by changing its recorded occupancy from 450 to 0? Shelter and relief-allocation records will be kept.'
    );
    expect(await screen.findByText('0 of 500 people recorded')).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(
      'Occupancy cleared for Central Shelter. Shelter and relief-allocation records were kept.',
      'success'
    );
    vi.unstubAllGlobals();
  });

  it('creates allocations for multiple selected resources with their quantities', async () => {
    const food = { ...resource, _id: 'resource-2', name: 'Food parcels', category: 'Food', unit: 'packs' };
    api.getResources.mockResolvedValue([resource, food]);
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    fireEvent.change(screen.getByLabelText('Shelter'), { target: { value: 'shelter-1' } });
    fireEvent.change(screen.getByLabelText('Expected people arriving'), { target: { value: '50' } });
    fireEvent.click(screen.getByLabelText('Select Drinking Water'));
    fireEvent.change(screen.getByLabelText('Quantity for Drinking Water'), { target: { value: '25' } });
    fireEvent.click(screen.getByLabelText('Select Food parcels'));
    fireEvent.change(screen.getByLabelText('Quantity for Food parcels'), { target: { value: '8' } });
    expect(screen.getByLabelText('90% occupied')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Officer name'), { target: { value: 'Officer A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create allocation' }));

    await waitFor(() => expect(api.createAllocation).toHaveBeenCalledWith({
      shelterId: 'shelter-1',
      items: [
        { resourceId: 'resource-1', requestedQuantity: 25 },
        { resourceId: 'resource-2', requestedQuantity: 8 },
      ],
      createdBy: 'Officer A',
      notes: undefined,
      peopleExpected: 50,
    }));
    expect(toast).toHaveBeenCalledWith('Allocation created and inventory reserved.', 'success');
  });

  it('prevents requests that exceed available inventory', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    fireEvent.change(screen.getByLabelText('Shelter'), { target: { value: 'shelter-1' } });
    fireEvent.click(screen.getByLabelText('Select Drinking Water'));
    fireEvent.change(screen.getByLabelText('Quantity for Drinking Water'), { target: { value: '101' } });

    expect(screen.getByText(/Only 100 litres are available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create allocation' })).toBeDisabled();
    expect(api.createAllocation).not.toHaveBeenCalled();
  });

  it('makes selecting and adjusting a resource amount straightforward', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });
    fireEvent.click(screen.getByLabelText('Select Drinking Water'));
    expect(screen.getByLabelText('Quantity for Drinking Water')).toHaveValue(1);
    fireEvent.click(screen.getByLabelText('Increase Drinking Water quantity'));
    expect(screen.getByLabelText('Quantity for Drinking Water')).toHaveValue(2);
    fireEvent.click(screen.getByLabelText('Decrease Drinking Water quantity'));
    expect(screen.getByLabelText('Quantity for Drinking Water')).toHaveValue(1);
    fireEvent.click(screen.getByLabelText('Remove Drinking Water from allocation'));
    expect(screen.queryByLabelText('Quantity for Drinking Water')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Select Drinking Water')).not.toBeChecked();
  });

  it('prevents an allocation from including more people than shelter capacity allows', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });
    fireEvent.change(screen.getByLabelText('Shelter'), { target: { value: 'shelter-1' } });
    fireEvent.change(screen.getByLabelText('Expected people arriving'), { target: { value: '51' } });
    expect(screen.getByText('Only 50 places are available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create allocation' })).toBeDisabled();
  });

  it('lets a DMC officer register a shelter and its facilities', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });
    fireEvent.click(screen.getByRole('tab', { name: 'DMC Officer' }));
    fireEvent.change(screen.getByLabelText('Shelter name'), { target: { value: 'North Shelter' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'North District' } });
    fireEvent.change(screen.getByLabelText('Maximum capacity'), { target: { value: '200' } });
    fireEvent.click(screen.getByLabelText('Medical care'));
    fireEvent.click(screen.getByRole('button', { name: 'Add shelter' }));
    await waitFor(() => expect(api.createShelter).toHaveBeenCalledWith({
      name: 'North Shelter',
      location: 'North District',
      capacity: 200,
      facilities: ['Medical care'],
    }));
  });

  it('lets the officer dispatch an allocation and view allocation details', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(await screen.findByText('District Officer', { selector: 'dd' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.click(screen.getByRole('button', { name: /Dispatch/ }));

    await waitFor(() => expect(api.updateStatus).toHaveBeenCalledWith('allocation-1', 'DISPATCHED'));
  });

  it('lets the officer remove an allocated resource from allocation tracking', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    fireEvent.click(screen.getByRole('button', {
      name: 'Remove allocation for Central Shelter - Drinking Water',
    }));

    await waitFor(() => expect(api.updateStatus).toHaveBeenCalledWith('allocation-1', 'CANCELLED'));
    expect(toast).toHaveBeenCalledWith(
      'Allocation removed and reserved inventory restored.',
      'success'
    );
  });

  it('lets the officer permanently delete a cancelled allocation after confirmation', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    api.getAllocations.mockResolvedValue([
      { ...allocation, status: 'CANCELLED' },
    ]);
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    fireEvent.click(screen.getByRole('button', {
      name: 'Delete cancelled allocation for Central Shelter - Drinking Water',
    }));

    await waitFor(() => expect(api.deleteAllocation).toHaveBeenCalledWith('allocation-1'));
    expect(window.confirm).toHaveBeenCalledWith(
      'Permanently delete the cancelled allocation for Drinking Water for Central Shelter?'
    );
    expect(toast).toHaveBeenCalledWith('Cancelled allocation permanently deleted.', 'success');
    vi.unstubAllGlobals();
  });

  it('updates occupancy and percentage after the coordinator confirms 100 arrivals', async () => {
    const emptyShelter = {
      ...shelter,
      currentOccupancy: 0,
      availableCapacity: 500,
      occupancyPercentage: 0,
      capacityStatus: 'OPEN',
    };
    api.getShelters
      .mockResolvedValueOnce([emptyShelter])
      .mockResolvedValue([{ ...emptyShelter, currentOccupancy: 100, availableCapacity: 400, occupancyPercentage: 20 }]);
    api.getAllocations.mockResolvedValue([
      { ...allocation, status: 'DISPATCHED', peopleExpected: 100 },
    ]);
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });
    fireEvent.click(screen.getByRole('tab', { name: 'Shelter Coordinator' }));

    fireEvent.change(screen.getByLabelText('People received for Central Shelter'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm receipt/ }));

    await waitFor(() => expect(api.confirmReceipt).toHaveBeenCalledWith('allocation-1', 40, undefined, 100));
    expect(toast).toHaveBeenCalledWith('Allocation approved. 100 people added to shelter occupancy.', 'success');
    await waitFor(() => expect(api.getShelters).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('tab', { name: 'District Officer' }));
    expect(screen.getByText('20% occupied')).toBeInTheDocument();
    expect(screen.getByText('400')).toBeInTheDocument();
  });

  it('shows a retryable error when shelter data cannot be loaded', async () => {
    api.getShelters.mockRejectedValue(new Error('API unavailable'));
    api.getResources.mockRejectedValue(new Error('API unavailable'));
    api.getAllocations.mockRejectedValue(new Error('API unavailable'));
    render(<ShelterRelief />);

    expect(await screen.findByText('Could not load relief operations')).toBeInTheDocument();
    expect(screen.getByText('API unavailable')).toBeInTheDocument();
  });
});
