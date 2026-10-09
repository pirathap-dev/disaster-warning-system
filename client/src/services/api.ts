import { IGroundReport, ApiResponse, ReportStatus } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
