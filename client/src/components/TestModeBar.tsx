import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { homeForRole } from '../auth/RequireRole';
import { UserRole } from '../types';

const testRoles = [
  { role: UserRole.CITIZEN, label: 'Citizen' },
  { role: UserRole.VOLUNTEER, label: 'Volunteer' },
  { role: UserRole.DMC_DUTY_OFFICER, label: 'DMC Duty Officer' },
  { role: UserRole.DISTRICT_OFFICER, label: 'District Officer' },
  { role: UserRole.RESCUE_TEAM, label: 'Rescue Team' },
  { role: UserRole.SHELTER_COORDINATOR, label: 'Shelter Coordinator' },
  { role: UserRole.RESOURCE_ORGANIZATION, label: 'Resource Organization' },
];

export default function TestModeBar() {
  const { session, testLogin } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');

  if (!session?.user.testAccess) return null;

  async function switchRole(role: UserRole) {
    setSwitching(true);
    setError('');
    try {
      const user = await testLogin(role);
      navigate(homeForRole(user.role), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not switch demo role.');
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-3 border border-amber-300 bg-slate-950 px-4 py-3 text-white shadow-xl">
      <span className="flex items-center gap-2 text-xs font-bold uppercase text-amber-300">
        <FlaskConical className="h-4 w-4" /> Test Mode
      </span>
      <label className="flex items-center gap-2 text-sm">
        <span className="sr-only">Switch demo role</span>
        <select
          aria-label="Switch demo role"
          value={session.user.role}
          disabled={switching}
          onChange={(event) => void switchRole(event.target.value as UserRole)}
          className="max-w-52 border border-slate-600 bg-slate-900 px-2 py-1.5 text-white"
        >
          {testRoles.map(({ role, label }) => <option key={role} value={role}>{label}</option>)}
        </select>
      </label>
      {error && <span role="alert" className="basis-full text-xs text-rose-200">{error}</span>}
    </div>
  );
}