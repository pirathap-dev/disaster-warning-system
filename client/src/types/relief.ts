export type ShelterStatus = 'OPEN' | 'CLOSED';
export type ShelterCapacityStatus = 'OPEN' | 'NEAR_FULL' | 'FULL' | 'CLOSED';
export type ReliefAllocationStatus =
  | 'REQUESTED'
  | 'ALLOCATED'
  | 'DISPATCHED'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Shelter {
  _id: string;
  name: string;
  location: string;
  capacity: number;
  currentOccupancy: number;
  availableCapacity: number;
  occupancyPercentage: number;
  capacityStatus: ShelterCapacityStatus;
  status: ShelterStatus;
}

export interface ReliefResource {
  _id: string;
  name: string;
  category: string;
  availableQuantity: number;
  unit: string;
  source?: string;
}

export interface ReliefAllocation {
  _id: string;
  shelter: string | Shelter;
  resource: string | ReliefResource;
  requestedQuantity: number;
  allocatedQuantity: number;
  deliveredQuantity: number;
  status: ReliefAllocationStatus;
  createdBy: string;
  notes?: string;
  allocatedAt?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string; code: string };
}

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !result.success || result.data === undefined) {
    throw new Error(result.error?.message || `Request failed (${response.status})`);
  }
  return result.data;
}

export const reliefApi = {
  getShelters: () => request<Shelter[]>('/shelters'),
  getResources: () => request<ReliefResource[]>('/relief-resources'),
  getAllocations: () => request<ReliefAllocation[]>('/relief-allocations'),
  createAllocation: (allocation: {
    shelterId: string;
    resourceId: string;
    requestedQuantity: number;
    createdBy: string;
    notes?: string;
  }) =>
    request<ReliefAllocation>('/relief-allocations', {
      method: 'POST',
      body: JSON.stringify(allocation),
    }),
  updateStatus: (id: string, status: ReliefAllocationStatus) =>
    request<ReliefAllocation>(`/relief-allocations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  confirmReceipt: (id: string, receivedQuantity: number, notes?: string) =>
    request<ReliefAllocation>(`/relief-allocations/${id}/receipt`, {
      method: 'PATCH',
      body: JSON.stringify({ receivedQuantity, notes }),
    }),
};
