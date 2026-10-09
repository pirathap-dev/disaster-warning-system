import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Check, Clock3, MapPin, Radio, RefreshCw, Shield, Truck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Loading } from '../components/ui/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { useToast } from '../components/ui/Toast';
import { authenticatedFetch } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import { UserRole } from '../types';
import { warningApi } from '../services/api';
import type { IWarning } from '../types';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type Status = 'AVAILABLE' | 'DISPATCHED' | 'EN_ROUTE' | 'ACTIVE' | 'COMPLETE' | 'DECLINED';

interface Incident {
  _id: string;
  title: string;
  locationName: string;
  location: { latitude: number; longitude: number };
  requiredCapabilities: string[];
  priority: Priority;
}

interface Team {
  _id: string;
  name: string;
  capabilities: string[];
  status: Status;
  location: { latitude: number; longitude: number };
  contact?: string;
}

interface Suitability {
  teamId: string;
  teamName: string;
  suitable: boolean;
  score: number;
  capabilityScore: number;
  availabilityScore: number;
  distanceScore: number;
  distanceKm: number;
  matchedCapabilities: string[];
  missingCapabilities: string[];
  reasons: string[];
}

interface Assignment {
  _id: string;
  incident: string | Incident;
  rescueTeam: string | Team;
  priority: Priority;
  status: Status;
  decision?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  assignedAt: string;
  etaMinutes?: number;
  notes?: string;
  completedAt?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { message: string };
}

const apiBase = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'}/rescue`;
const lifecycle: Status[] = ['DISPATCHED', 'EN_ROUTE', 'ACTIVE', 'COMPLETE'];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${apiBase}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success || payload.data === undefined) {
    throw new Error(payload.error?.message ?? 'The rescue service could not complete the request.');
  }
  return payload.data;
}

function referenceId(value: string | { _id: string }): string {
  return typeof value === 'string' ? value : value._id;
}

function priorityStyle(priority: Priority): string {
  return {
    LOW: 'bg-slate-100 text-slate-700',
    MEDIUM: 'bg-sky-100 text-sky-800',
    HIGH: 'bg-amber-100 text-amber-900',
    CRITICAL: 'bg-rose-100 text-rose-800',
  }[priority];
}

function statusStyle(status: Status): string {
  return status === 'AVAILABLE' || status === 'COMPLETE'
    ? 'bg-emerald-50 text-emerald-800'
    : status === 'DECLINED'
      ? 'bg-rose-50 text-rose-800'
    : status === 'ACTIVE'
      ? 'bg-orange-100 text-orange-900'
      : 'bg-sky-100 text-sky-900';
}

