import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast';
import RescueCoordination from '../pages/RescueCoordination';

const incident = {
  _id: '65a000000000000000000001',
  title: 'River flooding',
  locationName: 'North District',
  location: { latitude: 6.9271, longitude: 79.8612 },
  requiredCapabilities: ['medical', 'water rescue'],
  priority: 'HIGH' as const,
};

const team = {
  _id: '65a000000000000000000002',
  name: 'River Response',
  capabilities: ['medical', 'water rescue'],
  status: 'AVAILABLE' as const,
  location: incident.location,
  contact: '555-0144',
};

const assignment = {
  _id: '65a000000000000000000003',
  incident: incident._id,
  rescueTeam: team._id,
  priority: 'HIGH' as const,
  status: 'DISPATCHED' as const,
  assignedAt: '2026-10-08T10:00:00.000Z',
  etaMinutes: 35,
  notes: 'Use east access road',
};

function response(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ success: status < 400, data }),
  } as Response);
}

describe('rescue coordination workflow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads an incident, displays suitability, and dispatches the selected team', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/incidents')) return response([incident]);
      if (url.includes('/teams/suitable')) {
        return response([{
          teamId: team._id,
          teamName: team.name,
          suitable: true,
          score: 96,
          capabilityScore: 50,
          availabilityScore: 20,
          distanceScore: 26,
          distanceKm: 13.3,
          matchedCapabilities: team.capabilities,
          missingCapabilities: [],
          reasons: ['2/2 required capabilities matched', 'Team is available', '13.3 km from incident'],
        }]);
      }
      if (url.endsWith('/teams')) return response([team]);
      if (url.endsWith('/assignments') && init?.method === 'POST') return response(assignment, 201);
      if (url.endsWith('/assignments')) return response([]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ToastProvider><RescueCoordination /></ToastProvider>);

    expect(await screen.findByText('River flooding')).toBeInTheDocument();
    expect(await screen.findByText('96')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /River Response/ }));
    fireEvent.click(screen.getByRole('button', { name: /Dispatch selected team/ }));

    await waitFor(() => {
      const dispatchCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(dispatchCall).toBeDefined();
      expect(JSON.parse(String(dispatchCall?.[1]?.body))).toMatchObject({
        incidentId: incident._id,
        teamId: team._id,
        etaMinutes: 45,
      });
    });
  });

  it('shows the empty state when there are no affected incidents', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/incidents')) return response([]);
      if (url.endsWith('/teams')) return response([]);
      if (url.endsWith('/assignments')) return response([]);
      throw new Error(`Unexpected request: ${url}`);
    }));

    render(<ToastProvider><RescueCoordination /></ToastProvider>);

    expect(await screen.findByText('No active incidents')).toBeInTheDocument();
  });
});