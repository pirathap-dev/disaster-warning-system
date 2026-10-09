import React from 'react';
import { Users, CheckCircle, XCircle, Clock, Smartphone, MessageSquare, Megaphone, RefreshCw, Radio } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  IWarningDeliverySummary,
  INotificationRecord,
} from '../../types';

interface NotificationTrackingViewProps {
  warningId: string;
  summary?: IWarningDeliverySummary;
  notifications: INotificationRecord[];
  onSimulateDelivery: () => Promise<void>;
  isSimulating: boolean;
}

export const NotificationTrackingView: React.FC<NotificationTrackingViewProps> = ({
  warningId,
  summary,
  notifications,
  onSimulateDelivery,
  isSimulating,
}) => {
  const target = summary?.targetCitizens || 0;
  const delivered = summary?.delivered || 0;
  const failed = summary?.failed || 0;
  const pending = summary?.pending || 0;

  const deliveredPct = target > 0 ? Math.round((delivered / target) * 100) : 0;
  const pendingPct = target > 0 ? Math.round((pending / target) * 100) : 0;
  const failedPct = target > 0 ? Math.round((failed / target) * 100) : 0;

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case NotificationChannel.PUSH:
        return <Smartphone className="w-4 h-4 text-purple-600" />;
      case NotificationChannel.SMS:
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case NotificationChannel.AUDIBLE:
        return <Megaphone className="w-4 h-4 text-amber-600" />;
      default:
        return <Radio className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case NotificationDeliveryStatus.DELIVERED:
        return <Badge variant="success">DELIVERED</Badge>;
      case NotificationDeliveryStatus.FAILED:
        return <Badge variant="danger">FAILED</Badge>;
      case NotificationDeliveryStatus.PENDING:
        return <Badge variant="warning">PENDING</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-brand-50 rounded-lg text-brand-600">
              <Radio className="w-5 h-5" />
            </span>
            <h3 className="text-lg font-bold text-gray-900">
              Live Public Notification Tracking
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Tracking dispatch for Warning Reference: <strong className="text-gray-800">{warningId}</strong>
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onSimulateDelivery}
          disabled={isSimulating || pending === 0}
          className="flex items-center gap-2 border-brand-200 text-brand-700 hover:bg-brand-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
          <span>{isSimulating ? 'Simulating...' : 'Simulate Delivery Progression'}</span>
        </Button>
      </div>

      {/* Metric Counters Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Target Citizens */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Target Citizens
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{target}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Affected Geo-Zone</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Delivered */}
        <Card className="border-emerald-200 bg-emerald-50/20 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                Delivered
              </p>
              <p className="text-2xl font-bold text-emerald-800 mt-1">
                {delivered}{' '}
                <span className="text-xs font-medium text-emerald-600">({deliveredPct}%)</span>
              </p>
              <p className="text-[11px] text-emerald-600/80 mt-0.5">Confirmed reception</p>
            </div>
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <CheckCircle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="border-amber-200 bg-amber-50/20 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Pending
              </p>
              <p className="text-2xl font-bold text-amber-800 mt-1">
                {pending}{' '}
                <span className="text-xs font-medium text-amber-600">({pendingPct}%)</span>
              </p>
              <p className="text-[11px] text-amber-600/80 mt-0.5">In carrier transit</p>
            </div>
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Failed */}
        <Card className="border-red-200 bg-red-50/20 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">
                Failed
              </p>
              <p className="text-2xl font-bold text-red-800 mt-1">
                {failed}{' '}
                <span className="text-xs font-medium text-red-600">({failedPct}%)</span>
              </p>
              <p className="text-[11px] text-red-600/80 mt-0.5">Unreachable / timeout</p>
            </div>
            <div className="p-3 bg-red-100 text-red-600 rounded-xl">
              <XCircle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aggregate Progress Bar */}
      <Card className="p-4 border-gray-200 shadow-sm">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-gray-700">
            <span>Overall Dispatch Delivery Progress</span>
            <span>{deliveredPct}% Successful</span>
          </div>
          <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${deliveredPct}%` }}
              className="bg-emerald-500 h-full transition-all duration-500"
              title={`Delivered: ${delivered}`}
            />
            <div
              style={{ width: `${pendingPct}%` }}
              className="bg-amber-400 h-full transition-all duration-500"
              title={`Pending: ${pending}`}
            />
            <div
              style={{ width: `${failedPct}%` }}
              className="bg-red-500 h-full transition-all duration-500"
              title={`Failed: ${failed}`}
            />
          </div>
        </div>
      </Card>

      {/* Channel Breakdown Cards */}
      {summary?.channelBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(summary.channelBreakdown).map(([ch, data]) => (
            <Card key={ch} className="border-gray-200 shadow-sm">
              <CardHeader className="py-3 px-4 bg-gray-50 border-b border-gray-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  {getChannelIcon(ch)}
                  <span className="text-xs font-bold text-gray-800">{ch} Broadcast</span>
                </div>
                <span className="text-xs font-bold text-gray-600">{data.target} targets</span>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex justify-between text-emerald-700">
                  <span>Delivered:</span>
                  <span className="font-bold">{data.delivered}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>Pending:</span>
                  <span className="font-bold">{data.pending}</span>
                </div>
                <div className="flex justify-between text-red-700">
                  <span>Failed:</span>
                  <span className="font-bold">{data.failed}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Individual Notification Records Table */}
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="py-4 px-6 border-b border-gray-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-gray-900">
            Dispatch Audit Log ({notifications.length} Records)
          </CardTitle>
          <span className="text-xs text-gray-400">Showing recent persisted delivery entries</span>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Recipient / Tower ID</TableHead>
                <TableHead>Target Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Notes / Failure Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.slice(0, 15).map((n) => (
                <TableRow key={n._id || n.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {getChannelIcon(n.channel)}
                      <span>{n.channel}</span>
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-700">
                    {n.recipientIdentifier}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600">{n.targetArea}</TableCell>
                  <TableCell>{getStatusBadge(n.status)}</TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {n.deliveredAt
                      ? new Date(n.deliveredAt).toLocaleTimeString()
                      : n.sentAt
                      ? new Date(n.sentAt).toLocaleTimeString()
                      : 'Just now'}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {n.failureReason ? (
                      <span className="text-red-600">{n.failureReason}</span>
                    ) : (
                      <span className="text-gray-400">Normal dispatch route</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
