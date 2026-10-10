import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { homeForRole } from '../auth/RequireRole';
import { UserRole } from '../types';

const testAccessEnabled = import.meta.env.VITE_ENABLE_TEST_ACCESS === 'true' &&
  (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'demo');

export default function Login() {
  const { session, login, register } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CITIZEN);
  const [district, setDistrict] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={homeForRole(session.user.role)} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = creating
        ? await register(name, email, password, role, district)
        : await login(email, password);
      navigate(homeForRole(user.role), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-5">
      <section className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-sm p-8">
        <div className="flex items-center gap-3 mb-7">
          <ShieldAlert className="w-8 h-8 text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">DMC Coordination System</h1>
            <p className="text-sm text-slate-500">Sri Lanka Disaster Management Center</p>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-5">{creating ? 'Create an account' : 'Sign in'}</h2>
        <form className="space-y-4" onSubmit={submit}>
          {creating && <>
            <label className="block text-sm font-medium text-slate-700">Name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2" /></label>
            <label className="block text-sm font-medium text-slate-700">Account type<select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2">
              <option value={UserRole.CITIZEN}>Citizen</option>
              <option value={UserRole.VOLUNTEER}>Volunteer</option>
              <option value={UserRole.DMC_OFFICER}>DMC Officer</option>
              <option value={UserRole.SHELTER_COORDINATOR}>Shelter Coordinator</option>
              <option value={UserRole.RESCUE_TEAM}>Rescue Team</option>
              <option value={UserRole.DISTRICT_OFFICER}>District Officer</option>
            </select></label>
            <label className="block text-sm font-medium text-slate-700">District<input value={district} onChange={(event) => setDistrict(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2" /></label>
          </>}
          <label className="block text-sm font-medium text-slate-700">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2" /></label>
          <label className="block text-sm font-medium text-slate-700">Password<input required type="password" minLength={creating ? 8 : undefined} autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2" /></label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={busy} className="w-full bg-brand-600 hover:bg-brand-900 disabled:opacity-60 text-white font-medium rounded-md px-4 py-2.5">{busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}</button>
        </form>
        <button type="button" onClick={() => { setCreating((value) => !value); setError(''); }} className="mt-5 text-sm text-brand-600 hover:underline">{creating ? 'Already have an account? Sign in' : 'Register as a citizen or volunteer'}</button>
        {!creating && testAccessEnabled && (
          <Link to="/test-access" className="mt-5 block w-full rounded-md border border-brand-600 px-4 py-2.5 text-center font-medium text-brand-600 hover:bg-brand-50">
            Demo sign-in: DMC Officer, Shelter Coordinator, Rescue Team, District Officer
          </Link>
        )}
      </section>
    </main>
  );
}