export default function RescueCoordination() {
  const { toast } = useToast();
  const { session } = useAuth();
  const isDistrictOfficer = session?.user.role === UserRole.DISTRICT_OFFICER;
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeWarnings, setActiveWarnings] = useState<IWarning[]>([]);
  const [suitability, setSuitability] = useState<Suitability[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [replacementTeamId, setReplacementTeamId] = useState('');
  const [etaMinutes, setEtaMinutes] = useState('45');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingSuitability, setLoadingSuitability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const [activeIncidents, rescueTeams, rescueAssignments, warnings] = await Promise.all([
        isDistrictOfficer ? api<Incident[]>('/incidents') : Promise.resolve([]),
        api<Team[]>('/teams'),
        api<Assignment[]>('/assignments'),
        isDistrictOfficer ? warningApi.getWarnings() : Promise.resolve([]),
      ]);
      setIncidents(activeIncidents);
      setTeams(rescueTeams);
      setAssignments(rescueAssignments);
      setActiveWarnings(warnings.filter((warning) => warning.status === 'ACTIVE' || warning.status === 'UPDATED'));
      setSelectedIncidentId((current) =>
        activeIncidents.some((incident) => incident._id === current)
          ? current
          : activeIncidents[0]?._id ?? ''
      );
      setSelectedAssignmentId((current) =>
        rescueAssignments.some((assignment) => assignment._id === current)
          ? current
          : rescueAssignments[0]?._id ?? ''
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load rescue data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [isDistrictOfficer]);

  useEffect(() => {
    setSuitability([]);
    setSelectedTeamId('');
    if (!isDistrictOfficer || !selectedIncidentId) return;
    let cancelled = false;
    setLoadingSuitability(true);
    api<Suitability[]>(`/teams/suitable?incidentId=${encodeURIComponent(selectedIncidentId)}`)
      .then((results) => {
        if (!cancelled) setSuitability(results);
      })
      .catch((loadError) => {
        if (!cancelled) toast(loadError instanceof Error ? loadError.message : 'Unable to score teams.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingSuitability(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDistrictOfficer, selectedIncidentId, toast]);

  const incident = incidents.find((item) => item._id === selectedIncidentId);
  const activeAssignment = assignments.find((item) => item._id === selectedAssignmentId);
  const availableTeams = teams.filter((team) => team.status === 'AVAILABLE').length;
  const activeAssignments = assignments.filter((assignment) => assignment.status !== 'COMPLETE').length;

  const createAssignment = async () => {
    if (!selectedIncidentId || !selectedTeamId) return;
    setSubmitting(true);
    try {
      const created = await api<Assignment>('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          incidentId: selectedIncidentId,
          teamId: selectedTeamId,
          createdBy: 'District Officer',
          etaMinutes: Number(etaMinutes),
          notes: notes.trim() || undefined,
        }),
      });
      toast(`${created._id.slice(-6).toUpperCase()} dispatched successfully.`, 'success');
      setSelectedTeamId('');
      setNotes('');
      await loadDashboard();
      setSelectedAssignmentId(created._id);
    } catch (submitError) {
      toast(submitError instanceof Error ? submitError.message : 'Unable to create assignment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const advanceAssignment = async (assignment = activeAssignment) => {
    if (!assignment) return;
    const nextStatus = lifecycle[lifecycle.indexOf(assignment.status) + 1];
    if (!nextStatus) return;
    setSubmitting(true);
    try {
      await api<Assignment>(`/assignments/${assignment._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      toast(`Assignment moved to ${nextStatus.replace('_', ' ')}.`, 'success');
      await loadDashboard();
    } catch (statusError) {
      toast(statusError instanceof Error ? statusError.message : 'Unable to update assignment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const markTeamAvailable = async (teamId: string) => {
    setSubmitting(true);
    try {
      await api<Team>(`/teams/${teamId}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'AVAILABLE' }),
      });
      toast('Rescue team marked available.', 'success');
      await loadDashboard();
    } catch (availabilityError) {
      toast(availabilityError instanceof Error ? availabilityError.message : 'Unable to update team availability.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const reassignSelected = async () => {
    if (!activeAssignment || !replacementTeamId) return;
    setSubmitting(true);
    try {
      await api<Assignment>(`/assignments/${activeAssignment._id}/reassign`, {
        method: 'PATCH',
        body: JSON.stringify({ teamId: replacementTeamId }),
      });
      toast('Dispatch reassigned.', 'success');
      setReplacementTeamId('');
      await loadDashboard();
    } catch (reassignError) {
      toast(reassignError instanceof Error ? reassignError.message : 'Unable to reassign dispatch.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const decideAssignment = async (assignment: Assignment, decision: 'ACCEPTED' | 'DECLINED') => {
    setSubmitting(true);
    try {
      await api<Assignment>(`/assignments/${assignment._id}/decision`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      toast(`Dispatch ${decision.toLowerCase()}.`, 'success');
      await loadDashboard();
    } catch (decisionError) {
      toast(decisionError instanceof Error ? decisionError.message : 'Unable to respond to dispatch.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={() => void loadDashboard()} />;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> District response desk
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Rescue coordination</h1>
          <p className="mt-1 text-sm text-slate-600">Match field teams to active incidents and track each dispatch.</p>
        </div>
        <Button variant="secondary" onClick={() => void loadDashboard()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </header>

      {isDistrictOfficer && activeWarnings.length > 0 && (
        <section className="border-l-4 border-rose-600 bg-rose-50 px-5 py-4" aria-label="Escalated warnings">
          <h2 className="font-semibold text-rose-950">Escalated warnings</h2>
          <ul className="mt-2 divide-y divide-rose-200">
            {activeWarnings.map((warning) => (
              <li key={warning._id || warning.id} className="py-2">
                <p className="font-medium text-rose-950">{warning.warningLevel}: {warning.affectedArea}</p>
                <p className="text-sm text-rose-900">{warning.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isDistrictOfficer && <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Rescue overview">
        <div className="flex items-center gap-4 border-l-4 border-rose-500 bg-white px-5 py-4 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <div><p className="text-2xl font-bold text-slate-900">{incidents.length}</p><p className="text-xs font-medium uppercase text-slate-500">Active incidents</p></div>
        </div>
        <div className="flex items-center gap-4 border-l-4 border-emerald-500 bg-white px-5 py-4 shadow-sm">
          <Shield className="h-5 w-5 text-emerald-700" />
          <div><p className="text-2xl font-bold text-slate-900">{availableTeams}</p><p className="text-xs font-medium uppercase text-slate-500">Teams available</p></div>
        </div>
        <div className="flex items-center gap-4 border-l-4 border-sky-600 bg-white px-5 py-4 shadow-sm">
          <Activity className="h-5 w-5 text-sky-700" />
          <div><p className="text-2xl font-bold text-slate-900">{activeAssignments}</p><p className="text-xs font-medium uppercase text-slate-500">Active assignments</p></div>
        </div>
      </section>}

      {isDistrictOfficer && <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="min-w-0 bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div><h2 className="font-semibold text-slate-900">Incident and team matching</h2><p className="mt-0.5 text-xs text-slate-500">Select an incident to compare response teams.</p></div>
            <Radio className="h-5 w-5 text-emerald-700" />
          </div>
          <div className="space-y-5 p-5">
            {incidents.length === 0 ? (
              <EmptyState title="No active incidents" description="Active incidents will appear here when registered by the hazard and warning service." />
            ) : (
              <>
                <Select
                  label="Affected incident"
                  value={selectedIncidentId}
                  onChange={(event) => setSelectedIncidentId(event.target.value)}
                  options={incidents.map((item) => ({ value: item._id, label: `${item.title} · ${item.locationName}` }))}
                />
                {incident && (
                  <div className="flex flex-wrap items-start justify-between gap-3 border-l-4 border-rose-500 bg-rose-50/70 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{incident.title}</h3><span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${priorityStyle(incident.priority)}`}>{incident.priority}</span></div>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><MapPin className="h-3.5 w-3.5 shrink-0" />{incident.locationName}</p>
                      <p className="mt-2 text-xs text-slate-600">Needed: {incident.requiredCapabilities.join(', ')}</p>
                    </div>
                    <span className="whitespace-nowrap font-mono text-xs text-slate-500">{incident.location.latitude.toFixed(3)}, {incident.location.longitude.toFixed(3)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">Team suitability</h3><span className="text-xs text-slate-500">Score / 100</span></div>
                {loadingSuitability ? <div className="py-8 text-center text-sm text-slate-500">Calculating distance and capability match...</div> : suitability.length === 0 ? (
                  <EmptyState title="No teams on record" description="Teams will appear after they are added to the response roster." />
                ) : (
                  <div className="space-y-3">
                    {suitability.map((result) => {
                      const rosterTeam = teams.find((item) => item._id === result.teamId);
                      const selectable = result.suitable && rosterTeam?.status === 'AVAILABLE';
                      return (
                        <button
                          type="button"
                          key={result.teamId}
                          onClick={() => selectable && setSelectedTeamId(result.teamId)}
                          disabled={!selectable}
                          className={`w-full border p-4 text-left transition-colors ${selectedTeamId === result.teamId ? 'border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700' : 'border-slate-200 hover:border-slate-400'} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3"><div className="mt-0.5 rounded bg-slate-100 p-2"><Truck className="h-4 w-4 text-slate-700" /></div><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-slate-900">{result.teamName}</h4><span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${statusStyle(rosterTeam?.status ?? 'COMPLETE')}`}>{rosterTeam?.status.replace('_', ' ')}</span></div><p className="mt-1 text-xs text-slate-600">{result.reasons.join(' · ')}</p></div></div>
                            <div className="text-right"><p className={`text-2xl font-bold ${selectable ? 'text-emerald-800' : 'text-slate-500'}`}>{result.score}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">{selectable ? 'dispatch eligible' : 'not eligible'}</p></div>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-xs">
                            <div><p className="font-bold text-slate-800">{result.capabilityScore}<span className="font-normal text-slate-500"> / 50</span></p><p className="text-slate-500">Capabilities</p></div>
                            <div><p className="font-bold text-slate-800">{result.availabilityScore}<span className="font-normal text-slate-500"> / 20</span></p><p className="text-slate-500">Availability</p></div>
                            <div><p className="font-bold text-slate-800">{result.distanceScore}<span className="font-normal text-slate-500"> / 30</span></p><p className="text-slate-500">{result.distanceKm} km away</p></div>
                          </div>
                          {result.missingCapabilities.length > 0 && <p className="mt-2 text-xs text-rose-700">Missing: {result.missingCapabilities.join(', ')}</p>}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-[150px_1fr]">
                  <Input label="ETA (minutes)" type="number" min="1" max="10080" value={etaMinutes} onChange={(event) => setEtaMinutes(event.target.value)} />
                  <Input label="Dispatch notes" placeholder="Access constraints, staging point..." value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} />
                </div>
                <Button onClick={() => void createAssignment()} disabled={!selectedTeamId || submitting || !etaMinutes || Number(etaMinutes) < 1}>
                  <Radio className="mr-2 h-4 w-4" /> Dispatch selected team
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Assignment tracking</h2><p className="mt-0.5 text-xs text-slate-500">Advance assignments through verified stages.</p></div>
            <div className="space-y-4 p-5">
              {assignments.length === 0 ? (
                <EmptyState title="No assignments yet" description="New dispatches and their live status will appear here." />
              ) : (
                <>
                  <Select label="Assignment" value={selectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)} options={assignments.map((item) => ({ value: item._id, label: `${item._id.slice(-6).toUpperCase()} · ${item.status.replace('_', ' ')}` }))} />
                  {activeAssignment && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded px-2 py-1 text-xs font-bold ${priorityStyle(activeAssignment.priority)}`}>{activeAssignment.priority} PRIORITY</span><span className={`rounded px-2 py-1 text-xs font-semibold ${statusStyle(activeAssignment.status)}`}>{activeAssignment.status.replace('_', ' ')}</span></div>
                      <div className="grid grid-cols-4 gap-1" aria-label="Assignment progress">
                        {lifecycle.map((stage, index) => {
                          const currentIndex = lifecycle.indexOf(activeAssignment.status);
                          const complete = index <= currentIndex;
                          return <div key={stage} className={`h-1.5 ${complete ? 'bg-emerald-600' : 'bg-slate-200'}`} title={stage.replace('_', ' ')} />;
                        })}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="border-l-2 border-slate-200 pl-3"><p className="text-xs text-slate-500">Assigned</p><p className="mt-1 font-medium text-slate-800">{new Date(activeAssignment.assignedAt).toLocaleString()}</p></div>
                        <div className="border-l-2 border-slate-200 pl-3"><p className="text-xs text-slate-500">ETA</p><p className="mt-1 flex items-center gap-1 font-medium text-slate-800"><Clock3 className="h-3.5 w-3.5" />{activeAssignment.etaMinutes ? `${activeAssignment.etaMinutes} min` : 'Not set'}</p></div>
                      </div>
                      {activeAssignment.notes && <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">{activeAssignment.notes}</p>}
                      {activeAssignment.status !== 'COMPLETE' && (
                        <Button variant="secondary" className="w-full" onClick={() => void advanceAssignment()} disabled={submitting}>
                          Advance to {lifecycle[lifecycle.indexOf(activeAssignment.status) + 1]?.replace('_', ' ')} <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                      {activeAssignment.status === 'DISPATCHED' && isDistrictOfficer && (
                        <div className="space-y-2 border-t border-slate-100 pt-3">
                          <Select
                            label="Replacement team"
                            value={replacementTeamId}
                            onChange={(event) => setReplacementTeamId(event.target.value)}
                            options={teams.filter((team) => team.status === 'AVAILABLE').map((team) => ({ value: team._id, label: team.name }))}
                          />
                          <Button variant="secondary" className="w-full" onClick={() => void reassignSelected()} disabled={submitting || !replacementTeamId}>
                            Reassign pending dispatch
                          </Button>
                        </div>
                      )}
                      {activeAssignment.completedAt && <p className="flex items-center gap-2 text-sm font-medium text-emerald-800"><Check className="h-4 w-4" />Completed {new Date(activeAssignment.completedAt).toLocaleString()}</p>}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Response roster</h2><p className="mt-0.5 text-xs text-slate-500">{teams.length} registered teams</p></div>
            <div className="divide-y divide-slate-100">
              {teams.length === 0 ? <div className="p-5"><EmptyState title="Roster is empty" description="Registered rescue teams will appear here." /></div> : teams.map((team) => (
                <div key={team._id} className="flex items-start justify-between gap-3 px-5 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{team.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{team.capabilities.join(', ')}{team.contact ? ` · ${team.contact}` : ''}</p></div><div className="flex shrink-0 flex-col items-end gap-2"><span className={`rounded px-2 py-1 text-[10px] font-semibold ${statusStyle(team.status)}`}>{team.status.replace('_', ' ')}</span>{team.status === 'COMPLETE' && <Button variant="secondary" size="sm" onClick={() => void markTeamAvailable(team._id)} disabled={submitting}>Mark available</Button>}</div></div>
              ))}
            </div>
          </div>
        </div>
      </section>}

      {!isDistrictOfficer && (
        <section className="divide-y divide-slate-200 border-y border-slate-200" aria-label="My rescue assignments">
          {assignments.length === 0 ? (
            <EmptyState title="No assigned operations" description="Dispatches assigned to your team will appear here." />
          ) : assignments.map((assignment) => (
            <article key={assignment._id} className="space-y-3 py-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h2 className="font-semibold text-slate-900">{typeof assignment.incident === 'string' ? 'Rescue assignment' : assignment.incident.title}</h2><p className="text-sm text-slate-600">{typeof assignment.incident === 'string' ? '' : assignment.incident.locationName}</p></div>
                <span className={`rounded px-2 py-1 text-xs font-semibold ${statusStyle(assignment.status)}`}>{assignment.status.replace('_', ' ')}</span>
              </div>
              {assignment.decision === 'PENDING' && (
                <div className="flex gap-2">
                  <Button onClick={() => void decideAssignment(assignment, 'ACCEPTED')} disabled={submitting}>Accept dispatch</Button>
                  <Button variant="secondary" onClick={() => void decideAssignment(assignment, 'DECLINED')} disabled={submitting}>Decline dispatch</Button>
                </div>
              )}
              {assignment.decision === 'ACCEPTED' && assignment.status !== 'COMPLETE' && (
                <Button variant="secondary" onClick={() => void advanceAssignment(assignment)} disabled={submitting}>
                  Advance to {lifecycle[lifecycle.indexOf(assignment.status) + 1]?.replace('_', ' ')} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {assignment.status === 'COMPLETE' && <p className="text-sm font-medium text-emerald-800">Operation complete. Team returned to AVAILABLE.</p>}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}