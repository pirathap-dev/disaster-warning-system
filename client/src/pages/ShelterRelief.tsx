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

type Workspace = 'officer' | 'coordinator';

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
  const [workspace, setWorkspace] = useState<Workspace>('officer');
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [resources, setResources] = useState<ReliefResource[]>([]);
  const [allocations, setAllocations] = useState<ReliefAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shelterId, setShelterId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [coordinatorShelterId, setCoordinatorShelterId] = useState('');
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
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
  const selectedResource = resources.find((resource) => resource._id === resourceId);
  const requestedQuantity = Number(quantity);
  const matchingActiveAllocations = useMemo(
    () => allocations.filter((allocation) =>
      relatedId(allocation.shelter) === shelterId &&
      relatedId(allocation.resource) === resourceId &&
      activeStatuses.includes(allocation.status)
    ),
    [allocations, shelterId, resourceId]
  );
  const coordinatorShelter = coordinatorShelterId || shelters[0]?._id || '';
  const incomingAllocations = allocations.filter((allocation) =>
    relatedId(allocation.shelter) === coordinatorShelter &&
    (allocation.status === 'ALLOCATED' || allocation.status === 'DISPATCHED')
  );

  async function submitAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedShelter || !selectedResource || !Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
      toast('Select a shelter and resource, and enter a positive whole-number quantity.', 'error');
      return;
    }
    if (requestedQuantity > selectedResource.availableQuantity) {
      toast(`Only ${selectedResource.availableQuantity} ${selectedResource.unit} are available.`, 'error');
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
        resourceId,
        requestedQuantity,
        createdBy: createdBy.trim(),
        notes: notes.trim() || undefined,
      });
      toast('Allocation created and inventory reserved.', 'success');
      setQuantity('');
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

                  <Select
                    label="Relief resource"
                    aria-label="Relief resource"
                    value={resourceId}
                    onChange={(event) => setResourceId(event.target.value)}
                    options={resources.map((resource) => ({
                      value: resource._id,
                      label: `${resource.name} (${resource.availableQuantity} ${resource.unit} available)`,
                    }))}
                  />
                  {selectedResource && (
                    <div className="rounded-md bg-gray-50 p-3 text-sm">
                      <p><span className="text-gray-500">Category:</span> {selectedResource.category}</p>
                      <p><span className="text-gray-500">Available:</span> {selectedResource.availableQuantity.toLocaleString()} {selectedResource.unit}</p>
                    </div>
                  )}
                  <Input
                    label="Quantity"
                    aria-label="Allocation quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    error={quantity && (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) ? 'Enter a positive whole number.' : undefined}
                  />
                  {selectedResource && requestedQuantity > selectedResource.availableQuantity && (
                    <Notice tone="danger">Insufficient inventory. Only {selectedResource.availableQuantity} {selectedResource.unit} are available.</Notice>
                  )}
                  {matchingActiveAllocations.length > 0 && (
                    <Notice tone="warning">
                      {matchingActiveAllocations.length} active allocation{matchingActiveAllocations.length === 1 ? '' : 's'} already exist for this shelter and resource. Check for overlapping deliveries.
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
                    disabled={submitting || !shelterId || !resourceId || !Number.isInteger(requestedQuantity) ||
                      requestedQuantity <= 0 || !createdBy.trim() ||
                      requestedQuantity > (selectedResource?.availableQuantity ?? 0) ||
                      selectedShelter?.status === 'CLOSED'}
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
            onDetails={setDetailsAllocation}
            onReceipt={confirmReceipt}
            receiptQuantities={receiptQuantities}
            onReceiptQuantity={(id, value) => setReceiptQuantities((current) => ({ ...current, [id]: value }))}
          />
        </>
      ) : (
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
