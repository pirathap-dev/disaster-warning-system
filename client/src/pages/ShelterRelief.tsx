import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Home,
  PackageCheck,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Input } from '../components/ui/Input';
import { Loading } from '../components/ui/Loading';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../auth/AuthContext';
import { UserRole } from '../types';
import {
  reliefApi,
  type ReliefAllocation,
  type ReliefAllocationStatus,
  type ReliefResource,
  type Shelter,
} from '../types/relief';

type Workspace = 'finder' | 'officer' | 'coordinator' | 'organization';

const activeStatuses: ReliefAllocationStatus[] = ['REQUESTED', 'ALLOCATED', 'DISPATCHED'];

function relatedId(value: string | { _id: string }): string {
  return typeof value === 'string' ? value : value._id;
}

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'OPEN':
    case 'COMPLETED':
    case 'RECEIVED':
      return 'success';
    case 'NEAR_FULL':
    case 'REQUESTED':
    case 'ALLOCATED':
      return 'warning';
    case 'FULL':
    case 'CLOSED':
    case 'CANCELLED':
      return 'danger';
    default:
      return 'info';
  }
}

function displayStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AllocationDetails({
  allocation,
  shelter,
  resource,
}: {
  allocation: ReliefAllocation;
  shelter?: Shelter;
  resource?: ReliefResource;
}) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div><dt className="text-sm text-gray-500">Shelter</dt><dd className="font-medium">{shelter?.name || 'Unknown shelter'}</dd></div>
      <div><dt className="text-sm text-gray-500">Resource</dt><dd className="font-medium">{resource?.name || 'Unknown resource'}</dd></div>
      <div><dt className="text-sm text-gray-500">Requested</dt><dd>{allocation.requestedQuantity} {resource?.unit}</dd></div>
      <div><dt className="text-sm text-gray-500">Allocated</dt><dd>{allocation.allocatedQuantity} {resource?.unit}</dd></div>
      <div><dt className="text-sm text-gray-500">Delivered</dt><dd>{allocation.deliveredQuantity} {resource?.unit}</dd></div>
      <div><dt className="text-sm text-gray-500">Created by</dt><dd>{allocation.createdBy}</dd></div>
      <div><dt className="text-sm text-gray-500">Created</dt><dd>{new Date(allocation.createdAt).toLocaleString()}</dd></div>
      <div><dt className="text-sm text-gray-500">Last updated</dt><dd>{new Date(allocation.updatedAt).toLocaleString()}</dd></div>
      {allocation.notes && <div className="sm:col-span-2"><dt className="text-sm text-gray-500">Notes</dt><dd>{allocation.notes}</dd></div>}
    </dl>
  );
}

