import React, { useState, useEffect } from 'react';
import { IGroundReport } from '../../types';
import { GroundReportApi } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import ReportForm from './ReportForm';

export default function CitizenView() {
  const [reports, setReports] = useState<IGroundReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await GroundReportApi.getAll('citizen', 'citizen_123');
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

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setIsModalOpen(true)}>+ New Ground Report</Button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Submit Ground Report">
        <ReportForm 
          onSuccess={() => {
            setIsModalOpen(false);
            fetchReports();
          }}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      {loading && <Loading />}
      {error && !loading && <ErrorState onRetry={fetchReports} />}
      
      {!loading && !error && reports.length === 0 && (
        <EmptyState title="No reports" description="You haven't submitted any ground reports yet." />
      )}

      {!loading && !error && reports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <Card key={report._id}>
              <CardHeader className="flex flex-row justify-between items-start pb-2">
                <CardTitle className="text-base">{report.disasterType}</CardTitle>
                <Badge 
                  variant={report.status === 'VERIFIED' ? 'success' : report.status === 'REJECTED' ? 'danger' : 'warning'}
                >
                  {report.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-600 line-clamp-2">{report.description}</p>
                <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t border-gray-100 mt-2">
                  <span>Severity: {report.severity}</span>
                  <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
