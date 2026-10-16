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
  Minus,
  PackageCheck,
  Plus,
  Trash2,
  X,
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
import {
  reliefApi,
  type ReliefAllocation,
  type ReliefAllocationStatus,
  type ReliefResource,
  type Shelter,
} from '../types/relief';

type Workspace = 'officer' | 'coordinator' | 'dmc' | 'admin';

const activeStatuses: ReliefAllocationStatus[] = ['REQUESTED', 'ALLOCATED', 'DISPATCHED'];
const facilityChoices = [
  'Drinking water',
  'Food',
  'Medical care',
  'Toilets',
  'Electricity',
  'Bedding',
  'Accessible access',
];

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
      <div><dt className="text-sm text-gray-500">Expected people arriving</dt><dd>{allocation.peopleExpected ?? 0}</dd></div>
      <div><dt className="text-sm text-gray-500">Created by</dt><dd>{allocation.createdBy}</dd></div>
      <div><dt className="text-sm text-gray-500">Created</dt><dd>{new Date(allocation.createdAt).toLocaleString()}</dd></div>
      <div><dt className="text-sm text-gray-500">Last updated</dt><dd>{new Date(allocation.updatedAt).toLocaleString()}</dd></div>
      {allocation.notes && <div className="sm:col-span-2"><dt className="text-sm text-gray-500">Notes</dt><dd>{allocation.notes}</dd></div>}
    </dl>
  );
}

