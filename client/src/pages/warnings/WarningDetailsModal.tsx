import React, { useState } from 'react';
import {
  X,
  Clock,
  MapPin,
  ShieldAlert,
  Send,
  CheckCircle,
  XCircle,
  Edit3,
  Radio,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { IWarning, WarningLevel, WarningStatus, WarningPriority } from '../../types';

interface WarningDetailsModalProps {
  warning: IWarning;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (status: WarningStatus, reason?: string) => Promise<void>;
  onEditContent: (warning: IWarning) => void;
  onViewTracking: (warning: IWarning) => void;
  isUpdating: boolean;
}

export const WarningDetailsModal: React.FC<WarningDetailsModalProps> = ({
  warning,
  isOpen,
  onClose,
  onStatusChange,
  onEditContent,
  onViewTracking,
  isUpdating,
}) => {
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (!isOpen) return null;

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

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) return;
    await onStatusChange(WarningStatus.CANCELLED, cancelReason.trim());
    setShowCancelPrompt(false);
    setCancelReason('');
  };

  const formatTime = (time: string | Date | undefined) => {
    if (!time) return 'N/A';
    try {
      return new Date(time).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return String(time);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-brand-500/20 rounded-lg text-brand-300">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-300">{warning.warningId}</span>
                {getStatusBadge(warning.status)}
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">Warning Record Details</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
            <div>
              <span className="text-gray-500 font-medium">Warning Level</span>
              <div className="mt-1">{getLevelBadge(warning.warningLevel)}</div>
            </div>
            <div>
              <span className="text-gray-500 font-medium">Priority</span>
              <p className="font-bold text-gray-900 mt-1">{warning.priority}</p>
            </div>
            <div>
              <span className="text-gray-500 font-medium">Authorizing Officer</span>
              <p className="font-semibold text-gray-900 mt-1 line-clamp-1">{warning.createdBy}</p>
            </div>
            <div>
              <span className="text-gray-500 font-medium">Delivery Reach</span>
              <p className="font-bold text-brand-600 mt-1">
                {warning.deliverySummary?.targetCitizens || 0} Citizens
              </p>
            </div>
          </div>

          {/* Affected Area */}
          <div className="flex items-start space-x-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
            <MapPin className="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-gray-500 uppercase tracking-wider">Affected Geographic Zone</span>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{warning.affectedArea}</p>
            </div>
          </div>

          {/* Warning Message */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Public Warning Message
            </span>
            <p className="text-gray-900 text-sm font-medium leading-relaxed whitespace-pre-wrap">
              {warning.message}
            </p>
          </div>

          {/* Recommended Action */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block mb-1">
              Recommended Protective Action
            </span>
            <p className="text-amber-950 text-sm font-medium leading-relaxed">
              {warning.recommendedAction}
            </p>
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs">
            <div>
              <span className="text-gray-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Start Time
              </span>
              <p className="font-semibold text-gray-800 mt-0.5">{formatTime(warning.startTime)}</p>
            </div>
            <div>
              <span className="text-gray-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Expiry Time
              </span>
              <p className="font-semibold text-gray-800 mt-0.5">{formatTime(warning.expiryTime)}</p>
            </div>
          </div>

          {/* Cancellation Notice if cancelled */}
          {warning.status === WarningStatus.CANCELLED && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900">
              <span className="font-bold flex items-center gap-1 text-red-700">
                <AlertTriangle className="w-4 h-4" /> Warning Cancelled
              </span>
              <p className="mt-1">Reason: {warning.cancellationReason || 'Cancelled by DMC Duty Officer'}</p>
              {warning.cancelledTimestamp && (
                <p className="text-red-700/80 mt-0.5">Cancelled at: {formatTime(warning.cancelledTimestamp)}</p>
              )}
            </div>
          )}

          {/* Cancel Prompt Input if opened */}
          {showCancelPrompt && (
            <div className="p-4 bg-red-50 border border-red-300 rounded-xl space-y-3 animate-in fade-in">
              <h4 className="text-sm font-bold text-red-900">Confirm Public Warning Cancellation</h4>
              <p className="text-xs text-red-700">
                Provide an official operational reason for public records before issuing a cancellation alert.
              </p>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Danger subsided, floodwaters receded below amber gauge threshold..."
                className="w-full text-xs p-2.5 rounded-md border border-red-300 bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowCancelPrompt(false)}
                  disabled={isUpdating}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleCancelSubmit}
                  disabled={isUpdating || !cancelReason.trim()}
                >
                  Confirm Cancellation
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap justify-between items-center gap-3">
          {/* Tracking button */}
          {warning.status !== WarningStatus.DRAFT && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onViewTracking(warning);
              }}
              className="flex items-center gap-1.5"
            >
              <Radio className="w-4 h-4 text-brand-600" />
              <span>View Live Delivery Summary</span>
            </Button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {/* Status Transition Controls */}
            {warning.status === WarningStatus.DRAFT && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onStatusChange(WarningStatus.PUBLISHED)}
                disabled={isUpdating}
                className="flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Publish Warning</span>
              </Button>
            )}

            {warning.status === WarningStatus.PUBLISHED && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onStatusChange(WarningStatus.ACTIVE)}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Activate Now</span>
                </Button>
                {!showCancelPrompt && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowCancelPrompt(true)}
                    disabled={isUpdating}
                  >
                    Cancel Warning
                  </Button>
                )}
              </>
            )}

            {(warning.status === WarningStatus.ACTIVE || warning.status === WarningStatus.UPDATED) && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onEditContent(warning);
                  }}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit / Update</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange(WarningStatus.EXPIRED)}
                  disabled={isUpdating}
                >
                  Expire
                </Button>

                {!showCancelPrompt && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowCancelPrompt(true)}
                    disabled={isUpdating}
                  >
                    Cancel
                  </Button>
                )}
              </>
            )}

            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
