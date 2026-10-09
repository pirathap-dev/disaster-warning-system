import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  PlusCircle,
  Radio,
  MapPin,
  CheckCircle2,
  Users,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Loading } from '../components/ui/Loading';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { useToast } from '../components/ui/Toast';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';

import { warningApi, ApiError } from '../services/api';
import {
  IHazard,
  IWarning,
  WarningLevel,
  WarningStatus,
  IWarningDeliverySummary,
  INotificationRecord,
} from '../types';

import { HazardDashboard } from './warnings/HazardDashboard';
import { WarningForm, WarningFormData } from './warnings/WarningForm';
import { WarningPreviewModal } from './warnings/WarningPreviewModal';
import { WarningDetailsModal } from './warnings/WarningDetailsModal';
import { NotificationTrackingView } from './warnings/NotificationTrackingView';

export default function Warnings() {
  const { toast } = useToast();

  // Navigation & View States
  const [activeTab, setActiveTab] = useState<'hazards' | 'warnings' | 'create' | 'tracking'>('warnings');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Data States
  const [hazards, setHazards] = useState<IHazard[]>([]);
  const [warnings, setWarnings] = useState<IWarning[]>([]);
  const [selectedHazardForForm, setSelectedHazardForForm] = useState<IHazard | null>(null);

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Details States
  const [previewData, setPreviewData] = useState<WarningFormData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  const [inspectingWarning, setInspectingWarning] = useState<IWarning | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  // Tracking View State
  const [trackingWarning, setTrackingWarning] = useState<IWarning | null>(null);
  const [trackingData, setTrackingData] = useState<{
    summary?: IWarningDeliverySummary;
    notifications: INotificationRecord[];
  }>({ notifications: [] });
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Load Initial Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hazardsRes, warningsRes] = await Promise.all([
        warningApi.getVerifiedHazards(),
        warningApi.getWarnings(),
      ]);
      setHazards(hazardsRes);
      setWarnings(warningsRes);
    } catch (err: unknown) {
      console.error('Failed to load warning module data:', err);
      const message = err instanceof Error ? err.message : 'Unable to establish connection with emergency warning server.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Hazard Selection from Dashboard
  const handleSelectHazardForWarning = (hazard: IHazard) => {
    setSelectedHazardForForm(hazard);
    setActiveTab('create');
  };

  // Open Notification Tracking View
  const handleOpenTracking = useCallback(async (warning: IWarning) => {
    setTrackingWarning(warning);
    setActiveTab('tracking');
    try {
      const data = await warningApi.getNotifications(warning._id || warning.id!);
      setTrackingData({
        summary: data.summary,
        notifications: data.notifications || [],
      });
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to load notification tracking data.';
      toast(message, 'error');
    }
  }, [toast]);

  // Handle Save Draft from Form
  const handleSaveDraft = async (formData: WarningFormData) => {
    setIsPublishing(true);
    try {
      const created = await warningApi.createWarning({
        ...formData,
        status: WarningStatus.DRAFT,
      });
      toast(`Warning draft '${created.warningId}' saved successfully.`, 'success');
      setActiveTab('warnings');
      setSelectedHazardForForm(null);
      await fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save warning draft.';
      toast(message, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = (formData: WarningFormData) => {
    setPreviewData(formData);
    setIsPreviewOpen(true);
  };

  // Confirm Publish from Preview Modal
  const handleConfirmPublish = async () => {
    if (!previewData) return;
    setIsPublishing(true);
    try {
      const created = await warningApi.createWarning({
        ...previewData,
        status: WarningStatus.PUBLISHED,
      });
      toast(`Public warning '${created.warningId}' published and dispatched!`, 'success');
      setIsPreviewOpen(false);
      setPreviewData(null);
      setSelectedHazardForForm(null);
      setActiveTab('warnings');
      await fetchData();

      // Automatically open tracking for the newly published warning
      handleOpenTracking(created);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to publish public warning.';
      toast(message, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle Lifecycle Status Transitions
  const handleStatusChange = async (newStatus: WarningStatus, reason?: string) => {
    if (!inspectingWarning) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await warningApi.updateStatus(inspectingWarning._id || inspectingWarning.id!, newStatus, reason);
      toast(`Warning '${updated.warningId}' transitioned to ${newStatus}.`, 'success');
      setInspectingWarning(updated);
      await fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to transition warning status to ${newStatus}.`;
      toast(message, 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Simulate Delivery Progression
  const handleSimulateDelivery = async () => {
    if (!trackingWarning) return;
    setIsSimulating(true);
    try {
      const res = await warningApi.simulateNotifications(trackingWarning._id || trackingWarning.id!);
      toast(`Simulated ${res.updatedCount} live notification transmissions.`, 'info');
      // Refresh notifications
      const refreshed = await warningApi.getNotifications(trackingWarning._id || trackingWarning.id!);
      setTrackingData({
        summary: refreshed.summary,
        notifications: refreshed.notifications || [],
      });
      await fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to simulate notification delivery.';
      toast(message, 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  // Filtered Warnings
  const filteredWarnings = warnings.filter((w) => {
    if (statusFilter !== 'ALL' && w.status !== statusFilter) return false;
    if (levelFilter !== 'ALL' && w.warningLevel !== levelFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = w.warningId.toLowerCase().includes(q);
      const matchArea = w.affectedArea.toLowerCase().includes(q);
      const matchMsg = w.message.toLowerCase().includes(q);
      if (!matchId && !matchArea && !matchMsg) return false;
    }
    return true;
  });

  const getStatusBadge = (status: WarningStatus) => {
    switch (status) {
      case WarningStatus.ACTIVE:
        return <Badge variant="success">ACTIVE</Badge>;
      case WarningStatus.PUBLISHED:
        return <Badge variant="info">PUBLISHED</Badge>;
      case WarningStatus.UPDATED:
        return <Badge variant="warning">UPDATED</Badge>;
      case WarningStatus.DRAFT:
        return <Badge variant="default">DRAFT</Badge>;
      case WarningStatus.EXPIRED:
        return <Badge variant="default" className="bg-gray-200 text-gray-700">EXPIRED</Badge>;
      case WarningStatus.CANCELLED:
        return <Badge variant="danger">CANCELLED</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getLevelBadge = (level: WarningLevel) => {
    switch (level) {
      case WarningLevel.EVACUATE:
        return <Badge variant="danger">EVACUATE</Badge>;
      case WarningLevel.WARNING:
        return <Badge variant="warning">WARNING</Badge>;
      case WarningLevel.WATCH:
        return <Badge variant="info">WATCH</Badge>;
      default:
        return <Badge variant="default">{level}</Badge>;
    }
  };

  // Aggregate stats
  const activeCount = warnings.filter((w) => w.status === WarningStatus.ACTIVE || w.status === WarningStatus.UPDATED).length;
  const publishedCount = warnings.filter((w) => w.status === WarningStatus.PUBLISHED).length;
  const totalDelivered = warnings.reduce((sum, w) => sum + (w.deliverySummary?.delivered || 0), 0);

  if (loading) {
    return (
      <div className="py-20">
        <Loading text="Initializing Disaster Warning & Public Notification System..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <ErrorState
          title="Emergency Warning Console Error"
          message={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Role Indicator */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-brand-50 rounded-lg text-brand-600">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
              Official DMC Duty Officer Interface
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Hazard Assessment & Public Warning System
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Assess verified field hazards, configure geo-targeted multi-channel warnings, and track delivery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              setSelectedHazardForForm(null);
              setActiveTab('create');
            }}
            className="flex items-center gap-2 shadow-sm font-semibold"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Issue New Warning</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-gray-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Active Warnings</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{activeCount}</p>
              <p className="text-[11px] text-emerald-600 font-medium">In force across regions</p>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Awaiting Activation</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{publishedCount}</p>
              <p className="text-[11px] text-blue-600 font-medium">Published / Dispatched</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Radio className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Citizens Alerted</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalDelivered}</p>
              <p className="text-[11px] text-emerald-600 font-medium">Confirmed receptions</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Verified Hazards</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{hazards.length}</p>
              <p className="text-[11px] text-indigo-600 font-medium">Assessed intelligence</p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4 rounded-xl shadow-2xs">
        <button
          onClick={() => setActiveTab('warnings')}
          className={`py-3.5 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'warnings'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span>Active & Issued Warnings</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 font-bold">
            {warnings.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('hazards')}
          className={`py-3.5 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'hazards'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span>Hazard Assessment Feed</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 font-bold">
            {hazards.length}
          </span>
        </button>

        {activeTab === 'create' && (
          <button
            onClick={() => setActiveTab('create')}
            className="py-3.5 px-4 font-semibold text-sm border-b-2 border-brand-600 text-brand-600 flex items-center gap-2"
          >
            <span>Author Warning Alert</span>
          </button>
        )}

        {activeTab === 'tracking' && trackingWarning && (
          <button
            onClick={() => setActiveTab('tracking')}
            className="py-3.5 px-4 font-semibold text-sm border-b-2 border-brand-600 text-brand-600 flex items-center gap-2"
          >
            <Radio className="w-4 h-4 text-brand-600" />
            <span>Tracking: {trackingWarning.warningId}</span>
          </button>
        )}
      </div>

      {/* TAB 1: HAZARDS DASHBOARD */}
      {activeTab === 'hazards' && (
        <HazardDashboard
          hazards={hazards}
          onSelectHazardForWarning={handleSelectHazardForWarning}
        />
      )}

      {/* TAB 2: WARNING CREATION FORM */}
      {activeTab === 'create' && (
        <WarningForm
          hazards={hazards}
          selectedHazard={selectedHazardForForm}
          onCancel={() => {
            setSelectedHazardForForm(null);
            setActiveTab('warnings');
          }}
          onSaveDraft={handleSaveDraft}
          onOpenPreview={handleOpenPreview}
          isSubmitting={isPublishing}
        />
      )}

      {/* TAB 3: LIVE NOTIFICATION TRACKING */}
      {activeTab === 'tracking' && trackingWarning && (
        <NotificationTrackingView
          warningId={trackingWarning.warningId}
          summary={trackingData.summary}
          notifications={trackingData.notifications}
          onSimulateDelivery={handleSimulateDelivery}
          isSimulating={isSimulating}
        />
      )}

      {/* TAB 4: WARNINGS LIST VIEW */}
      {activeTab === 'warnings' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search by ID, geographic zone, or message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-md border border-gray-300 bg-white px-2.5 py-2 shadow-2xs focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value={WarningStatus.ACTIVE}>Active</option>
                <option value={WarningStatus.PUBLISHED}>Published</option>
                <option value={WarningStatus.UPDATED}>Updated</option>
                <option value={WarningStatus.DRAFT}>Draft</option>
                <option value={WarningStatus.EXPIRED}>Expired</option>
                <option value={WarningStatus.CANCELLED}>Cancelled</option>
              </select>

              {/* Level Filter */}
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="text-xs rounded-md border border-gray-300 bg-white px-2.5 py-2 shadow-2xs focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
              >
                <option value="ALL">All Warning Levels</option>
                <option value={WarningLevel.EVACUATE}>EVACUATE</option>
                <option value={WarningLevel.WARNING}>WARNING</option>
                <option value={WarningLevel.WATCH}>WATCH</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                className="flex items-center gap-1.5"
                title="Refresh from server"
              >
                <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {/* Warnings Table or Empty State */}
          {filteredWarnings.length === 0 ? (
            <EmptyState
              title="No warnings found"
              description="No public warnings match your selected filter criteria. Select a verified hazard to issue a new warning."
              action={
                <Button variant="primary" onClick={() => setActiveTab('hazards')}>
                  View Verified Hazards Feed
                </Button>
              }
            />
          ) : (
            <Card className="border-gray-200 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warning Ref</TableHead>
                    <TableHead>Level / Priority</TableHead>
                    <TableHead>Affected Area</TableHead>
                    <TableHead>Message Summary</TableHead>
                    <TableHead>Timeframe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reach</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWarnings.map((w) => (
                    <TableRow key={w._id || w.id} className="hover:bg-gray-50/80 transition-colors">
                      <TableCell className="font-mono text-xs font-bold text-gray-900">
                        {w.warningId}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          {getLevelBadge(w.warningLevel)}
                          <span className="text-[10px] font-semibold text-gray-500">
                            {w.priority} PRIORITY
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs font-semibold text-gray-800">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-brand-600 flex-shrink-0" />
                          <span>{w.affectedArea}</span>
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-gray-600 max-w-xs">
                        <p className="line-clamp-2 leading-relaxed">{w.message}</p>
                      </TableCell>

                      <TableCell className="text-xs text-gray-500">
                        <div className="space-y-0.5">
                          <p>
                            From: {new Date(w.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-gray-400">
                            Until: {new Date(w.expiryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>{getStatusBadge(w.status)}</TableCell>

                      <TableCell className="text-xs font-medium">
                        {w.deliverySummary ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-gray-800">
                              {w.deliverySummary.delivered} / {w.deliverySummary.targetCitizens}
                            </span>
                            <span className="text-[10px] text-emerald-600 block">delivered</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setInspectingWarning(w)}
                          className="text-xs"
                        >
                          Details & Controls
                        </Button>

                        {w.status !== WarningStatus.DRAFT && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenTracking(w)}
                            className="text-xs"
                            title="Live Delivery Tracking"
                          >
                            <Radio className="w-3.5 h-3.5 text-brand-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* Warning Preview Modal */}
      {previewData && (
        <WarningPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          onConfirmPublish={handleConfirmPublish}
          isPublishing={isPublishing}
          data={previewData}
        />
      )}

      {/* Warning Details & Status Controls Modal */}
      {inspectingWarning && (
        <WarningDetailsModal
          warning={inspectingWarning}
          isOpen={!!inspectingWarning}
          onClose={() => setInspectingWarning(null)}
          onStatusChange={handleStatusChange}
          onEditContent={(warn) => {
            setInspectingWarning(null);
            setSelectedHazardForForm(warn.hazard || null);
            setActiveTab('create');
          }}
          onViewTracking={handleOpenTracking}
          isUpdating={isUpdatingStatus}
        />
      )}
    </div>
  );
}
