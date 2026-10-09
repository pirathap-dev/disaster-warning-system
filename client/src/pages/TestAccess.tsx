import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Building2,
  ClipboardCheck,
  Home,
  MapPin,
  Package,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { homeForRole } from '../auth/RequireRole';
import { UserRole } from '../types';

const roleOptions = [
  { role: UserRole.CITIZEN, label: 'Citizen / Volunteer', detail: 'Reports, public alerts, and shelter finder', icon: User },
  { role: UserRole.DMC_DUTY_OFFICER, label: 'DMC Duty Officer', detail: 'Report verification and warning console', icon: ShieldCheck },
  { role: UserRole.DISTRICT_OFFICER, label: 'District Officer', detail: 'District response, rescue, and relief', icon: MapPin },
  { role: UserRole.RESCUE_TEAM, label: 'Rescue Team', detail: 'Assigned field operations', icon: Activity },
  { role: UserRole.SHELTER_COORDINATOR, label: 'Shelter Coordinator', detail: 'Shelter occupancy and incoming deliveries', icon: Home },
  { role: UserRole.RESOURCE_ORGANIZATION, label: 'Resource Organization', detail: 'Organization-owned relief stock', icon: Package },
];

export default function TestAccess() {
  const { testLogin } = useAuth();
  const navigate = useNavigate();
  const [busyRole, setBusyRole] = useState<UserRole | null>(null);
  const [error, setError] = useState('');

  async function enterAs(role: UserRole) {
    setBusyRole(role);
    setError('');
    try {
      const user = await testLogin(role);
      navigate(homeForRole(user.role), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start the demo session.');
    } finally {
      setBusyRole(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 border-l-4 border-amber-500 bg-amber-50 px-5 py-4" role="status">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-amber-900">
            <ClipboardCheck className="h-4 w-4" /> Test Mode
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Enter a demo role</h1>
          <p className="mt-1 text-sm text-slate-700">Each entry uses a seeded demo account. Backend permissions remain active.</p>
        </div>

        {error && <p className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Demo user roles">
          {roleOptions.map(({ role, label, detail, icon: Icon }) => (
            <button
              key={role}
              type="button"
              onClick={() => void enterAs(role)}
              disabled={busyRole !== null}
              className="group flex min-h-36 items-start gap-4 border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-700 hover:shadow-md disabled:cursor-wait disabled:opacity-60"
            >
              <span className="bg-emerald-50 p-3 text-emerald-800"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">{busyRole === role ? 'Entering…' : label}</span>
                <span className="mt-2 block text-sm text-slate-600">{detail}</span>
              </span>
            </button>
          ))}
        </section>

        <p className="mt-6 flex items-center gap-2 text-xs text-slate-500">
          <Building2 className="h-4 w-4" /> This demo entry is available only when enabled for development or demo mode.
        </p>
      </div>
    </main>
  );
}