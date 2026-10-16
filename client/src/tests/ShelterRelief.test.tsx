import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShelterRelief from '../pages/ShelterRelief';

const { api, toast } = vi.hoisted(() => ({
  api: {
    getShelters: vi.fn(),
    createShelter: vi.fn(),
    requestCoordinator: vi.fn(),
    getCoordinatorRequests: vi.fn(),
    respondToCoordinatorRequest: vi.fn(),
    getResources: vi.fn(),
    getAllocations: vi.fn(),
    createAllocation: vi.fn(),
    createAllocations: vi.fn(),
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
  api.createShelter.mockResolvedValue(shelter);
  api.requestCoordinator.mockResolvedValue(shelter);
  api.getCoordinatorRequests.mockResolvedValue([]);
  api.respondToCoordinatorRequest.mockImplementation(async (id: string) => ({
    ...shelter,
    _id: id,
    coordinatorUserId: 'district-1',
  }));
  api.updateOccupancy.mockResolvedValue(shelter);
  api.getResources.mockResolvedValue([resource]);
  api.getAllocations.mockResolvedValue([allocation]);
  api.createAllocation.mockResolvedValue(allocation);
  api.createAllocations.mockResolvedValue([allocation]);
  api.updateStatus.mockResolvedValue(allocation);
  api.confirmReceipt.mockResolvedValue({ ...allocation, status: 'RECEIVED' });
});

describe('Shelter & Relief workspace', () => {
  it('lets a district officer create a shelter and refreshes the dashboard', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    expect(screen.queryByLabelText('Shelter name')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add New' }));
    fireEvent.change(screen.getByLabelText('Shelter name'), { target: { value: 'Riverside Shelter' } });
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Riverside Ward' } });
    fireEvent.change(screen.getByLabelText('Capacity'), { target: { value: '250' } });
    expect(screen.queryByLabelText('Coordinator email')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create shelter' }));

    await waitFor(() => expect(api.createShelter).toHaveBeenCalledWith({
      name: 'Riverside Shelter',
      location: 'Riverside Ward',
      capacity: 250,
    }));
    expect(toast).toHaveBeenCalledWith('Shelter created.', 'success');
    expect(api.getShelters).toHaveBeenCalledTimes(2);
  });

  it('lets officers select any shelter and send a coordinator request without an email', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    fireEvent.change(screen.getByLabelText('Select shelter for coordinator request'), {
      target: { value: 'shelter-1' },
    });
    fireEvent.change(screen.getByLabelText('Coordinator request message'), {
      target: { value: 'Please manage this shelter.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send coordinator request' }));

    await waitFor(() => expect(api.requestCoordinator).toHaveBeenCalledWith(
      'shelter-1',
      'Please manage this shelter.'
    ));
    expect(toast).toHaveBeenCalledWith('Coordinator request sent for Central Shelter.', 'success');
  });

  it('shows shelter occupancy, near-full warnings, inventory, and active allocation conflicts', async () => {
    render(<ShelterRelief />);

    expect(await screen.findByRole('heading', { name: 'Central Shelter' })).toBeInTheDocument();
    expect(screen.getByText('Near Full')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Shelter'), { target: { value: 'shelter-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Drinking Water/ }));
    expect(screen.getByText(/This shelter is near capacity/)).toBeInTheDocument();
    expect(screen.getByText(/active allocation.*already exist/i)).toBeInTheDocument();
  });

  it('creates an allocation with the signed-in officer name without asking the officer to type it', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    fireEvent.change(screen.getByLabelText('Shelter'), { target: { value: 'shelter-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Drinking Water/ }));
    fireEvent.change(screen.getByLabelText('Quantity for Drinking Water'), { target: { value: '25' } });
    expect(screen.queryByLabelText('Officer name')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create 1 allocation' }));

    await waitFor(() => expect(api.createAllocations).toHaveBeenCalledWith({
      shelterId: 'shelter-1',
      allocations: [{ resourceId: 'resource-1', requestedQuantity: 25 }],
      createdBy: 'Officer',
      notes: undefined,
    }));
    expect(toast).toHaveBeenCalledWith('Created 1 resource allocation and reserved inventory.', 'success');
  });

  it('prevents requests that exceed available inventory', async () => {
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    fireEvent.change(screen.getByLabelText('Shelter'), { target: { value: 'shelter-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Drinking Water/ }));
    fireEvent.change(screen.getByLabelText('Quantity for Drinking Water'), { target: { value: '101' } });

    expect(screen.getByText(/Only 100 litres available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create 1 allocation' })).toBeDisabled();
    expect(api.createAllocations).not.toHaveBeenCalled();
  });

  it('submits multiple selected resources with separate quantities', async () => {
    const blankets = {
      _id: 'resource-2',
      name: 'Blankets',
      category: 'Shelter',
      availableQuantity: 30,
      unit: 'units',
    };
    api.getResources.mockResolvedValue([resource, blankets]);
    render(<ShelterRelief />);
    await screen.findByRole('heading', { name: 'Central Shelter' });

    fireEvent.change(screen.getByLabelText('Shelter'), { target: { value: 'shelter-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Drinking Water/ }));
    fireEvent.change(screen.getByLabelText('Quantity for Drinking Water'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Blankets/ }));
    fireEvent.change(screen.getByLabelText('Quantity for Blankets'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create 2 allocations' }));

    await waitFor(() => expect(api.createAllocations).toHaveBeenCalledWith({
      shelterId: 'shelter-1',
      allocations: [
        { resourceId: 'resource-1', requestedQuantity: 25 },
        { resourceId: 'resource-2', requestedQuantity: 10 },
      ],
      createdBy: 'Officer',
      notes: undefined,
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

  it('shows pending shelters in a dropdown and lets the coordinator accept one', async () => {
    api.auth.role = 'SHELTER_COORDINATOR';
    const pendingRequest = {
      ...shelter,
      _id: 'pending-shelter',
      name: 'School Shelter',
      location: 'North Ward',
      coordinatorRequestMessage: 'Please coordinate this school shelter.',
      coordinatorRequestStatus: 'PENDING',
    };
    api.getCoordinatorRequests.mockResolvedValue([pendingRequest]);
    api.getShelters
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...pendingRequest, coordinatorUserId: 'district-1' }]);
    render(<ShelterRelief />);

    fireEvent.change(await screen.findByLabelText('Pending shelter requests'), {
      target: { value: 'pending-shelter' },
    });
    expect(screen.getByText('Please coordinate this school shelter.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept shelter' }));

    await waitFor(() => expect(api.respondToCoordinatorRequest).toHaveBeenCalledWith(
      'pending-shelter',
      'ACCEPTED'
    ));
    expect(await screen.findByText('School Shelter occupancy')).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(
      'School Shelter accepted and added to your shelters.',
      'success'
    );
  });

  it('refreshes the coordinator inbox to show a newly submitted officer request', async () => {
    api.auth.role = 'SHELTER_COORDINATOR';
    const pendingRequest = {
      ...shelter,
      _id: 'pending-shelter',
      name: 'School Shelter',
      location: 'North Ward',
      coordinatorRequestStatus: 'PENDING' as const,
    };
    api.getCoordinatorRequests
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([pendingRequest]);
    api.getShelters.mockResolvedValue([]);
    render(<ShelterRelief />);

    await screen.findByRole('heading', { name: 'No pending shelter requests' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh shelter requests' }));

    expect(await screen.findByLabelText('Pending shelter requests')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'School Shelter — North Ward' })).toBeInTheDocument();
  });

  it('lets a coordinator add people and refreshes occupancy percentage', async () => {
    api.auth.role = 'SHELTER_COORDINATOR';
    const coordinatorShelter = { ...shelter, currentOccupancy: 200, availableCapacity: 300, occupancyPercentage: 40 };
    const updatedShelter = { ...coordinatorShelter, currentOccupancy: 250, availableCapacity: 250, occupancyPercentage: 50 };
    api.getShelters
      .mockResolvedValueOnce([coordinatorShelter])
      .mockResolvedValueOnce([updatedShelter]);
    api.updateOccupancy.mockResolvedValue(updatedShelter);
    render(<ShelterRelief />);

    expect(await screen.findByText('200 of 500 people (40% occupied)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('People to add'), { target: { value: '50' } });
    expect(screen.getByText('After adding 50 people: 250 of 500 (50% occupied)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm people added' }));

    await waitFor(() => expect(api.updateOccupancy).toHaveBeenCalledWith('shelter-1', 250));
    expect(await screen.findByText('250 of 500 people (50% occupied)')).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith('50 people added to the shelter.', 'success');
  });

  it('lets a coordinator release people and updates the occupancy percentage', async () => {
    api.auth.role = 'SHELTER_COORDINATOR';
    const coordinatorShelter = { ...shelter, currentOccupancy: 200, availableCapacity: 300, occupancyPercentage: 40 };
    const updatedShelter = { ...coordinatorShelter, currentOccupancy: 150, availableCapacity: 350, occupancyPercentage: 30 };
    api.getShelters
      .mockResolvedValueOnce([coordinatorShelter])
      .mockResolvedValueOnce([updatedShelter]);
    api.updateOccupancy.mockResolvedValue(updatedShelter);
    render(<ShelterRelief />);

    await screen.findByText('200 of 500 people (40% occupied)');
    fireEvent.click(screen.getByRole('button', { name: 'Release people' }));
    fireEvent.change(screen.getByLabelText('People to release'), { target: { value: '50' } });
    expect(screen.getByText('After releasing 50 people: 150 of 500 (30% occupied)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm people released' }));

    await waitFor(() => expect(api.updateOccupancy).toHaveBeenCalledWith('shelter-1', 150));
    expect(await screen.findByText('150 of 500 people (30% occupied)')).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith('50 people released from the shelter.', 'success');
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