export default function ShelterRelief() {
  const { toast } = useToast();
  const [workspace, setWorkspace] = useState<Workspace>('officer');
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [resources, setResources] = useState<ReliefResource[]>([]);
  const [allocations, setAllocations] = useState<ReliefAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shelterId, setShelterId] = useState('');
  const [allocationQuantities, setAllocationQuantities] = useState<Record<string, string>>({});
  const [peopleExpected, setPeopleExpected] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [newShelterName, setNewShelterName] = useState('');
  const [newShelterLocation, setNewShelterLocation] = useState('');
  const [newShelterCapacity, setNewShelterCapacity] = useState('');
  const [newShelterFacilities, setNewShelterFacilities] = useState<string[]>([]);
  const [coordinatorShelterId, setCoordinatorShelterId] = useState('');
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [receiptPeople, setReceiptPeople] = useState<Record<string, string>>({});
  const [detailsAllocation, setDetailsAllocation] = useState<ReliefAllocation | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [nextShelters, nextResources, nextAllocations] = await Promise.all([
        reliefApi.getShelters(),
        reliefApi.getResources(),
        reliefApi.getAllocations(),
      ]);
      setShelters(nextShelters);
      setResources(nextResources);
      setAllocations(nextAllocations);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load shelter and relief data';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedShelter = shelters.find((shelter) => shelter._id === shelterId);
  const selectedAllocationItems = Object.entries(allocationQuantities)
    .filter(([, value]) => value !== undefined)
    .map(([resourceId, value]) => ({
      resourceId,
      requestedQuantity: Number(value),
    }));
  const selectedAllocationResources = selectedAllocationItems.map((item) => ({
    ...item,
    resource: resources.find((resource) => resource._id === item.resourceId),
  }));
  const expectedPeople = peopleExpected === '' ? 0 : Number(peopleExpected);
  const matchingActiveAllocations = useMemo(
    () => allocations.filter((allocation) =>
      relatedId(allocation.shelter) === shelterId &&
      Object.keys(allocationQuantities).some((id) => relatedId(allocation.resource) === id) &&
      activeStatuses.includes(allocation.status)
    ),
    [allocations, shelterId, allocationQuantities]
  );
  const coordinatorShelter = coordinatorShelterId || shelters[0]?._id || '';
  const incomingAllocations = allocations.filter((allocation) =>
    relatedId(allocation.shelter) === coordinatorShelter &&
    (allocation.status === 'ALLOCATED' || allocation.status === 'DISPATCHED')
  );

  async function submitAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedShelter || selectedAllocationItems.length === 0 ||
        selectedAllocationItems.some((item) => !Number.isInteger(item.requestedQuantity) || item.requestedQuantity <= 0)) {
      toast('Select a shelter and at least one resource, and enter positive whole-number quantities.', 'error');
      return;
    }
    if (!Number.isInteger(expectedPeople) || expectedPeople < 0 ||
        expectedPeople > (selectedShelter?.availableCapacity ?? 0)) {
      toast('People arriving must be a whole number within the shelter available capacity.', 'error');
      return;
    }
    const insufficientResource = selectedAllocationResources.find(({ resource, requestedQuantity }) =>
      !resource || requestedQuantity > resource.availableQuantity
    );
    if (insufficientResource?.resource) {
      toast(`Only ${insufficientResource.resource.availableQuantity} ${insufficientResource.resource.unit} of ${insufficientResource.resource.name} are available.`, 'error');
      return;
    }
    if (!createdBy.trim()) {
      toast('Enter the officer name for the allocation record.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await reliefApi.createAllocation({
        shelterId,
        items: selectedAllocationItems,
        createdBy: createdBy.trim(),
        notes: notes.trim() || undefined,
        peopleExpected: expectedPeople,
      });
      toast('Allocation created and inventory reserved.', 'success');
      setAllocationQuantities({});
      setPeopleExpected('');
      setNotes('');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create allocation', 'error');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  async function submitShelter(event: FormEvent<HTMLFormElement>) {
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
        facilities: newShelterFacilities,
      });
      toast('Shelter location added.', 'success');
      setNewShelterName('');
      setNewShelterLocation('');
      setNewShelterCapacity('');
      setNewShelterFacilities([]);
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not add shelter', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(allocation: ReliefAllocation, status: ReliefAllocationStatus) {
    setSubmitting(true);
    try {
      await reliefApi.updateStatus(allocation._id, status);
      toast(
        status === 'CANCELLED'
          ? 'Allocation removed and reserved inventory restored.'
          : `Allocation marked ${displayStatus(status).toLowerCase()}.`,
        'success'
      );
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update allocation status', 'error');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  async function clearShelterOccupancy(shelter: Shelter) {
    if (shelter.currentOccupancy === 0) return;
    const confirmed = window.confirm(
      `Empty ${shelter.name} by changing its recorded occupancy from ${shelter.currentOccupancy} to 0? ` +
      'Shelter and relief-allocation records will be kept.'
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await reliefApi.clearShelterOccupancy(shelter._id);
      toast(`Occupancy cleared for ${shelter.name}. Shelter and relief-allocation records were kept.`, 'success');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not clear shelter occupancy', 'error');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteAllocation(allocation: ReliefAllocation) {
    const resource = resources.find((item) => item._id === relatedId(allocation.resource));
    const shelter = shelters.find((item) => item._id === relatedId(allocation.shelter));
    const label = `${resource?.name || 'resource'} for ${shelter?.name || 'shelter'}`;
    if (!window.confirm(`Permanently delete the cancelled allocation for ${label}?`)) return;

    setSubmitting(true);
    try {
      await reliefApi.deleteAllocation(allocation._id);
      toast('Cancelled allocation permanently deleted.', 'success');
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete allocation', 'error');
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
    const expectedPeople = allocation.peopleExpected ?? 0;
    const receivedPeople = Number(receiptPeople[allocation._id] ?? expectedPeople);
    if (!Number.isInteger(receivedPeople) || receivedPeople < 0 || receivedPeople > expectedPeople) {
      toast(`Enter a whole number from 0 to ${expectedPeople}.`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      await reliefApi.confirmReceipt(
        allocation._id,
        receivedQuantity,
        undefined,
        receivedPeople
      );
      toast(
        expectedPeople > 0
          ? `Allocation approved. ${receivedPeople} people added to shelter occupancy.`
          : 'Receipt confirmed.',
        'success'
      );
      await loadData();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not confirm receipt', 'error');
      await loadData();
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
        <div className="flex gap-2" role="tablist" aria-label="Relief operations workspace">
          <Button
            type="button"
            variant={workspace === 'officer' ? 'primary' : 'secondary'}
            onClick={() => setWorkspace('officer')}
            role="tab"
            aria-selected={workspace === 'officer'}
          >
            District Officer
          </Button>
          <Button
            type="button"
            variant={workspace === 'coordinator' ? 'primary' : 'secondary'}
            onClick={() => setWorkspace('coordinator')}
            role="tab"
            aria-selected={workspace === 'coordinator'}
          >
            Shelter Coordinator
          </Button>
          <Button
            type="button"
            variant={workspace === 'dmc' ? 'primary' : 'secondary'}
            onClick={() => setWorkspace('dmc')}
            role="tab"
            aria-selected={workspace === 'dmc'}
          >
            DMC Officer
          </Button>
          <Button
            type="button"
            variant={workspace === 'admin' ? 'primary' : 'secondary'}
            onClick={() => setWorkspace('admin')}
            role="tab"
            aria-selected={workspace === 'admin'}
          >
            Admin
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {loadError} <button className="ml-2 font-semibold underline" onClick={() => void loadData()}>Retry</button>
        </div>
      )}

      {workspace === 'officer' ? (
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
            <CardHeader><CardTitle>Shelter capacity</CardTitle></CardHeader>
            <CardContent>
              {shelters.length === 0 ? (
                <EmptyState title="No shelters available" description="Shelter records will appear here when they are added to the system." />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {shelters.map((shelter) => (
                    <div key={shelter._id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{shelter.name}</h3>
                          <p className="text-sm text-gray-500">{shelter.location}</p>
                          {shelter.facilities.length > 0 && (
                            <p className="mt-1 text-xs text-gray-500">Facilities: {shelter.facilities.join(', ')}</p>
                          )}
                        </div>
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
                  {selectedShelter?.capacityStatus === 'NEAR_FULL' && (
                    <Notice tone="warning">This shelter is near capacity. Verify it can receive additional supplies.</Notice>
                  )}
                  {selectedShelter?.capacityStatus === 'FULL' && (
                    <Notice tone="danger">This shelter is full for new arrivals. Resource deliveries can still be allocated.</Notice>
                  )}
                  {selectedShelter?.status === 'CLOSED' && (
                    <Notice tone="danger">This shelter is closed and cannot receive allocations.</Notice>
                  )}
                  <Input
                    label="Expected people arriving (optional)"
                    aria-label="Expected people arriving"
                    type="number"
                    min="0"
                    max={selectedShelter?.availableCapacity ?? 0}
                    step="1"
                    value={peopleExpected}
                    onChange={(event) => setPeopleExpected(event.target.value)}
                    error={peopleExpected !== '' &&
                      (!Number.isInteger(expectedPeople) || expectedPeople < 0)
                      ? 'Enter a non-negative whole number.'
                      : expectedPeople > (selectedShelter?.availableCapacity ?? 0)
                        ? `Only ${selectedShelter?.availableCapacity ?? 0} places are available.`
                        : undefined}
                  />
                  {expectedPeople > 0 && (
                    <p className="text-sm text-gray-500">
                      Planning only. Occupancy and its percentage stay unchanged until actual arrivals are recorded by the Shelter Coordinator.
                    </p>
                  )}

                  <fieldset className="space-y-3">
                    <legend className="mb-1 text-sm font-medium text-gray-700">Relief resources</legend>
                    {resources.length === 0 ? (
                      <p className="text-sm text-gray-500">No resources are available to allocate.</p>
                    ) : resources.map((resource) => {
                      const isSelected = Object.prototype.hasOwnProperty.call(allocationQuantities, resource._id);
                      const requestedQuantity = Number(allocationQuantities[resource._id]);
                      return (
                        <div key={resource._id} className="rounded-lg border border-gray-200 p-3">
                          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                            <input
                              type="checkbox"
                              aria-label={`Select ${resource.name}`}
                              checked={isSelected}
                              disabled={resource.availableQuantity < 1}
                              onChange={(event) => setAllocationQuantities((current) => {
                                const next = { ...current };
                                if (event.target.checked) next[resource._id] = '1';
                                else delete next[resource._id];
                                return next;
                              })}
                            />
                            {resource.name}
                            <span className="font-normal text-gray-500">
                              ({resource.availableQuantity.toLocaleString()} {resource.unit} available)
                            </span>
                            {resource.availableQuantity < 1 && (
                              <span className="font-normal text-red-700">Out of stock</span>
                            )}
                          </label>
                          {isSelected && (
                            <div className="mt-3 flex items-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                aria-label={`Remove ${resource.name} from allocation`}
                                onClick={() => setAllocationQuantities((current) => {
                                  const next = { ...current };
                                  delete next[resource._id];
                                  return next;
                                })}
                              >
                                <X className="h-4 w-4" />
                                <span className="ml-1">Remove</span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                aria-label={`Decrease ${resource.name} quantity`}
                                disabled={requestedQuantity <= 1}
                                onClick={() => setAllocationQuantities((current) => ({
                                  ...current,
                                  [resource._id]: String(Math.max(1, requestedQuantity - 1)),
                                }))}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                label={`Amount (${resource.unit})`}
                                aria-label={`Quantity for ${resource.name}`}
                                type="number"
                                min="1"
                                max={resource.availableQuantity}
                                step="1"
                                value={allocationQuantities[resource._id]}
                                className="max-w-36 text-center"
                                onChange={(event) => setAllocationQuantities((current) => ({
                                  ...current,
                                  [resource._id]: event.target.value,
                                }))}
                                error={allocationQuantities[resource._id] &&
                                  (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0)
                                  ? 'Enter a positive whole number.'
                                  : requestedQuantity > resource.availableQuantity
                                    ? `Only ${resource.availableQuantity} ${resource.unit} are available.`
                                    : undefined}
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                aria-label={`Increase ${resource.name} quantity`}
                                disabled={requestedQuantity >= resource.availableQuantity}
                                onClick={() => setAllocationQuantities((current) => ({
                                  ...current,
                                  [resource._id]: String(Math.min(resource.availableQuantity, requestedQuantity + 1)),
                                }))}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <span className="pb-2 text-sm text-gray-500">
                                max {resource.availableQuantity.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </fieldset>
                  {matchingActiveAllocations.length > 0 && (
                    <Notice tone="warning">
                      Active allocation{matchingActiveAllocations.length === 1 ? '' : 's'} already exist for this shelter and one or more selected resources. Check for overlapping deliveries.
                    </Notice>
                  )}
                  <Input
                    label="Officer name"
                    aria-label="Officer name"
                    value={createdBy}
                    onChange={(event) => setCreatedBy(event.target.value)}
                    maxLength={120}
                    placeholder="Name recorded on the allocation"
                  />
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
                    disabled={submitting || !shelterId || selectedAllocationItems.length === 0 ||
                      selectedAllocationResources.some(({ resource, requestedQuantity }) =>
                        !resource || !Number.isInteger(requestedQuantity) || requestedQuantity <= 0 ||
                        requestedQuantity > resource.availableQuantity
                      ) || !createdBy.trim() ||
                      selectedShelter?.status === 'CLOSED' ||
                      !Number.isInteger(expectedPeople) || expectedPeople < 0 ||
                      expectedPeople > (selectedShelter?.availableCapacity ?? 0)}
                  >
                    {submitting ? 'Saving...' : 'Create allocation'}
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
            onDelete={deleteAllocation}
            onDetails={setDetailsAllocation}
            onReceipt={confirmReceipt}
            receiptQuantities={receiptQuantities}
            onReceiptQuantity={(id, value) => setReceiptQuantities((current) => ({ ...current, [id]: value }))}
            receiptPeople={receiptPeople}
            onReceiptPeople={(id, value) => setReceiptPeople((current) => ({ ...current, [id]: value }))}
          />
        </>
      ) : workspace === 'coordinator' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              icon={<ClipboardList className="h-5 w-5" />}
              label="People sheltered"
              value={shelters.reduce((sum, shelter) => sum + shelter.currentOccupancy, 0).toLocaleString()}
            />
            <SummaryCard
              icon={<Home className="h-5 w-5" />}
              label="Total shelter capacity"
              value={shelters.reduce((sum, shelter) => sum + shelter.capacity, 0).toLocaleString()}
            />
            <SummaryCard
              icon={<Home className="h-5 w-5" />}
              label="Available places"
              value={shelters.reduce((sum, shelter) => sum + shelter.availableCapacity, 0).toLocaleString()}
            />
          </div>
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
                onDelete={deleteAllocation}
                onDetails={setDetailsAllocation}
                onReceipt={confirmReceipt}
                receiptQuantities={receiptQuantities}
                onReceiptQuantity={(id, value) => setReceiptQuantities((current) => ({ ...current, [id]: value }))}
                receiptPeople={receiptPeople}
                onReceiptPeople={(id, value) => setReceiptPeople((current) => ({ ...current, [id]: value }))}
              />
            </CardContent>
          </Card>
        </>
      ) : workspace === 'admin' ? (
        <Card>
          <CardHeader>
            <CardTitle>Shelter occupancy administration</CardTitle>
            <p className="text-sm text-gray-500">
              Empty a shelter after confirming all occupants have left. Shelter and relief-allocation records are retained.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Notice tone="warning">
              Admin access is not protected by sign-in yet. This workspace is available to anyone using the application.
            </Notice>
            {shelters.length === 0 ? (
              <EmptyState title="No shelters available" description="Shelters will appear here when they are registered." />
            ) : (
              <div className="space-y-3">
                {shelters.map((shelter) => (
                  <div key={shelter._id} className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="font-semibold text-gray-900">{shelter.name}</h3>
                      <p className="text-sm text-gray-500">{shelter.location}</p>
                      <p className="mt-1 text-sm text-gray-700">
                        {shelter.currentOccupancy.toLocaleString()} of {shelter.capacity.toLocaleString()} people recorded
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={submitting || shelter.currentOccupancy === 0}
                      onClick={() => void clearShelterOccupancy(shelter)}
                    >
                      Empty shelter
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Add shelter location</CardTitle>
            <p className="text-sm text-gray-500">Register a shelter and its maximum capacity and available facilities.</p>
          </CardHeader>
          <CardContent>
            <form className="max-w-2xl space-y-4" onSubmit={submitShelter}>
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
                label="Maximum capacity (people)"
                aria-label="Maximum capacity"
                type="number"
                min="1"
                step="1"
                value={newShelterCapacity}
                onChange={(event) => setNewShelterCapacity(event.target.value)}
                required
              />
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-gray-700">Available facilities</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {facilityChoices.map((facility) => (
                    <label key={facility} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        aria-label={facility}
                        checked={newShelterFacilities.includes(facility)}
                        onChange={(event) => setNewShelterFacilities((current) =>
                          event.target.checked
                            ? [...current, facility]
                            : current.filter((value) => value !== facility)
                        )}
                      />
                      {facility}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Add shelter'}
              </Button>
            </form>
          </CardContent>
        </Card>
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
  onDelete,
  onDetails,
  onReceipt,
  receiptQuantities,
  onReceiptQuantity,
  receiptPeople,
  onReceiptPeople,
}: {
  allocations: ReliefAllocation[];
  shelters: Shelter[];
  resources: ReliefResource[];
  view: 'officer';
  busy: boolean;
  onStatus: (allocation: ReliefAllocation, status: ReliefAllocationStatus) => void;
  onDelete: (allocation: ReliefAllocation) => void;
  onDetails: (allocation: ReliefAllocation) => void;
  onReceipt: (allocation: ReliefAllocation) => void;
  receiptQuantities: Record<string, string>;
  onReceiptQuantity: (id: string, value: string) => void;
  receiptPeople: Record<string, string>;
  onReceiptPeople: (id: string, value: string) => void;
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
            onDelete={onDelete}
            onDetails={onDetails}
            onReceipt={onReceipt}
            receiptQuantities={receiptQuantities}
            onReceiptQuantity={onReceiptQuantity}
            receiptPeople={receiptPeople}
            onReceiptPeople={onReceiptPeople}
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
  onDelete,
  onDetails,
  onReceipt,
  receiptQuantities,
  onReceiptQuantity,
  receiptPeople,
  onReceiptPeople,
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
      onDelete={onDelete}
      onDetails={onDetails}
      onReceipt={onReceipt}
      receiptQuantities={receiptQuantities}
      onReceiptQuantity={onReceiptQuantity}
      receiptPeople={receiptPeople}
      onReceiptPeople={onReceiptPeople}
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
  onDelete,
  onDetails,
  onReceipt,
  receiptQuantities,
  onReceiptQuantity,
  receiptPeople,
  onReceiptPeople,
}: {
  allocations: ReliefAllocation[];
  shelters: Shelter[];
  resources: ReliefResource[];
  view: 'officer' | 'coordinator';
  busy: boolean;
  onStatus: (allocation: ReliefAllocation, status: ReliefAllocationStatus) => void;
  onDelete: (allocation: ReliefAllocation) => void;
  onDetails: (allocation: ReliefAllocation) => void;
  onReceipt: (allocation: ReliefAllocation) => void;
  receiptQuantities: Record<string, string>;
  onReceiptQuantity: (id: string, value: string) => void;
  receiptPeople: Record<string, string>;
  onReceiptPeople: (id: string, value: string) => void;
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
              <TableCell>
                <p className="font-medium">{shelterName(allocation)}</p>
                <p className="text-gray-500">{resource?.name || 'Unknown resource'}</p>
                {(allocation.peopleExpected ?? 0) > 0 && (
                  <p className="text-xs text-gray-500">{allocation.peopleExpected} people arriving</p>
                )}
              </TableCell>
              <TableCell>{allocation.requestedQuantity} / {allocation.allocatedQuantity} {resource?.unit}</TableCell>
              <TableCell>{allocation.deliveredQuantity} {resource?.unit}</TableCell>
              <TableCell><Badge variant={statusVariant(allocation.status)}>{displayStatus(allocation.status)}</Badge></TableCell>
              <TableCell>
                <div className="flex min-w-[220px] flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onDetails(allocation)}>Details</Button>
                  {allocation.status === 'ALLOCATED' && view === 'officer' && (
                    <>
                      <Button type="button" size="sm" disabled={busy} onClick={() => onStatus(allocation, 'DISPATCHED')}>
                        <Truck className="mr-1 h-4 w-4" /> Dispatch
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        aria-label={`Remove allocation for ${shelterName(allocation)} - ${resource?.name || 'resource'}`}
                        onClick={() => onStatus(allocation, 'CANCELLED')}
                      >
                        <Trash2 className="mr-1 h-4 w-4" /> Remove
                      </Button>
                    </>
                  )}
                  {allocation.status === 'DISPATCHED' && view === 'coordinator' && (
                    <>
                      <Input
                        label={`Received ${resource?.unit || 'quantity'}`}
                        aria-label={`Received quantity for ${resource?.name || 'allocation'}`}
                        type="number"
                        min="1"
                        max={allocation.allocatedQuantity}
                        step="1"
                        className="w-28"
                        value={receiptQuantities[allocation._id] ?? String(allocation.allocatedQuantity)}
                        onChange={(event) => onReceiptQuantity(allocation._id, event.target.value)}
                      />
                      {(allocation.peopleExpected ?? 0) > 0 && (
                        <Input
                          label={`People received (expected ${allocation.peopleExpected})`}
                          aria-label={`People received for ${shelterName(allocation)}`}
                          type="number"
                          min="0"
                          max={allocation.peopleExpected}
                          step="1"
                          className="w-28"
                          value={receiptPeople[allocation._id] ?? String(allocation.peopleExpected)}
                          onChange={(event) => onReceiptPeople(allocation._id, event.target.value)}
                        />
                      )}
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
                  {allocation.status === 'CANCELLED' && view === 'officer' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      aria-label={`Delete cancelled allocation for ${shelterName(allocation)} - ${resource?.name || 'resource'}`}
                      onClick={() => onDelete(allocation)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" /> Delete
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
