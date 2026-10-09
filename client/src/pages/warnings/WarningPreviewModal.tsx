import React from 'react';
import { AlertTriangle, Bell, Clock, MapPin, ShieldAlert, CheckCircle, Radio } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { WarningLevel, WarningPriority } from '../../types';

interface WarningPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPublish: () => void;
  isPublishing: boolean;
  data: {
    hazardTitle?: string;
    warningLevel: WarningLevel;
    priority: WarningPriority;
    message: string;
    affectedArea: string;
    startTime: string;
    expiryTime: string;
    recommendedAction: string;
    createdBy: string;
  };
}

export const WarningPreviewModal: React.FC<WarningPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirmPublish,
  isPublishing,
  data,
}) => {
  if (!isOpen) return null;

  const levelStyles = {
    [WarningLevel.EVACUATE]: {
      bg: 'bg-red-500',
      border: 'border-red-600',
      badge: 'danger' as const,
      text: 'text-red-700',
      lightBg: 'bg-red-50',
      bannerText: 'IMMEDIATE EVACUATION ORDER',
    },
    [WarningLevel.WARNING]: {
      bg: 'bg-amber-500',
      border: 'border-amber-600',
      badge: 'warning' as const,
      text: 'text-amber-800',
      lightBg: 'bg-amber-50',
      bannerText: 'HIGH ALERT - PUBLIC WARNING',
    },
    [WarningLevel.WATCH]: {
      bg: 'bg-blue-500',
      border: 'border-blue-600',
      badge: 'info' as const,
      text: 'text-blue-800',
      lightBg: 'bg-blue-50',
      bannerText: 'HAZARD WATCH & ADVISORY',
    },
  }[data.warningLevel];

  const formatDisplayTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Emergency Alert Banner */}
        <div className={`p-4 text-white flex items-center justify-between ${levelStyles.bg}`}>
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-white/20 rounded-lg animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <div>
              <span className="text-xs uppercase tracking-wider font-bold opacity-90">
                Official DMC Emergency Alert
              </span>
              <h3 className="text-lg font-bold tracking-tight">{levelStyles.bannerText}</h3>
            </div>
          </div>
          <Badge variant="default" className="bg-white/90 text-gray-900 font-bold px-3 py-1">
            {data.priority} PRIORITY
          </Badge>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Target Geographic Area */}
          <div className="flex items-start space-x-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200">
            <MapPin className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Affected Geographic Zone</p>
              <p className="text-base font-semibold text-gray-900">{data.affectedArea}</p>
              {data.hazardTitle && (
                <p className="text-xs text-gray-600 mt-0.5">Assessed Hazard: {data.hazardTitle}</p>
              )}
            </div>
          </div>

          {/* Alert Message Preview Box */}
          <div className={`p-4 rounded-xl border ${levelStyles.border} ${levelStyles.lightBg}`}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-gray-600" />
              Public Warning Message
            </p>
            <p className="text-gray-900 text-base font-medium leading-relaxed whitespace-pre-wrap">
              {data.message}
            </p>
          </div>

          {/* Recommended Action Box */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Mandatory Protective Actions For Citizens
            </p>
            <p className="text-amber-950 font-medium text-sm leading-relaxed">
              {data.recommendedAction}
            </p>
          </div>

          {/* Validity Timeline */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-sm">
            <div>
              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Effective From
              </span>
              <p className="font-semibold text-gray-800 mt-0.5">{formatDisplayTime(data.startTime)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Expires At
              </span>
              <p className="font-semibold text-gray-800 mt-0.5">{formatDisplayTime(data.expiryTime)}</p>
            </div>
          </div>

          {/* Multi-Channel Dispatch Preview */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-brand-600" />
              Multi-Channel Emergency Broadcast Targeting
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                <p className="font-bold text-gray-900">Mobile Push</p>
                <p className="text-gray-500 mt-0.5">App Geo-Fence</p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                <p className="font-bold text-gray-900">Cell Broadcast</p>
                <p className="text-gray-500 mt-0.5">District SMS Towers</p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                <p className="font-bold text-gray-900">Audible Siren</p>
                <p className="text-gray-500 mt-0.5">Acoustic Coastal/River</p>
              </div>
            </div>
          </div>

          {/* Authorization Notice */}
          <div className="flex items-center space-x-2 text-xs text-gray-500 pt-1 border-t border-gray-100">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span>
              Authorized by <strong>{data.createdBy}</strong>. Publishing will immediately initiate public notification records.
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose} disabled={isPublishing}>
            Back to Edit
          </Button>
          <Button
            variant={data.warningLevel === WarningLevel.EVACUATE ? 'danger' : 'primary'}
            onClick={onConfirmPublish}
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing & Dispatching...' : 'Confirm & Publish Warning Now'}
          </Button>
        </div>
      </div>
    </div>
  );
};
