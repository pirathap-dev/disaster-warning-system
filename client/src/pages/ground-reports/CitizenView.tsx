import React, { useState, useEffect } from 'react';
import { IGroundReport, ReportStatus } from '../../types';
import { GroundReportApi } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import ReportForm from './ReportForm';
import EditReportForm from './EditReportForm';
import { useToast } from '../../components/ui/Toast';

// Statuses where citizen can still edit/delete
const EDITABLE_STATUSES: ReportStatus[] = [ReportStatus.UNDER_REVIEW, ReportStatus.NEEDS_MORE_INFO];

function statusVariant(status: string) {
  switch (status) {
    case 'VERIFIED': return 'success';
    case 'REJECTED': return 'danger';
    case 'NEEDS_MORE_INFO': return 'warning';
    case 'UNDER_REVIEW': return 'info';
    case 'PENDING': return 'info';
    default: return 'default';
  }
}

export default function CitizenView() {
  const [reports, setReports] = useState<IGroundReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<IGroundReport | null>(null);
  const [deletingReport, setDeletingReport] = useState<IGroundReport | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { toast } = useToast();

  const fetchReports = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await GroundReportApi.getAll();
      if (res.success && res.data) {
        setReports(res.data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleDelete = async () => {
    if (!deletingReport) return;
    setDeleteLoading(true);
    try {
      const res = await GroundReportApi.delete(deletingReport._id, '');
      if (res.success) {
        toast('Report deleted successfully', 'success');
        setDeletingReport(null);
        fetchReports();
      } else {
        toast(res.error?.message || 'Failed to delete', 'error');
      }
    } catch {
      toast('Network error', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setIsNewModalOpen(true)}>+ New Ground Report</Button>
      </div>

      {/* New Report Modal */}
      <Modal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} title="Submit Ground Report">
        <ReportForm
          onSuccess={() => { setIsNewModalOpen(false); fetchReports(); }}
          onCancel={() => setIsNewModalOpen(false)}
        />
      </Modal>

      {/* Edit Report Modal */}
      {editingReport && (
        <Modal isOpen={!!editingReport} onClose={() => setEditingReport(null)} title="Edit Ground Report">
          <EditReportForm
            report={editingReport}
            onSuccess={() => { setEditingReport(null); fetchReports(); }}
            onCancel={() => setEditingReport(null)}
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingReport && (
        <Modal isOpen={!!deletingReport} onClose={() => setDeletingReport(null)} title="Delete Report">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this <strong>{deletingReport.disasterType}</strong> report?
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={() => setDeletingReport(null)} disabled={deleteLoading}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {loading && <Loading />}
      {error && !loading && <ErrorState onRetry={fetchReports} />}

      {!loading && !error && reports.length === 0 && (
        <EmptyState title="No reports yet" description="Submit your first disaster ground report." />
      )}

      {!loading && !error && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map((report) => {
            const canEdit = EDITABLE_STATUSES.includes(report.status as ReportStatus);
            return (
              <div
                key={report._id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4 items-start shadow-sm"
              >
                {/* Image thumbnail */}
                {report.imageUrl && (
                  <img
                    src={report.imageUrl}
                    alt="Report"
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                  />
                )}

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-semibold text-gray-900">{report.disasterType}</span>
                      <span className="text-gray-400 text-xs ml-2">
                        {new Date(report.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <Badge variant={statusVariant(report.status) as 'default'}>
                      {report.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{report.description}</p>

                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>Severity: <span className="font-medium text-gray-600">{report.severity}</span></span>
                    <span>📍 {report.location.latitude.toFixed(4)}, {report.location.longitude.toFixed(4)}</span>
                    {report.isDuplicate && (
                      <span className="text-yellow-600 font-medium">⚠ Possible duplicate</span>
                    )}
                  </div>

                  {/* Remarks from DMC */}
                  {report.verificationRemarks && (
                    <div className="mt-2 bg-blue-50 border border-blue-100 rounded-md px-3 py-2 text-xs text-blue-800">
                      <span className="font-medium">Officer note:</span> {report.verificationRemarks}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {canEdit && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setEditingReport(report)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDeletingReport(report)}>
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
