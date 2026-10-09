import {
  IGroundReport,
  ApiResponse,
  ReportStatus,
  IHazard,
  IWarning,
  WarningStatus,
  IWarningDeliverySummary,
  INotificationRecord,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const GroundReportApi = {
  async create(data: Partial<IGroundReport>): Promise<ApiResponse<IGroundReport>> {
    const response = await fetch(`${API_URL}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async getAll(reporterId?: string): Promise<ApiResponse<IGroundReport[]>> {
    const url = reporterId
      ? `${API_URL}/reports?reporterId=${encodeURIComponent(reporterId)}`
      : `${API_URL}/reports`;
    const response = await fetch(url);
    return response.json();
  },

  async edit(
    id: string,
    reporterId: string,
    updates: Partial<IGroundReport>
  ): Promise<ApiResponse<IGroundReport>> {
    const response = await fetch(`${API_URL}/reports/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporterId, ...updates })
    });
    return response.json();
  },

  async delete(id: string, reporterId: string): Promise<ApiResponse<null>> {
    const response = await fetch(
      `${API_URL}/reports/${id}?reporterId=${encodeURIComponent(reporterId)}`,
      { method: 'DELETE' }
    );
    return response.json();
  },

  async updateStatus(
    id: string,
    status: ReportStatus,
    reviewerId: string,
    remarks?: string
  ): Promise<ApiResponse<IGroundReport>> {
    const response = await fetch(`${API_URL}/reports/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewerId, remarks })
    });
    return response.json();
  }
};

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-role': 'DMC_OFFICER',
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data: ApiResponse<T> = await response.json();

  if (!response.ok || !data.success) {
    const errorMsg = data.error?.message || `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, data.error?.code, data.error?.details);
  }

  return data.data as T;
}

export const warningApi = {
  getVerifiedHazards: () => request<IHazard[]>('/warnings/hazards'),

  getWarnings: (params?: { status?: string; warningLevel?: string; hazardId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.warningLevel) query.append('warningLevel', params.warningLevel);
    if (params?.hazardId) query.append('hazardId', params.hazardId);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request<IWarning[]>(`/warnings${queryString}`);
  },

  getWarningById: (id: string) => request<IWarning>(`/warnings/${id}`),

  createWarning: (payload: {
    hazardId: string;
    warningLevel: string;
    priority: string;
    message: string;
    affectedArea: string;
    startTime: string;
    expiryTime: string;
    recommendedAction: string;
    createdBy: string;
    status?: WarningStatus;
  }) =>
    request<IWarning>('/warnings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateWarning: (
    id: string,
    payload: {
      hazardId?: string;
      warningLevel?: string;
      priority?: string;
      message?: string;
      affectedArea?: string;
      startTime?: string;
      expiryTime?: string;
      recommendedAction?: string;
    }
  ) =>
    request<IWarning>(`/warnings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateStatus: (id: string, status: WarningStatus, cancellationReason?: string) =>
    request<IWarning>(`/warnings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, cancellationReason }),
    }),

  getNotifications: (id: string) =>
    request<{
      warningId: string;
      summary: IWarningDeliverySummary;
      totalRecords: number;
      notifications: INotificationRecord[];
    }>(`/warnings/${id}/notifications`),

  simulateNotifications: (id: string) =>
    request<{
      updatedCount: number;
      summary: IWarningDeliverySummary;
    }>(`/warnings/${id}/notifications/simulate`, {
      method: 'POST',
    }),
};};
