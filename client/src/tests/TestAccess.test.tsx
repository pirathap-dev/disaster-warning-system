import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TestAccess from '../pages/TestAccess';
import TestModeBar from '../components/TestModeBar';
import { UserRole } from '../types';

const { testLogin, session } = vi.hoisted(() => ({
  testLogin: vi.fn(),
  session: { user: { id: 'demo-user', name: 'Demo User', email: 'demo@example.test', role: 'CITIZEN', testAccess: true } },
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ testLogin, session }),
}));

function CurrentPath() {
  const location = useLocation();
  return <output>{location.pathname}</output>;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('demo role access UI', () => {
  it('shows the available role entry cards and redirects after selecting a role', async () => {
    testLogin.mockResolvedValue({ role: UserRole.DMC_DUTY_OFFICER });
    render(<MemoryRouter initialEntries={['/test-access']}><TestAccess /><CurrentPath /></MemoryRouter>);

    expect(screen.getByText(/test mode/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Citizen \/ Volunteer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /DMC Duty Officer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /District Officer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rescue Team/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shelter Coordinator/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resource Organization/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /DMC Duty Officer/ }));
    await waitFor(() => expect(testLogin).toHaveBeenCalledWith(UserRole.DMC_DUTY_OFFICER));
    expect(await screen.findByText('/reports')).toBeInTheDocument();
  });

  it('shows the test-mode marker and switches from the floating role selector', async () => {
    testLogin.mockResolvedValue({ role: UserRole.RESCUE_TEAM });
    render(<MemoryRouter><TestModeBar /><CurrentPath /></MemoryRouter>);

    expect(screen.getByText('Test Mode')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Switch demo role' }), {
      target: { value: UserRole.RESCUE_TEAM },
    });
    await waitFor(() => expect(testLogin).toHaveBeenCalledWith(UserRole.RESCUE_TEAM));
    expect(await screen.findByText('/rescue')).toBeInTheDocument();
  });
});