export default function ShelterRelief() {
  const { toast } = useToast();
  const { session } = useAuth();
  const role = session?.user.role;
  const workspace: Workspace = role === UserRole.RESOURCE_ORGANIZATION
    ? 'organization'
    : role === UserRole.SHELTER_COORDINATOR
      ? 'coordinator'
      : role === UserRole.DISTRICT_OFFICER
        ? 'officer'
        : 'finder';
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [resources, setResources] = useState<ReliefResource[]>([]);
  const [allocations, setAllocations] = useState<ReliefAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shelterId, setShelterId] = useState('');
  const [allocationQuantities, setAllocationQuantities] = useState<Record<string, string>>({});
  const [resourceSearch, setResourceSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [coordinatorShelterId, setCoordinatorShelterId] = useState('');
  const [coordinatorRequests, setCoordinatorRequests] = useState<Shelter[]>([]);
  const [coordinatorRequestsError, setCoordinatorRequestsError] = useState('');
  const [coordinatorRequestId, setCoordinatorRequestId] = useState('');
  const [requestShelterId, setRequestShelterId] = useState('');
  const [coordinatorRequestMessage, setCoordinatorRequestMessage] = useState('');
  const [occupancyAction, setOccupancyAction] = useState<'add' | 'release'>('add');
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [detailsAllocation, setDetailsAllocation] = useState<ReliefAllocation | null>(null);
  const [peopleToAdd, setPeopleToAdd] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [resourceCategory, setResourceCategory] = useState('');
  const [resourceQuantity, setResourceQuantity] = useState('0');
  const [resourceUnit, setResourceUnit] = useState('');
  const [resourceSource, setResourceSource] = useState('');
  const [newShelterName, setNewShelterName] = useState('');
  const [newShelterLocation, setNewShelterLocation] = useState('');
  const [newShelterCapacity, setNewShelterCapacity] = useState('');
  const [shelterFormOpen, setShelterFormOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [nextShelters, nextResources, nextAllocations, nextCoordinatorRequests] = await Promise.all([
        workspace === 'organization' ? Promise.resolve([]) : reliefApi.getShelters(),
        workspace === 'finder' ? Promise.resolve([]) : reliefApi.getResources(),
        workspace === 'officer' || workspace === 'coordinator'
          ? reliefApi.getAllocations()
          : Promise.resolve([]),
        workspace === 'coordinator' ? reliefApi.getCoordinatorRequests() : Promise.resolve([]),
      ]);
      setShelters(nextShelters);
      setResources(nextResources);
      setAllocations(nextAllocations);
      setCoordinatorRequests(nextCoordinatorRequests);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load shelter and relief data';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refreshCoordinatorRequests = useCallback(async () => {
    try {
      const requests = await reliefApi.getCoordinatorRequests();
      setCoordinatorRequests(requests);
      setCoordinatorRequestsError('');
    } catch (error) {
      setCoordinatorRequestsError(
        error instanceof Error ? error.message : 'Could not refresh shelter requests'
      );
    }
  }, []);

  useEffect(() => {
    if (workspace !== 'coordinator') return undefined;
    const intervalId = window.setInterval(() => {
      void refreshCoordinatorRequests();
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [workspace, refreshCoordinatorRequests]);

  const selectedShelter = shelters.find((shelter) => shelter._id === shelterId);
  const requestedShelter = shelters.find((shelter) => shelter._id === requestShelterId);
  const selectedResources = resources.filter((resource) =>
    Object.prototype.hasOwnProperty.call(allocationQuantities, resource._id)
  );
  const filteredResources = resources.filter((resource) =>
    `${resource.name} ${resource.category}`.toLowerCase().includes(resourceSearch.trim().toLowerCase())
  );
  const addedPeople = Number(peopleToAdd);
  const hasInvalidAllocationQuantities = selectedResources.some((resource) => {
    const requestedQuantity = Number(allocationQuantities[resource._id]);
    return !Number.isInteger(requestedQuantity) || requestedQuantity <= 0 ||
      requestedQuantity > resource.availableQuantity;
  });
  const matchingActiveAllocations = useMemo(
    () => allocations.filter((allocation) =>
      relatedId(allocation.shelter) === shelterId &&
      Object.prototype.hasOwnProperty.call(allocationQuantities, relatedId(allocation.resource)) &&
      activeStatuses.includes(allocation.status)
    ),
    [allocations, shelterId, allocationQuantities]
  );
  const coordinatorShelter = coordinatorShelterId || shelters[0]?._id || '';
  const selectedCoordinatorShelter = shelters.find((shelter) => shelter._id === coordinatorShelter);
  const selectedCoordinatorRequest = coordinatorRequests.find(
    (shelter) => shelter._id === coordinatorRequestId
  );
  const occupancyChange = occupancyAction === 'add' ? addedPeople : -addedPeople;
  const resultingOccupancy = (selectedCoordinatorShelter?.currentOccupancy ?? 0) + occupancyChange;
  const availableForOccupancyAction = occupancyAction === 'add'
    ? selectedCoordinatorShelter?.availableCapacity ?? 0
    : selectedCoordinatorShelter?.currentOccupancy ?? 0;
  const incomingAllocations = allocations.filter((allocation) =>
    relatedId(allocation.shelter) === coordinatorShelter &&
    (allocation.status === 'ALLOCATED' || allocation.status === 'DISPATCHED')
  );

  async function submitAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedShelter || selectedResources.length === 0 || hasInvalidAllocationQuantities) {
      toast('Select a shelter and at least one resource, then enter a valid quantity for each.', 'error');
      return;
    }
    if (!session?.user.name.trim()) {
      toast('Your signed-in officer account does not have a name.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await reliefApi.createAllocations({
        shelterId,
        allocations: selectedResources.map((resource) => ({
          resourceId: resource._id,
          requestedQuantity: Number(allocationQuantities[resource._id]),
        })),
        createdBy: session.user.name,
        notes: notes.trim() || undefined,
      });
      toast(`Created ${selectedResources.length} resource allocation${selectedResources.length === 1 ? '' : 's'} and reserved inventory.`, 'success');
      setAllocationQuantities({});
      setNotes('');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create allocation', 'error');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(allocation: ReliefAllocation, status: ReliefAllocationStatus) {
    setSubmitting(true);
    try {
      await reliefApi.updateStatus(allocation._id, status);
      toast(`Allocation marked ${displayStatus(status).toLowerCase()}.`, 'success');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update allocation status', 'error');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmReceipt(allocation: ReliefAllocation) {
    const receivedQuantity = Number(receiptQuantities[allocation._id] ?? allocation.allocatedQuantity);
    if (!Number.isInteger(receivedQuantity) || receivedQuantity <= 0 || receivedQuantity > allocation.allocatedQuantity) {
      toast(`Enter a whole number from 1 to ${allocation.allocatedQuantity}.`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      await reliefApi.confirmReceipt(allocation._id, receivedQuantity);
      toast('Receipt confirmed.', 'success');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not confirm receipt', 'error');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  async function saveOccupancy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCoordinatorShelter || !Number.isInteger(addedPeople) || addedPeople <= 0) {
      toast(`Enter a positive whole number of people to ${occupancyAction === 'add' ? 'add' : 'release'}.`, 'error');
      return;
    }
    if (addedPeople > availableForOccupancyAction) {
      toast(
        occupancyAction === 'add'
          ? `Only ${selectedCoordinatorShelter.availableCapacity} spaces are available.`
          : `Only ${selectedCoordinatorShelter.currentOccupancy} people are currently in the shelter.`,
        'error'
      );
      return;
    }
    setSubmitting(true);
    try {
      const updatedShelter = await reliefApi.updateOccupancy(
        selectedCoordinatorShelter._id,
        resultingOccupancy
      );
      setShelters((current) => current.map((shelter) =>
        shelter._id === updatedShelter._id ? updatedShelter : shelter
      ));
      setPeopleToAdd('');
      toast(
        occupancyAction === 'add'
          ? `${addedPeople} ${addedPeople === 1 ? 'person' : 'people'} added to the shelter.`
          : `${addedPeople} ${addedPeople === 1 ? 'person' : 'people'} released from the shelter.`,
        'success'
      );
      setOccupancyAction('add');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update shelter occupancy', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function createShelter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const capacity = Number(newShelterCapacity);
    if (!newShelterName.trim() || !newShelterLocation.trim() ||
        !Number.isInteger(capacity) || capacity <= 0) {
      toast('Enter a shelter name, location, and positive whole-number capacity.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await reliefApi.createShelter({
        name: newShelterName.trim(),
        location: newShelterLocation.trim(),
        capacity,
      });
      setNewShelterName('');
      setNewShelterLocation('');
      setNewShelterCapacity('');
      setShelterFormOpen(false);
      toast('Shelter created.', 'success');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create shelter', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function requestCoordinator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestedShelter) {
      toast('Select a shelter to request coordinator assignment.', 'error');
      return;
    }
    if (requestedShelter.coordinatorUserId) {
      toast('This shelter already has a coordinator.', 'error');
      return;
    }
    if (requestedShelter.coordinatorRequestStatus === 'PENDING') {
      toast('This shelter already has a pending request.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await reliefApi.requestCoordinator(
        requestedShelter._id,
        coordinatorRequestMessage.trim() || undefined
      );
      setCoordinatorRequestMessage('');
      toast(`Coordinator request sent for ${requestedShelter.name}.`, 'success');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not send coordinator request', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function respondToCoordinatorRequest(decision: 'ACCEPTED' | 'DECLINED') {
    if (!selectedCoordinatorRequest) return;
    setSubmitting(true);
    try {
      await reliefApi.respondToCoordinatorRequest(selectedCoordinatorRequest._id, decision);
      toast(
        decision === 'ACCEPTED'
          ? `${selectedCoordinatorRequest.name} accepted and added to your shelters.`
          : `Request for ${selectedCoordinatorRequest.name} declined.`,
        'success'
      );
      setCoordinatorRequestId('');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not respond to shelter request', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const availableQuantity = Number(resourceQuantity);
    if (!resourceName.trim() || !resourceCategory.trim() || !resourceUnit.trim() || !Number.isInteger(availableQuantity) || availableQuantity < 0) {
      toast('Complete the stock details with a non-negative whole-number quantity.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await reliefApi.createResource({
        name: resourceName.trim(),
        category: resourceCategory.trim(),
        availableQuantity,
        unit: resourceUnit.trim(),
        source: resourceSource.trim() || undefined,
      });
      setResourceName('');
      setResourceCategory('');
      setResourceQuantity('0');
      setResourceUnit('');
      setResourceSource('');
      toast('Stock item created.', 'success');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create stock item', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveStock(resource: ReliefResource) {
    const availableQuantity = Number(receiptQuantities[`stock:${resource._id}`] ?? resource.availableQuantity);
    if (!Number.isInteger(availableQuantity) || availableQuantity < 0) {
      toast('Stock must be a non-negative whole number.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await reliefApi.updateResource(resource._id, { availableQuantity });
      toast('Stock quantity updated.', 'success');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update stock', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && shelters.length === 0 && resources.length === 0 && allocations.length === 0) {
    return <Loading text="Loading shelter and relief operations..." />;
  }
  if (loadError && shelters.length === 0 && resources.length === 0 && allocations.length === 0) {
    return <ErrorState title="Could not load relief operations" message={loadError} onRetry={() => void loadData()} />;
  }

  const visibleDetailsShelter = detailsAllocation
    ? shelters.find((shelter) => shelter._id === relatedId(detailsAllocation.shelter))
    : undefined;
  const visibleDetailsResource = detailsAllocation
    ? resources.find((resource) => resource._id === relatedId(detailsAllocation.resource))
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shelter &amp; Relief</h2>
          <p className="mt-1 text-gray-500">Monitor shelter capacity, allocate resources, and confirm deliveries.</p>
        </div>
        <p className="text-sm font-medium text-slate-600">
          {workspace === 'officer' ? 'District Officer' : workspace === 'coordinator' ? 'Shelter Coordinator' : workspace === 'organization' ? 'Resource Organization' : 'Citizen shelter finder'}
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {loadError} <button className="ml-2 font-semibold underline" onClick={() => void loadData()}>Retry</button>
        </div>
      )}

      {workspace === 'finder' ? (
        <section aria-label="Shelter finder" className="divide-y divide-slate-200 border-y border-slate-200">
          {shelters.length === 0 ? (
            <EmptyState title="No open shelters found" description="Shelter locations will appear when available." />
          ) : shelters.map((shelter) => (
            <article key={shelter._id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{shelter.name}</h3>
                  <Badge variant={statusVariant(shelter.capacityStatus)}>{displayStatus(shelter.capacityStatus)}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{shelter.location}</p>
              </div>
              <p className="text-sm text-slate-700">
                {shelter.availableCapacity.toLocaleString()} spaces available of {shelter.capacity.toLocaleString()}
              </p>
            </article>
          ))}
        </section>
      ) : workspace === 'organization' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Card>
            <CardHeader><CardTitle>Add organization stock</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={createResource}>
                <Input label="Resource name" value={resourceName} onChange={(event) => setResourceName(event.target.value)} required />
                <Input label="Category" value={resourceCategory} onChange={(event) => setResourceCategory(event.target.value)} required />
                <Input label="Available quantity" type="number" min="0" step="1" value={resourceQuantity} onChange={(event) => setResourceQuantity(event.target.value)} required />
                <Input label="Unit" value={resourceUnit} onChange={(event) => setResourceUnit(event.target.value)} required />
                <Input label="Source (optional)" value={resourceSource} onChange={(event) => setResourceSource(event.target.value)} />
                <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Add stock'}</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>My stock</CardTitle></CardHeader>
            <CardContent>
              {resources.length === 0 ? <EmptyState title="No stock recorded" description="Add stock to make it available for district relief allocation." /> : (
                <div className="divide-y divide-slate-200">
                  {resources.map((resource) => (
                    <div key={resource._id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                      <div><p className="font-medium text-slate-900">{resource.name}</p><p className="text-sm text-slate-500">{resource.category} · {resource.unit}</p></div>
                      <Input label="Quantity" aria-label={`Stock quantity for ${resource.name}`} type="number" min="0" step="1" value={receiptQuantities[`stock:${resource._id}`] ?? String(resource.availableQuantity)} onChange={(event) => setReceiptQuantities((current) => ({ ...current, [`stock:${resource._id}`]: event.target.value }))} />
                      <Button type="button" variant="secondary" onClick={() => void saveStock(resource)} disabled={submitting}>Update stock</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : workspace === 'officer' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard icon={<Home className="h-5 w-5" />} label="Shelters" value={shelters.length} />
            <SummaryCard
              icon={<ClipboardList className="h-5 w-5" />}
              label="People sheltered"
              value={shelters.reduce((sum, shelter) => sum + shelter.currentOccupancy, 0).toLocaleString()}
            />
            <SummaryCard
              icon={<PackageCheck className="h-5 w-5" />}
              label="Active allocations"
              value={allocations.filter((allocation) => activeStatuses.includes(allocation.status)).length}
            />
          </div>

          <Card>
            <CardHeader className="flex items-center justify-between gap-4">
              <CardTitle>Shelter capacity</CardTitle>
              <Button type="button" onClick={() => setShelterFormOpen(true)}>Add New</Button>
            </CardHeader>
            <CardContent>
              {shelters.length === 0 ? (
                <EmptyState title="No shelters available" description="Shelter records will appear here when they are added to the system." />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {shelters.map((shelter) => (
                    <div key={shelter._id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><h3 className="font-semibold text-gray-900">{shelter.name}</h3><p className="text-sm text-gray-500">{shelter.location}</p></div>
                        <Badge variant={statusVariant(shelter.capacityStatus)}>{displayStatus(shelter.capacityStatus)}</Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                        <Metric label="Capacity" value={shelter.capacity.toLocaleString()} />
                        <Metric label="Occupancy" value={shelter.currentOccupancy.toLocaleString()} />
                        <Metric label="Available" value={shelter.availableCapacity.toLocaleString()} />
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" aria-label={`${shelter.occupancyPercentage}% occupied`}>
                        <div
                          className={`h-full rounded-full ${shelter.capacityStatus === 'FULL' ? 'bg-red-500' : shelter.capacityStatus === 'NEAR_FULL' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(shelter.occupancyPercentage, 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-right text-xs text-gray-500">{shelter.occupancyPercentage}% occupied</p>
                      <div className="mt-4 border-t border-gray-100 pt-3">
                        <p className="mb-2 text-xs text-gray-500">
                          {shelter.coordinatorUserId
                            ? 'Coordinator assigned'
                            : shelter.coordinatorRequestStatus === 'PENDING'
                              ? 'Coordinator approval pending'
                              : shelter.coordinatorRequestStatus === 'DECLINED'
                                ? 'Coordinator request declined'
                                : 'No coordinator assigned'}
                        </p>
                        {shelter.coordinatorRequestMessage && (
                          <p className="mt-2 text-xs text-gray-500">
                            Request note: {shelter.coordinatorRequestMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Request a shelter coordinator</CardTitle>
              <p className="mt-1 text-sm text-gray-500">
                Choose a shelter and send a request to shelter coordinators. A coordinator can accept the request from their dashboard.
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={requestCoordinator}>
                <Select
                  label="Select shelter"
                  aria-label="Select shelter for coordinator request"
                  value={requestShelterId}
                  onChange={(event) => setRequestShelterId(event.target.value)}
                  options={shelters.map((shelter) => ({
                    value: shelter._id,
                    label: `${shelter.name} — ${shelter.location}${shelter.coordinatorUserId
                      ? ' (Coordinator assigned)'
                      : shelter.coordinatorRequestStatus === 'PENDING'
                        ? ' (Request pending)'
                        : ''}`,
                  }))}
                />
                {requestedShelter && (
                  <p className="text-sm text-gray-600">
                    Capacity: {requestedShelter.capacity.toLocaleString()} · Current occupancy: {requestedShelter.currentOccupancy.toLocaleString()}
                    {requestedShelter.coordinatorUserId
                      ? ' · Already assigned'
                      : requestedShelter.coordinatorRequestStatus === 'PENDING'
                        ? ' · Request already pending'
                        : ' · Available to request'}
                  </p>
                )}
                <Input
                  label="Message for coordinator (optional)"
                  aria-label="Coordinator request message"
                  placeholder="Add details about this shelter"
                  maxLength={500}
                  value={coordinatorRequestMessage}
                  onChange={(event) => setCoordinatorRequestMessage(event.target.value)}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={submitting || !requestedShelter ||
                    Boolean(requestedShelter.coordinatorUserId) ||
                    requestedShelter?.coordinatorRequestStatus === 'PENDING'}
                >
                  {submitting ? 'Sending...' : 'Send coordinator request'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Modal
            isOpen={shelterFormOpen}
            onClose={() => setShelterFormOpen(false)}
            title="Add a shelter"
          >
            <form className="space-y-4" onSubmit={createShelter}>
                <Input
                  label="Shelter name"
                  aria-label="Shelter name"
                  value={newShelterName}
                  onChange={(event) => setNewShelterName(event.target.value)}
                  maxLength={120}
                  required
                />
                <Input
                  label="Location"
                  aria-label="Location"
                  value={newShelterLocation}
                  onChange={(event) => setNewShelterLocation(event.target.value)}
                  maxLength={200}
                  required
                />
                <Input
                  label="Capacity"
                  aria-label="Capacity"
                  type="number"
                  min="1"
                  step="1"
                  value={newShelterCapacity}
                  onChange={(event) => setNewShelterCapacity(event.target.value)}
                  required
                />
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => setShelterFormOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving...' : 'Create shelter'}
                  </Button>
                </div>
            </form>
          </Modal>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
            <Card>
              <CardHeader><CardTitle>Relief resource inventory</CardTitle></CardHeader>
              <CardContent>
                {resources.length === 0 ? (
                  <EmptyState title="No relief resources available" description="Resource inventory will appear here when it is added to the system." />
                ) : (
                  <div className="space-y-3">
                    {resources.map((resource) => (
                      <div key={resource._id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="rounded-lg bg-brand-50 p-2 text-brand-700"><Boxes className="h-5 w-5" /></span>
                          <div className="min-w-0"><p className="truncate font-medium">{resource.name}</p><p className="text-sm text-gray-500">{resource.category}{resource.source ? ` · ${resource.source}` : ''}</p></div>
                        </div>
                        <p className="whitespace-nowrap text-right font-semibold">{resource.availableQuantity.toLocaleString()} <span className="text-sm font-normal text-gray-500">{resource.unit}</span></p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Create allocation</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={submitAllocation}>
                  <Select
                    label="Shelter"
                    aria-label="Shelter"
                    value={shelterId}
                    onChange={(event) => setShelterId(event.target.value)}
                    options={shelters.map((shelter) => ({ value: shelter._id, label: shelter.name }))}
                  />
                  {selectedShelter && (
                    <div className="rounded-md bg-gray-50 p-3 text-sm">
                      <p><span className="text-gray-500">Capacity:</span> {selectedShelter.capacity.toLocaleString()}</p>
                      <p><span className="text-gray-500">Occupancy:</span> {selectedShelter.currentOccupancy.toLocaleString()} ({selectedShelter.occupancyPercentage}%)</p>
                      <p><span className="text-gray-500">Available:</span> {selectedShelter.availableCapacity.toLocaleString()}</p>
                    </div>
                  )}
                  {selectedShelter?.capacityStatus === 'NEAR_FULL' && (
                    <Notice tone="warning">This shelter is near capacity. Verify it can receive additional supplies.</Notice>
                  )}
                  {selectedShelter?.capacityStatus === 'FULL' && (
                    <Notice tone="danger">This shelter is full for new arrivals. Resource deliveries can still be allocated.</Notice>
                  )}
                  {selectedShelter?.status === 'CLOSED' && (
                    <Notice tone="danger">This shelter is closed and cannot receive allocations.</Notice>
                  )}

                  <fieldset className="space-y-2">
                    <legend className="block text-sm font-medium text-gray-700">Relief resource</legend>
                    <Input
                      type="search"
                      aria-label="Search relief resources"
                      placeholder="Search resources..."
                      value={resourceSearch}
                      onChange={(event) => setResourceSearch(event.target.value)}
                    />
                    {filteredResources.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                        {resources.length === 0 ? 'No relief resources available.' : 'No resources match your search.'}
                      </p>
                    ) : (
                      <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2" role="group" aria-label="Available relief resources">
                        {filteredResources.map((resource) => {
                          const isSelected = Object.prototype.hasOwnProperty.call(allocationQuantities, resource._id);
                          const unavailable = resource.availableQuantity <= 0;
                          return (
                            <div
                              key={resource._id}
                              className={`rounded-lg border p-3 transition-colors ${
                                unavailable
                                  ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                                  : isSelected
                                    ? 'border-brand-500 bg-brand-50'
                                    : 'border-gray-200 bg-white'
                              }`}
                            >
                              <button
                                type="button"
                                aria-pressed={isSelected}
                                disabled={unavailable}
                                onClick={() => setAllocationQuantities((current) => {
                                  if (Object.prototype.hasOwnProperty.call(current, resource._id)) {
                                    const next = { ...current };
                                    delete next[resource._id];
                                    return next;
                                  }
                                  return { ...current, [resource._id]: '' };
                                })}
                                className="flex w-full items-start justify-between gap-2 rounded text-left focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed"
                              >
                                <span className="flex min-w-0 items-start gap-2">
                                  <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium">{resource.name}</span>
                                    <span className="block text-xs text-gray-500">{resource.category}</span>
                                  </span>
                                </span>
                                {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" aria-label="Selected" />}
                              </button>
                              <p className={`mt-2 text-xs font-medium ${unavailable ? 'text-red-600' : 'text-gray-600'}`}>
                                {unavailable
                                  ? 'Out of stock'
                                  : `${resource.availableQuantity.toLocaleString()} ${resource.unit} available`}
                              </p>
                              {isSelected && (
                                <Input
                                  className="mt-3"
                                  label={`Quantity for ${resource.name}`}
                                  aria-label={`Quantity for ${resource.name}`}
                                  type="number"
                                  min="1"
                                  max={resource.availableQuantity}
                                  step="1"
                                  value={allocationQuantities[resource._id]}
                                  onChange={(event) => setAllocationQuantities((current) => ({
                                    ...current,
                                    [resource._id]: event.target.value,
                                  }))}
                                  error={allocationQuantities[resource._id] && (
                                    !Number.isInteger(Number(allocationQuantities[resource._id])) ||
                                    Number(allocationQuantities[resource._id]) <= 0
                                  ) ? 'Enter a positive whole number.' :
                                    Number(allocationQuantities[resource._id]) > resource.availableQuantity
                                      ? `Only ${resource.availableQuantity} ${resource.unit} available.`
                                      : undefined}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                  {matchingActiveAllocations.length > 0 && (
                    <Notice tone="warning">
                      {matchingActiveAllocations.length} active allocation{matchingActiveAllocations.length === 1 ? '' : 's'} already exist for this shelter and resource. Check for overlapping deliveries.
                    </Notice>
                  )}
                  <Input
                    label="Notes (optional)"
                    aria-label="Allocation notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={1000}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting || !shelterId || selectedResources.length === 0 ||
                      hasInvalidAllocationQuantities || !session?.user.name.trim() ||
                      selectedShelter?.status === 'CLOSED'}
                  >
                    {submitting
                      ? 'Saving...'
                      : selectedResources.length > 0
                        ? `Create ${selectedResources.length} allocation${selectedResources.length === 1 ? '' : 's'}`
                        : 'Create allocations'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <AllocationTable
            allocations={allocations}
            shelters={shelters}
            resources={resources}
            view="officer"
            busy={submitting}
            onStatus={updateStatus}
            onDetails={setDetailsAllocation}
            onReceipt={confirmReceipt}
            receiptQuantities={receiptQuantities}
            onReceiptQuantity={(id, value) => setReceiptQuantities((current) => ({ ...current, [id]: value }))}
          />
        </>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Incoming shelter requests</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">
                    New officer requests appear here automatically. Select a request to review and accept or decline it.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void refreshCoordinatorRequests()}
                  aria-label="Refresh shelter requests"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {coordinatorRequestsError && (
                <p role="alert" className="text-sm text-red-700">
                  {coordinatorRequestsError}
                </p>
              )}
              {coordinatorRequests.length === 0 ? (
                <EmptyState
                  title="No pending shelter requests"
                  description="Requests sent by district officers will appear here."
                />
              ) : (
                <>
                <Select
                  label="Pending shelter requests"
                  aria-label="Pending shelter requests"
                  value={coordinatorRequestId}
                  onChange={(event) => setCoordinatorRequestId(event.target.value)}
                  options={coordinatorRequests.map((shelter) => ({
                    value: shelter._id,
                    label: `${shelter.name} — ${shelter.location}`,
                  }))}
                />
                {selectedCoordinatorRequest && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{selectedCoordinatorRequest.name}</h3>
                        <p className="text-sm text-gray-600">{selectedCoordinatorRequest.location}</p>
                      </div>
                      <Badge variant="warning">Pending approval</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <Metric label="Capacity" value={selectedCoordinatorRequest.capacity.toLocaleString()} />
                      <Metric label="Current occupancy" value={selectedCoordinatorRequest.currentOccupancy.toLocaleString()} />
                    </div>
                    {selectedCoordinatorRequest.coordinatorRequestMessage && (
                      <p className="mt-3 rounded-md bg-white p-3 text-sm text-gray-700">
                        {selectedCoordinatorRequest.coordinatorRequestMessage}
                      </p>
                    )}
                    <div className="mt-4 flex gap-3">
                      <Button
                        type="button"
                        onClick={() => void respondToCoordinatorRequest('ACCEPTED')}
                        disabled={submitting}
                      >
                        {submitting ? 'Saving...' : 'Accept shelter'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void respondToCoordinatorRequest('DECLINED')}
                        disabled={submitting}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                )}
                </>
              )}
            </CardContent>
          </Card>
          {selectedCoordinatorShelter && (
            <Card>
              <CardHeader>
                <CardTitle>{selectedCoordinatorShelter.name} occupancy</CardTitle>
                <p className="mt-1 text-sm text-gray-600">
                  {selectedCoordinatorShelter.currentOccupancy.toLocaleString()} of {selectedCoordinatorShelter.capacity.toLocaleString()} people
                  {' '}({selectedCoordinatorShelter.occupancyPercentage}% occupied)
                </p>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={saveOccupancy}>
                  <div className="flex flex-wrap gap-2" aria-label="Occupancy action">
                    <Button
                      type="button"
                      variant={occupancyAction === 'add' ? 'primary' : 'secondary'}
                      aria-pressed={occupancyAction === 'add'}
                      onClick={() => {
                        setOccupancyAction('add');
                        setPeopleToAdd('');
                      }}
                    >
                      Add people
                    </Button>
                    <Button
                      type="button"
                      variant={occupancyAction === 'release' ? 'primary' : 'secondary'}
                      aria-pressed={occupancyAction === 'release'}
                      onClick={() => {
                        setOccupancyAction('release');
                        setPeopleToAdd('');
                      }}
                    >
                      Release people
                    </Button>
                  </div>
                  <Input
                    label={occupancyAction === 'add'
                      ? `People to add (${selectedCoordinatorShelter.availableCapacity} spaces available)`
                      : `People to release (${selectedCoordinatorShelter.currentOccupancy} people in shelter)`}
                    aria-label={occupancyAction === 'add' ? 'People to add' : 'People to release'}
                    type="number"
                    min="1"
                    max={availableForOccupancyAction}
                    step="1"
                    value={peopleToAdd}
                    onChange={(event) => setPeopleToAdd(event.target.value)}
                    error={peopleToAdd && (!Number.isInteger(addedPeople) || addedPeople <= 0)
                      ? 'Enter a positive whole number.'
                      : addedPeople > availableForOccupancyAction
                        ? occupancyAction === 'add'
                          ? `Only ${selectedCoordinatorShelter.availableCapacity} spaces are available.`
                          : `Only ${selectedCoordinatorShelter.currentOccupancy} people are currently in the shelter.`
                        : undefined}
                  />
                  {Number.isInteger(addedPeople) && addedPeople > 0 &&
                    addedPeople <= availableForOccupancyAction && (
                      <p className="text-sm text-gray-600">
                        After {occupancyAction === 'add' ? 'adding' : 'releasing'} {addedPeople} {addedPeople === 1 ? 'person' : 'people'}: {resultingOccupancy} of {selectedCoordinatorShelter.capacity} ({Math.round((resultingOccupancy / selectedCoordinatorShelter.capacity) * 100)}% occupied)
                      </p>
                    )}
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={submitting || !Number.isInteger(addedPeople) || addedPeople <= 0 ||
                      addedPeople > availableForOccupancyAction}
                  >
                    {submitting
                      ? 'Saving...'
                      : occupancyAction === 'add'
                        ? 'Confirm people added'
                        : 'Confirm people released'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><CardTitle>Incoming deliveries</CardTitle><p className="mt-1 text-sm text-gray-500">Review dispatched supplies and confirm what arrived.</p></div>
              <Select
                aria-label="Filter incoming deliveries by shelter"
                value={coordinatorShelter}
                onChange={(event) => setCoordinatorShelterId(event.target.value)}
                options={shelters.map((shelter) => ({ value: shelter._id, label: shelter.name }))}
              />
            </div>
          </CardHeader>
          <CardContent>
            <CoordinatorTable
              allocations={incomingAllocations}
              shelters={shelters}
              resources={resources}
              busy={submitting}
              onStatus={updateStatus}
              onDetails={setDetailsAllocation}
              onReceipt={confirmReceipt}
              receiptQuantities={receiptQuantities}
              onReceiptQuantity={(id, value) => setReceiptQuantities((current) => ({ ...current, [id]: value }))}
            />
          </CardContent>
        </Card>
        </div>
      )}

      <Modal
        isOpen={detailsAllocation !== null}
        onClose={() => setDetailsAllocation(null)}
        title="Allocation details"
        className="max-w-xl"
      >
        {detailsAllocation && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-sm text-gray-500">{detailsAllocation._id}</p>
              <Badge variant={statusVariant(detailsAllocation.status)}>{displayStatus(detailsAllocation.status)}</Badge>
            </div>
            <AllocationDetails allocation={detailsAllocation} shelter={visibleDetailsShelter} resource={visibleDetailsResource} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span className="rounded-lg bg-brand-50 p-3 text-brand-700">{icon}</span>
        <div><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold text-gray-900">{value}</p></div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-gray-500">{label}</p><p className="font-semibold text-gray-900">{value}</p></div>;
}

function Notice({ children, tone }: { children: ReactNode; tone: 'warning' | 'danger' }) {
  return (
    <div className={`flex gap-2 rounded-md p-3 text-sm ${tone === 'danger' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`} role="status">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function AllocationTable({
  allocations,
  shelters,
  resources,
  view,
  busy,
  onStatus,
  onDetails,
  onReceipt,
  receiptQuantities,
  onReceiptQuantity,
}: {
  allocations: ReliefAllocation[];
  shelters: Shelter[];
  resources: ReliefResource[];
  view: 'officer';
  busy: boolean;
  onStatus: (allocation: ReliefAllocation, status: ReliefAllocationStatus) => void;
  onDetails: (allocation: ReliefAllocation) => void;
  onReceipt: (allocation: ReliefAllocation) => void;
  receiptQuantities: Record<string, string>;
  onReceiptQuantity: (id: string, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Allocation tracking</CardTitle></CardHeader>
      <CardContent>
        {allocations.length === 0 ? (
          <EmptyState title="No allocations yet" description="Created allocations will appear here with their delivery status." />
        ) : (
          <AllocationRows
            allocations={allocations}
            shelters={shelters}
            resources={resources}
            view={view}
            busy={busy}
            onStatus={onStatus}
            onDetails={onDetails}
            onReceipt={onReceipt}
            receiptQuantities={receiptQuantities}
            onReceiptQuantity={onReceiptQuantity}
          />
        )}
      </CardContent>
    </Card>
  );
}

function CoordinatorTable({
  allocations,
  shelters,
  resources,
  busy,
  onStatus,
  onDetails,
  onReceipt,
  receiptQuantities,
  onReceiptQuantity,
}: Omit<ComponentProps<typeof AllocationRows>, 'view'>) {
  if (allocations.length === 0) {
    return <EmptyState title="No incoming deliveries" description="There are no allocated or dispatched deliveries for this shelter." />;
  }
  return (
    <AllocationRows
      allocations={allocations}
      shelters={shelters}
      resources={resources}
      view="coordinator"
      busy={busy}
      onStatus={onStatus}
      onDetails={onDetails}
      onReceipt={onReceipt}
      receiptQuantities={receiptQuantities}
      onReceiptQuantity={onReceiptQuantity}
    />
  );
}

function AllocationRows({
  allocations,
  shelters,
  resources,
  view,
  busy,
  onStatus,
  onDetails,
  onReceipt,
  receiptQuantities,
  onReceiptQuantity,
}: {
  allocations: ReliefAllocation[];
  shelters: Shelter[];
  resources: ReliefResource[];
  view: 'officer' | 'coordinator';
  busy: boolean;
  onStatus: (allocation: ReliefAllocation, status: ReliefAllocationStatus) => void;
  onDetails: (allocation: ReliefAllocation) => void;
  onReceipt: (allocation: ReliefAllocation) => void;
  receiptQuantities: Record<string, string>;
  onReceiptQuantity: (id: string, value: string) => void;
}) {
  const shelterName = (allocation: ReliefAllocation) =>
    shelters.find((shelter) => shelter._id === relatedId(allocation.shelter))?.name || 'Unknown shelter';
  const resourceFor = (allocation: ReliefAllocation) =>
    resources.find((resource) => resource._id === relatedId(allocation.resource));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Shelter / resource</TableHead>
          <TableHead>Requested / allocated</TableHead>
          <TableHead>Delivered</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {allocations.map((allocation) => {
          const resource = resourceFor(allocation);
          return (
            <TableRow key={allocation._id}>
              <TableCell><p className="font-medium">{shelterName(allocation)}</p><p className="text-gray-500">{resource?.name || 'Unknown resource'}</p></TableCell>
              <TableCell>{allocation.requestedQuantity} / {allocation.allocatedQuantity} {resource?.unit}</TableCell>
              <TableCell>{allocation.deliveredQuantity} {resource?.unit}</TableCell>
              <TableCell><Badge variant={statusVariant(allocation.status)}>{displayStatus(allocation.status)}</Badge></TableCell>
              <TableCell>
                <div className="flex min-w-[220px] flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onDetails(allocation)}>Details</Button>
                  {allocation.status === 'ALLOCATED' && view === 'officer' && (
                    <Button type="button" size="sm" disabled={busy} onClick={() => onStatus(allocation, 'DISPATCHED')}>
                      <Truck className="mr-1 h-4 w-4" /> Dispatch
                    </Button>
                  )}
                  {allocation.status === 'DISPATCHED' && view === 'coordinator' && (
                    <>
                      <Input
                        aria-label={`Received quantity for ${resource?.name || 'allocation'}`}
                        type="number"
                        min="1"
                        max={allocation.allocatedQuantity}
                        step="1"
                        className="w-24"
                        value={receiptQuantities[allocation._id] ?? String(allocation.allocatedQuantity)}
                        onChange={(event) => onReceiptQuantity(allocation._id, event.target.value)}
                      />
                      <Button type="button" size="sm" disabled={busy} onClick={() => onReceipt(allocation)}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Confirm receipt
                      </Button>
                    </>
                  )}
                  {allocation.status === 'RECEIVED' && view === 'officer' && (
                    <Button type="button" size="sm" disabled={busy} onClick={() => onStatus(allocation, 'COMPLETED')}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Complete
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
