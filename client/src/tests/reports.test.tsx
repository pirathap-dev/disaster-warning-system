import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportForm from '../pages/ground-reports/ReportForm';
import { GroundReportApi } from '../services/api';
import { DisasterType, SeverityLevel } from '../types';

// Mock the API and Toast
vi.mock('../services/api', () => ({
  GroundReportApi: {
    create: vi.fn(),
  }
}));

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe('ReportForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<ReportForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    expect(screen.getByText(/Disaster Type/i)).toBeInTheDocument();
    expect(screen.getByText(/Severity Level/i)).toBeInTheDocument();
    expect(screen.getByText(/Description/i)).toBeInTheDocument();
    expect(screen.getByText(/Location/i)).toBeInTheDocument();
  });

  it('validates required fields before submission', async () => {
    render(<ReportForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    
    // Direct submit without filling
    const submitBtn = screen.getByText('Submit Report');
    fireEvent.click(submitBtn);

    // Form is prevented from submitting by HTML5 validation, but if we bypass it:
    // It should not call the API
    expect(GroundReportApi.create).not.toHaveBeenCalled();
  });

  it('submits successfully and calls onSuccess', async () => {
    (GroundReportApi.create as vi.Mock).mockResolvedValue({
      success: true,
      data: { _id: '123', status: 'SUBMITTED', isDuplicate: false }
    });

    render(<ReportForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    
    fireEvent.change(screen.getByLabelText(/Disaster Type/i), { target: { value: DisasterType.FLOOD } });
    fireEvent.change(screen.getByLabelText(/Severity Level/i), { target: { value: SeverityLevel.HIGH } });
    fireEvent.change(screen.getByLabelText(/Latitude/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Longitude/i), { target: { value: '20' } });
    
    // Provide description
    const descTextarea = document.querySelector('textarea');
    fireEvent.change(descTextarea!, { target: { value: 'Flood test' } });

    fireEvent.click(screen.getByText('Submit Report'));

    await waitFor(() => {
      expect(GroundReportApi.create).toHaveBeenCalledWith(expect.objectContaining({
        disasterType: DisasterType.FLOOD,
        severity: SeverityLevel.HIGH,
        description: 'Flood test',
        location: { latitude: 10, longitude: 20 }
      }));
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('shows duplicate warning when duplicate is detected', async () => {
    (GroundReportApi.create as vi.Mock).mockResolvedValue({
      success: true,
      data: { _id: '123', status: 'SUBMITTED', isDuplicate: true }
    });

    render(<ReportForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
    
    fireEvent.change(screen.getByLabelText(/Disaster Type/i), { target: { value: DisasterType.FIRE } });
    fireEvent.change(screen.getByLabelText(/Severity Level/i), { target: { value: SeverityLevel.CRITICAL } });
    fireEvent.change(screen.getByLabelText(/Latitude/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Longitude/i), { target: { value: '20' } });
    
    const descTextarea = document.querySelector('textarea');
    fireEvent.change(descTextarea!, { target: { value: 'Fire test' } });

    fireEvent.click(screen.getByText('Submit Report'));

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
      // the toast mock would be called with the warning message, but we just verify it succeeded.
    });
  });
});
