import React, { useState, useEffect } from 'react';
import { IGroundReport, ReportStatus } from '../../types';
import { GroundReportApi } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Loading } from '../../components/ui/Loading';
import { useToast } from '../../components/ui/Toast';

export default function DMCOfficerView() {
  const [reports, setReports] = useState<IGroundReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<IGroundReport | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await GroundReportApi.getAll();
      if (res.success && res.data) {
        setReports(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleUpdateStatus = async (status: ReportStatus) => {
    if (!selectedReport) return;
    setProcessing(true);
    try {
      const res = await GroundReportApi.updateStatus(selectedReport._id, status, 'officer_456', reviewRemarks);
      if (res.success) {
        toast(`Report status updated to ${status}`, 'success');
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

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'VERIFIED': return <Badge variant="success">VERIFIED</Badge>;
      case 'REJECTED': return <Badge variant="danger">REJECTED</Badge>;
      case 'SUBMITTED': return <Badge variant="default">SUBMITTED</Badge>;
      case 'UNDER_REVIEW': return <Badge variant="info">UNDER_REVIEW</Badge>;
      default: return <Badge variant="warning">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4 bg-white p-6 rounded-xl border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">All Ground Reports</h3>
        <Button variant="outline" size="sm" onClick={fetchReports}>Refresh</Button>
      </div>

      {loading ? <Loading /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duplicate?</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report._id}>
                <TableCell>{new Date(report.createdAt).toLocaleString()}</TableCell>
                <TableCell className="font-medium">{report.disasterType}</TableCell>
                <TableCell>{report.severity}</TableCell>
                <TableCell>{getStatusBadge(report.status)}</TableCell>
                <TableCell>
                  {report.isDuplicate ? (
                    <Badge variant="warning">Possible Duplicate</Badge>
                  ) : <span className="text-gray-400">-</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="secondary" onClick={() => setSelectedReport(report)}>
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {selectedReport && (
        <Modal 
          isOpen={!!selectedReport} 
          onClose={() => setSelectedReport(null)} 
          title={`Review Report - ${selectedReport.disasterType}`}
          className="max-w-2xl"
        >
          <div className="space-y-4">
            {selectedReport.isDuplicate && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-md">
                <p className="text-sm text-yellow-800 font-medium">Warning: This report was flagged as a possible duplicate of an existing report nearby.</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium text-gray-500">Reporter ID:</span> {selectedReport.reporterId}</div>
              <div><span className="font-medium text-gray-500">Submitted:</span> {new Date(selectedReport.createdAt).toLocaleString()}</div>
              <div><span className="font-medium text-gray-500">Severity:</span> <span className={`font-semibold ${selectedReport.severity === 'CRITICAL' ? 'text-red-600' : selectedReport.severity === 'HIGH' ? 'text-orange-600' : 'text-gray-700'}`}>{selectedReport.severity}</span></div>
              <div><span className="font-medium text-gray-500">Location:</span> {selectedReport.location.latitude.toFixed(4)}, {selectedReport.location.longitude.toFixed(4)}</div>
            </div>

            {/* Photo Evidence */}
            {selectedReport.imageUrl && (
              <div>
                <span className="font-medium text-gray-500 text-sm block mb-1">Photo Evidence:</span>
                <img
                  src={selectedReport.imageUrl}
                  alt="Disaster evidence"
                  className="w-full max-h-64 object-cover rounded-lg border border-gray-200 shadow-sm"
                />
              </div>
            )}

            <div>
              <span className="font-medium text-gray-500 text-sm block mb-1">Description:</span>
              <p className="bg-gray-50 p-3 rounded-md text-sm border border-gray-100">{selectedReport.description}</p>
            </div>

            <div className="pt-4 border-t space-y-3">
              <label className="block text-sm font-medium text-gray-700">Verification Remarks (Optional)</label>
              <textarea 
                className="w-full rounded-md border border-gray-300 p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                rows={2}
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="Add notes before verifying or rejecting..."
              />
              
              <div className="flex justify-end space-x-2 pt-2">
                {selectedReport.status === ReportStatus.SUBMITTED && (
                  <Button variant="info" onClick={() => handleUpdateStatus(ReportStatus.UNDER_REVIEW)} disabled={processing}>
                    Mark Under Review
                  </Button>
                )}
                {selectedReport.status !== ReportStatus.SUBMITTED && (
                  <>
                    <Button variant="danger" onClick={() => handleUpdateStatus(ReportStatus.REJECTED)} disabled={processing}>Reject</Button>
                    <Button variant="warning" onClick={() => handleUpdateStatus(ReportStatus.NEEDS_MORE_INFO)} disabled={processing}>Need Info</Button>
                    <Button variant="success" onClick={() => handleUpdateStatus(ReportStatus.VERIFIED)} disabled={processing}>Verify</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
