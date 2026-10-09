import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShelterRelief from '../pages/ShelterRelief';

const { api, toast } = vi.hoisted(() => ({
  api: {
    getShelters: vi.fn(),
    getResources: vi.fn(),
    getAllocations: vi.fn(),
    createAllocation: vi.fn(),
    updateStatus: vi.fn(),
    confirmReceipt: vi.fn(),
    updateOccupancy: vi.fn(),
    createResource: vi.fn(),
    updateResource: vi.fn(),
    auth: { role: 'DISTRICT_OFFICER' as string },
  },
  toast: vi.fn(),
}));

vi.mock('../types/relief', () => ({ reliefApi: api }));
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({ toast }),
}));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { role: api.auth.role, id: 'district-1', name: 'Officer' } } }),
  getAuthToken: () => undefined,
}));

const shelter = {
  _id: 'shelter-1',
  name: 'Central Shelter',
  location: 'District Centre',
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
  api.auth.role = 'DISTRICT_OFFICER';
  api.getShelters.mockResolvedValue([shelter]);
  api.getResources.mockResolvedValue([resource]);
  api.getAllocations.mockResolvedValue([allocation]);
  api.createAllocation.mockResolvedValue(allocation);
  api.updateStatus.mockResolvedValue(allocation);
  api.confirmReceipt.mockResolvedValue({ ...allocation, status: 'RECEIVED' });
});

describe('Shelter & Relief workspace', () => {
  it('shows shelter occupancy, near-full warnings, inventory, and active allocation conflicts', async () => {
    render(<ShelterRelief />);

    expect(await screen.findByRole('heading', { name: 'Central Shelter' })).toBeInTheDocument();
    expect(screen.getByText('Near Full')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Shelter'), { target: { value: 'shelter-1' } });
    fireEvent.change(screen.getByLabelText('Relief resource'), { target: { value: 'resource-1' } });
    expect(screen.getByText(/This shelter is near capacity/)).toBeInTheDocument();
    expect(screen.getByText(/active allocation.*already exist/i)).toBeInTheDocument();
  });

  it('creates an allocation with the selected shelter, resource, quantity, and officer', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    fireEvent.change(screen.getByLabelText('Shelter'), { target: { value: 'shelter-1' } });
    fireEvent.change(screen.getByLabelText('Relief resource'), { target: { value: 'resource-1' } });
    fireEvent.change(screen.getByLabelText('Allocation quantity'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Officer name'), { target: { value: 'Officer A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create allocation' }));

    await waitFor(() => expect(api.createAllocation).toHaveBeenCalledWith({
      shelterId: 'shelter-1',
      resourceId: 'resource-1',
      requestedQuantity: 25,
      createdBy: 'Officer A',
      notes: undefined,
    }));
    expect(toast).toHaveBeenCalledWith('Allocation created and inventory reserved.', 'success');
  });

  it('prevents requests that exceed available inventory', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    fireEvent.change(screen.getByLabelText('Shelter'), { target: { value: 'shelter-1' } });
    fireEvent.change(screen.getByLabelText('Relief resource'), { target: { value: 'resource-1' } });
    fireEvent.change(screen.getByLabelText('Allocation quantity'), { target: { value: '101' } });

    expect(screen.getByText(/Insufficient inventory/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create allocation' })).toBeDisabled();
    expect(api.createAllocation).not.toHaveBeenCalled();
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

  it('lets the coordinator confirm a dispatched quantity received at the shelter', async () => {
    api.auth.role = 'SHELTER_COORDINATOR';
    api.getAllocations.mockResolvedValue([{ ...allocation, status: 'DISPATCHED' }]);
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Incoming deliveries' });

    fireEvent.change(screen.getByLabelText('Received quantity for Drinking Water'), {
      target: { value: '35' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirm receipt/ }));

    await waitFor(() => expect(api.confirmReceipt).toHaveBeenCalledWith('allocation-1', 35));
    expect(toast).toHaveBeenCalledWith('Receipt confirmed.', 'success');
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
