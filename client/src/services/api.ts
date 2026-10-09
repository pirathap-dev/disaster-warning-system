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

  async getAll(role?: 'citizen' | 'dmc', reporterId?: string): Promise<ApiResponse<IGroundReport[]>> {
    let url = `${API_URL}/reports`;
    if (role === 'citizen' && reporterId) {
      url += `?reporterId=${reporterId}`;
    }
    const response = await fetch(url);
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
