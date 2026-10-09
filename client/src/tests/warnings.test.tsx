import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import Warnings from '../pages/Warnings';
import { WarningPreviewModal } from '../pages/warnings/WarningPreviewModal';
import { WarningForm } from '../pages/warnings/WarningForm';
import { WarningDetailsModal } from '../pages/warnings/WarningDetailsModal';
import { NotificationTrackingView } from '../pages/warnings/NotificationTrackingView';
import { warningApi } from '../services/api';
import { WarningLevel, WarningPriority, WarningStatus, NotificationChannel, NotificationDeliveryStatus, ReportStatus } from '../types';

vi.mock('../services/api', () => ({
  warningApi: {
    getVerifiedHazards: vi.fn(),
    getWarnings: vi.fn(),
    getWarningById: vi.fn(),
    createWarning: vi.fn(),
    updateWarning: vi.fn(),
    updateStatus: vi.fn(),
    getNotifications: vi.fn(),
    simulateNotifications: vi.fn(),
  },
}));

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('Warnings & Public Alert Module (Client UI)', () => {
  const mockHazards = [
    {
      _id: 'haz1',
      title: 'Kelani Inundation Hazard',
      disasterType: 'FLOOD',
      severity: 'HIGH',
      location: { district: 'Colombo', address: 'Hanwella reach' },
      description: 'Major water rise upstream of Colombo city basin.',
      status: ReportStatus.VERIFIED,
      verifiedBy: 'DMC Hydrologist #01',
    },
    {
      _id: 'haz2',
      title: 'Passara Mountain Slope Risk',
      disasterType: 'LANDSLIDE',
      severity: 'CRITICAL',
      location: { district: 'Badulla' },
      description: 'NBRO Level 3 Red Evacuation.',
      status: ReportStatus.VERIFIED,
      verifiedBy: 'NBRO Officer #04',
    },
  ];

  const mockWarnings = [
    {
      _id: 'warn1',
      warningId: 'WRN-2026-100001',
      hazardId: 'haz1',
      warningLevel: WarningLevel.WARNING,
      priority: WarningPriority.HIGH,
      message: 'Rising river water level advisory for low ground sectors.',
      affectedArea: 'Colombo District',
      startTime: new Date(Date.now() + 60000).toISOString(),
      expiryTime: new Date(Date.now() + 3600000 * 6).toISOString(),
      recommendedAction: 'Move to designated elevated relief centers.',
      createdBy: 'Officer Perera',
      status: WarningStatus.ACTIVE,
      deliverySummary: {
        targetCitizens: 100,
        delivered: 80,
        failed: 10,
        pending: 10,
        channelBreakdown: {
          [NotificationChannel.PUSH]: { target: 45, delivered: 40, failed: 2, pending: 3 },
          [NotificationChannel.SMS]: { target: 45, delivered: 35, failed: 5, pending: 5 },
          [NotificationChannel.AUDIBLE]: { target: 10, delivered: 5, failed: 3, pending: 2 },
        },
      },
    },
    {
      _id: 'warn2',
      warningId: 'WRN-2026-100002',
      hazardId: 'haz2',
      warningLevel: WarningLevel.EVACUATE,
      priority: WarningPriority.CRITICAL,
      message: 'Immediate evacuation order due to slope fissures.',
      affectedArea: 'Badulla District',
      startTime: new Date().toISOString(),
      expiryTime: new Date(Date.now() + 3600000 * 12).toISOString(),
      recommendedAction: 'Evacuate immediately without delay.',
      createdBy: 'Officer Silva',
      status: WarningStatus.PUBLISHED,
      deliverySummary: {
        targetCitizens: 50,
        delivered: 45,
        failed: 5,
        pending: 0,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (warningApi.getVerifiedHazards as Mock).mockResolvedValue(mockHazards);
    (warningApi.getWarnings as Mock).mockResolvedValue(mockWarnings);
  });

  it('1. should render DMC Duty Officer console header, KPI stats, and warnings table', async () => {
    render(<Warnings />);

    await waitFor(() => {
      expect(screen.getByText(/Hazard Assessment & Public Warning System/i)).toBeInTheDocument();
      expect(screen.getByText(/Official DMC Duty Officer Interface/i)).toBeInTheDocument();
      expect(screen.getByText('WRN-2026-100001')).toBeInTheDocument();
      expect(screen.getByText('WRN-2026-100002')).toBeInTheDocument();
      expect(screen.getByText(/Citizens Alerted/i)).toBeInTheDocument();
    });
  });

  it('2. should switch to Hazard Assessment Feed and display verified hazards', async () => {
    render(<Warnings />);

    await waitFor(() => {
      expect(screen.getByText('Hazard Assessment Feed')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Hazard Assessment Feed'));

    await waitFor(() => {
      expect(screen.getByText('Kelani Inundation Hazard')).toBeInTheDocument();
      expect(screen.getByText('Passara Mountain Slope Risk')).toBeInTheDocument();
      expect(screen.getAllByText(/Assess & Issue Warning/i).length).toBe(2);
    });
  });

  it('3. should open the Warning Form prefilled when clicking Assess & Issue Warning', async () => {
    render(<Warnings />);

    fireEvent.click(await screen.findByText('Hazard Assessment Feed'));
    const assessButtons = await screen.findAllByText(/Assess & Issue Warning/i);
    fireEvent.click(assessButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Create Targeted Public Warning/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue(/Colombo District/i)).toBeInTheDocument();
      expect(screen.getByText(/Preview & Publish/i)).toBeInTheDocument();
    });
  });

  it('4. should validate Warning Form and require message and affected area', async () => {
    const mockSaveDraft = vi.fn();
    const mockOpenPreview = vi.fn();

    render(
      <WarningForm
        hazards={mockHazards}
        selectedHazard={null}
        onCancel={vi.fn()}
        onSaveDraft={mockSaveDraft}
        onOpenPreview={mockOpenPreview}
        isSubmitting={false}
      />
    );

    // Click Preview with empty fields
    fireEvent.click(screen.getByText(/Preview & Publish/i));

    await waitFor(() => {
      expect(mockOpenPreview).not.toHaveBeenCalled();
      expect(screen.getByText(/A verified hazard must be selected/i)).toBeInTheDocument();
    });
  });

  it('5. should open WarningPreviewModal with emergency broadcast details', () => {
    const mockPublish = vi.fn();
    const previewData = {
      hazardTitle: 'Kelani River Flood Risk',
      warningLevel: WarningLevel.EVACUATE,
      priority: WarningPriority.CRITICAL,
      message: 'Life-safety emergency: Evacuate riverside homes immediately.',
      affectedArea: 'Colombo District - Hanwella Reach',
      startTime: new Date().toISOString(),
      expiryTime: new Date(Date.now() + 3600000).toISOString(),
      recommendedAction: 'Proceed to high-elevation relief shelter.',
      createdBy: 'Officer Gamage',
    };

    render(
      <WarningPreviewModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirmPublish={mockPublish}
        isPublishing={false}
        data={previewData}
      />
    );

    expect(screen.getByText(/IMMEDIATE EVACUATION ORDER/i)).toBeInTheDocument();
    expect(screen.getByText(/CRITICAL PRIORITY/i)).toBeInTheDocument();
    expect(screen.getByText(/Colombo District - Hanwella Reach/i)).toBeInTheDocument();
    expect(screen.getByText(/Life-safety emergency: Evacuate riverside homes immediately./i)).toBeInTheDocument();
    expect(screen.getByText(/Multi-Channel Emergency Broadcast Targeting/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Confirm & Publish Warning Now/i));
    expect(mockPublish).toHaveBeenCalled();
  });

  it('6. should render NotificationTrackingView with metrics and breakdown', async () => {
    const mockSimulate = vi.fn();
    const summary = {
      targetCitizens: 120,
      delivered: 90,
      failed: 10,
      pending: 20,
      channelBreakdown: {
        [NotificationChannel.PUSH]: { target: 50, delivered: 40, failed: 5, pending: 5 },
        [NotificationChannel.SMS]: { target: 50, delivered: 40, failed: 5, pending: 5 },
        [NotificationChannel.AUDIBLE]: { target: 20, delivered: 10, failed: 0, pending: 10 },
      },
    };

    const notifications = [
      {
        _id: 'n1',
        warningId: 'warn1',
        channel: NotificationChannel.PUSH,
        recipientIdentifier: 'APP-USER-COL-1001',
        targetArea: 'Colombo District',
        status: NotificationDeliveryStatus.DELIVERED,
        deliveredAt: new Date(),
        createdAt: new Date(),
      },
      {
        _id: 'n2',
        warningId: 'warn1',
        channel: NotificationChannel.SMS,
        recipientIdentifier: '+94771234567',
        targetArea: 'Colombo District',
        status: NotificationDeliveryStatus.PENDING,
        createdAt: new Date(),
      },
    ];

    render(
      <NotificationTrackingView
        warningId="WRN-2026-100001"
        summary={summary}
        notifications={notifications}
        onSimulateDelivery={mockSimulate}
        isSimulating={false}
      />
    );

    expect(screen.getByText(/Live Public Notification Tracking/i)).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument(); // Target Citizens
    expect(screen.getByText(/Simulate Delivery Progression/i)).toBeInTheDocument();
    expect(screen.getByText('APP-USER-COL-1001')).toBeInTheDocument();
    expect(screen.getByText('+94771234567')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Simulate Delivery Progression/i));
    expect(mockSimulate).toHaveBeenCalled();
  });

  it('7. should filter warnings by status and search query', async () => {
    render(<Warnings />);

    await waitFor(() => {
      expect(screen.getByText('WRN-2026-100001')).toBeInTheDocument();
      expect(screen.getByText('WRN-2026-100002')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search by ID, geographic zone/i);
    fireEvent.change(searchInput, { target: { value: 'Badulla' } });

    await waitFor(() => {
      expect(screen.queryByText('WRN-2026-100001')).not.toBeInTheDocument();
      expect(screen.getByText('WRN-2026-100002')).toBeInTheDocument();
    });
  });

  it('8. should render Warning Details Modal with metadata and status controls', () => {
    const mockStatusChange = vi.fn();
    const mockEdit = vi.fn();
    const mockTracking = vi.fn();

    render(
      <WarningDetailsModal
        warning={mockWarnings[0]}
        isOpen={true}
        onClose={vi.fn()}
        onStatusChange={mockStatusChange}
        onEditContent={mockEdit}
        onViewTracking={mockTracking}
        isUpdating={false}
      />
    );

    expect(screen.getByText(/Warning Record Details/i)).toBeInTheDocument();
    expect(screen.getByText(/Rising river water level advisory for low ground sectors./i)).toBeInTheDocument();
    expect(screen.getByText(/Move to designated elevated relief centers./i)).toBeInTheDocument();
    expect(screen.getByText(/Edit \/ Update/i)).toBeInTheDocument();
    expect(screen.getByText(/Expire/i)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Expire/i));
    expect(mockStatusChange).toHaveBeenCalledWith(WarningStatus.EXPIRED);
  });
});
