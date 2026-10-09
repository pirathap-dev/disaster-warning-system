import React, { useState, useEffect } from 'react';
import { IGroundReport, ReportStatus } from '../../types';
import { GroundReportApi } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';

const DMC_OFFICER_ID = 'officer_456'; // Replace with real auth later

function statusVariant(status: string) {
  switch (status) {
    case 'VERIFIED': return 'success';
    case 'REJECTED': return 'danger';
    case 'NEEDS_MORE_INFO': return 'warning';
    case 'UNDER_REVIEW': return 'info';
    default: return 'default';
  }
}

function severityColor(severity: string) {
  switch (severity) {
    case 'CRITICAL': return 'text-red-700 font-bold';
    case 'HIGH': return 'text-orange-600 font-semibold';
    case 'MODERATE': return 'text-yellow-600';
    default: return 'text-gray-500';
  }
}

export default function DMCOfficerView() {
  const [reports, setReports] = useState<IGroundReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<IGroundReport | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await GroundReportApi.getAll();
      if (res.success && res.data) setReports(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleUpdateStatus = async (status: ReportStatus) => {
    if (!selectedReport) return;
    if ((status === ReportStatus.REJECTED || status === ReportStatus.NEEDS_MORE_INFO) && !reviewRemarks.trim()) {
      toast('Please enter remarks before rejecting or requesting more information.', 'error');
      return;
    }
    setProcessing(true);
    try {
      const res = await GroundReportApi.updateStatus(selectedReport._id, status, DMC_OFFICER_ID, reviewRemarks.trim() || undefined);
      if (res.success) {
        toast(`Report marked as ${status.replace('_', ' ')}`, 'success');
        setSelectedReport(null);
        setReviewRemarks('');
        fetchReports();
      } else {
        toast(res.error?.message || 'Update failed', 'error');
      }
    } catch {
      toast('Network error', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const displayed = filterStatus
    ? reports.filter(r => r.status === filterStatus)
    : reports;

  const actionable = selectedReport
    ? (selectedReport.status === ReportStatus.UNDER_REVIEW
        ? [ReportStatus.VERIFIED, ReportStatus.REJECTED, ReportStatus.NEEDS_MORE_INFO]
        : selectedReport.status === ReportStatus.NEEDS_MORE_INFO
          ? [ReportStatus.UNDER_REVIEW]
          : [])
    : [];

  return (
    <div className="space-y-4 bg-white p-6 rounded-xl border border-gray-200">
      {/* Header row */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">All Ground Reports</h3>
        <div className="flex items-center gap-3">
          <select
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {Object.values(ReportStatus).map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={fetchReports}>↺ Refresh</Button>
        </div>
      </div>

      {loading ? <Loading /> : displayed.length === 0 ? (
        <EmptyState title="No reports" description="No ground reports match the selected filter." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((report) => (
              <TableRow key={report._id}>
                <TableCell className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(report.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="font-medium">{report.disasterType}</TableCell>
                <TableCell className={`text-sm ${severityColor(report.severity)}`}>{report.severity}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(report.status) as 'default'}>
                    {report.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {report.isDuplicate
                    ? <Badge variant="warning">⚠ Duplicate</Badge>
                    : <span className="text-gray-300 text-xs">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="secondary" onClick={() => {
                    setSelectedReport(report);
                    setReviewRemarks(report.verificationRemarks || '');
                  }}>
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Review Modal */}
      {selectedReport && (
        <Modal
          isOpen={!!selectedReport}
          onClose={() => { setSelectedReport(null); setReviewRemarks(''); }}
          title={`Review — ${selectedReport.disasterType}`}
          className="max-w-2xl"
        >
          <div className="space-y-4">
            {/* Duplicate warning */}
            {selectedReport.isDuplicate && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-md">
                <p className="text-sm text-yellow-800 font-medium">
                  ⚠ This report was flagged as a possible duplicate of a nearby report.
                </p>
              </div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div><span className="font-medium text-gray-500">Reporter:</span> {selectedReport.reporterId}</div>
              <div><span className="font-medium text-gray-500">Submitted:</span> {new Date(selectedReport.createdAt).toLocaleString()}</div>
              <div>
                <span className="font-medium text-gray-500">Severity:</span>{' '}
                <span className={severityColor(selectedReport.severity)}>{selectedReport.severity}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Location:</span>{' '}
                {selectedReport.location.latitude.toFixed(5)}, {selectedReport.location.longitude.toFixed(5)}
              </div>
              <div>
                <span className="font-medium text-gray-500">Status:</span>{' '}
                <Badge variant={statusVariant(selectedReport.status) as 'default'}>
                  {selectedReport.status.replace('_', ' ')}
                </Badge>
              </div>
              {selectedReport.reviewerId && (
                <div><span className="font-medium text-gray-500">Reviewed by:</span> {selectedReport.reviewerId}</div>
              )}
              {selectedReport.verificationTimestamp && (
                <div className="col-span-2">
                  <span className="font-medium text-gray-500">Last action:</span>{' '}
                  {new Date(selectedReport.verificationTimestamp).toLocaleString()}
                </div>
              )}
            </div>

            {/* Photo */}
            {selectedReport.imageUrl && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Photo Evidence:</p>
                <img
                  src={selectedReport.imageUrl}
                  alt="Disaster evidence"
                  className="w-full max-h-64 object-cover rounded-lg border border-gray-200 shadow-sm"
                />
              </div>
            )}

            {/* Description */}
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Description:</p>
              <p className="bg-gray-50 p-3 rounded-md text-sm border border-gray-100">{selectedReport.description}</p>
            </div>

            {/* Remarks + Actions — only shown when actionable */}
            {actionable.length > 0 && (
              <div className="space-y-3 pt-3 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Remarks
                    {(actionable.includes(ReportStatus.REJECTED) || actionable.includes(ReportStatus.NEEDS_MORE_INFO)) && (
                      <span className="text-red-500 ml-1">* Required for Reject / Need Info</span>
                    )}
                  </label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                    rows={2}
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    placeholder="Add remarks for the citizen..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  {actionable.includes(ReportStatus.UNDER_REVIEW) && (
                    <Button variant="info" onClick={() => handleUpdateStatus(ReportStatus.UNDER_REVIEW)} disabled={processing}>
                      Mark Under Review
                    </Button>
                  )}
                  {actionable.includes(ReportStatus.REJECTED) && (
                    <Button variant="danger" onClick={() => handleUpdateStatus(ReportStatus.REJECTED)} disabled={processing}>
                      Reject
                    </Button>
                  )}
                  {actionable.includes(ReportStatus.NEEDS_MORE_INFO) && (
                    <Button variant="warning" onClick={() => handleUpdateStatus(ReportStatus.NEEDS_MORE_INFO)} disabled={processing}>
                      Need More Info
                    </Button>
                  )}
                  {actionable.includes(ReportStatus.VERIFIED) && (
                    <Button variant="success" onClick={() => handleUpdateStatus(ReportStatus.VERIFIED)} disabled={processing}>
                      ✓ Verify
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Final state message */}
            {actionable.length === 0 && (
              <div className="bg-gray-50 border border-gray-100 rounded-md p-3 text-sm text-gray-500 text-center">
                This report is <strong>{selectedReport.status.replace('_', ' ')}</strong> — no further actions available.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
