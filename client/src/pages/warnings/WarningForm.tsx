import React, { useState, useEffect } from 'react';
import { Eye, Save, X, Info, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { IHazard, WarningLevel, WarningPriority, WarningStatus } from '../../types';

export interface WarningFormData {
  hazardId: string;
  hazardTitle?: string;
  warningLevel: WarningLevel;
  priority: WarningPriority;
  message: string;
  affectedArea: string;
  startTime: string;
  expiryTime: string;
  recommendedAction: string;
  createdBy: string;
  status: WarningStatus;
}

interface WarningFormProps {
  hazards: IHazard[];
  selectedHazard?: IHazard | null;
  onCancel: () => void;
  onSaveDraft: (formData: WarningFormData) => Promise<void>;
  onOpenPreview: (formData: WarningFormData) => void;
  isSubmitting: boolean;
}

export const WarningForm: React.FC<WarningFormProps> = ({
  hazards,
  selectedHazard,
  onCancel,
  onSaveDraft,
  onOpenPreview,
  isSubmitting,
}) => {
  const getDefaultDates = () => {
    const now = new Date();
    const startStr = new Date(now.getTime() + 5 * 60 * 1000).toISOString().slice(0, 16);
    const expiryStr = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 16);
    return { startStr, expiryStr };
  };

  const { startStr: initialStart, expiryStr: initialExpiry } = getDefaultDates();

  const [hazardId, setHazardId] = useState(selectedHazard?._id || selectedHazard?.id || '');
  const [warningLevel, setWarningLevel] = useState<WarningLevel>(WarningLevel.WARNING);
  const [priority, setPriority] = useState<WarningPriority>(WarningPriority.HIGH);
  const [affectedArea, setAffectedArea] = useState(
    selectedHazard ? `${selectedHazard.location.district} District` : ''
  );
  const [startTime, setStartTime] = useState(initialStart);
  const [expiryTime, setExpiryTime] = useState(initialExpiry);
  const [message, setMessage] = useState('');
  const [recommendedAction, setRecommendedAction] = useState('');
  const [createdBy, setCreatedBy] = useState('DMC Duty Officer #01');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selectedHazard) {
      setHazardId(selectedHazard._id || selectedHazard.id || '');
      setAffectedArea(selectedHazard.location.address || selectedHazard.location.district);
      setMessage(selectedHazard.description);
      setRecommendedAction('');
      if (selectedHazard.severity === 'CRITICAL') {
        setWarningLevel(WarningLevel.EVACUATE);
        setPriority(WarningPriority.CRITICAL);
      } else if (selectedHazard.severity === 'HIGH') {
        setWarningLevel(WarningLevel.WARNING);
        setPriority(WarningPriority.HIGH);
      } else {
        setWarningLevel(WarningLevel.WATCH);
        setPriority(WarningPriority.MEDIUM);
      }
    }
  }, [selectedHazard]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!hazardId) {
      newErrors.hazardId = 'A verified hazard must be selected';
    }

    if (!affectedArea.trim()) {
      newErrors.affectedArea = 'Affected geographic area is required';
    }

    if (!message.trim() || message.trim().length < 10) {
      newErrors.message = 'Warning message is required (minimum 10 characters)';
    }

    if (!recommendedAction.trim()) {
      newErrors.recommendedAction = 'Recommended protective action is required';
    }

    if (!createdBy.trim()) {
      newErrors.createdBy = 'Authorizing officer identifier is required';
    }

    if (!startTime) {
      newErrors.startTime = 'Start time is required';
    }

    if (!expiryTime) {
      newErrors.expiryTime = 'Expiry time is required';
    }

    if (startTime && expiryTime) {
      const s = new Date(startTime).getTime();
      const e = new Date(expiryTime).getTime();
      if (isNaN(s) || isNaN(e)) {
        newErrors.expiryTime = 'Invalid date format';
      } else if (e <= s) {
        newErrors.expiryTime = 'Expiry time must be strictly after start time';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getFormData = (): WarningFormData => {
    const currentHazard = hazards.find((h) => (h._id || h.id) === hazardId);
    return {
      hazardId,
      hazardTitle: currentHazard?.title,
      warningLevel,
      priority,
      message: message.trim(),
      affectedArea: affectedArea.trim(),
      startTime: new Date(startTime).toISOString(),
      expiryTime: new Date(expiryTime).toISOString(),
      recommendedAction: recommendedAction.trim(),
      createdBy: createdBy.trim(),
      status: WarningStatus.DRAFT,
    };
  };

  const handlePreviewClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onOpenPreview(getFormData());
    }
  };

  const handleDraftClick = async () => {
    if (validate()) {
      await onSaveDraft(getFormData());
    }
  };

  const selectedHazardObj = hazards.find((h) => (h._id || h.id) === hazardId);

  return (
    <Card className="max-w-4xl mx-auto border-gray-200 shadow-md">
      <CardHeader className="bg-gradient-to-r from-gray-900 to-slate-800 text-white p-6 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-brand-500/20 rounded-lg text-brand-300">
              <ShieldAlert className="w-6 h-6" />
            </span>
            <div>
              <CardTitle className="text-xl text-white">Create Targeted Public Warning</CardTitle>
              <p className="text-xs text-gray-300 mt-0.5">
                DMC Duty Officer Protocol - Multi-Channel Alert Authoring
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            className="text-gray-300 hover:text-white bg-white/10 border-white/20"
          >
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 md:p-8 space-y-6">
        <form onSubmit={handlePreviewClick} className="space-y-6">
          {/* 1. Verified Hazard Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-800">
              Assessed Verified Hazard <span className="text-red-500">*</span>
            </label>
            <select
              value={hazardId}
              onChange={(e) => setHazardId(e.target.value)}
              className={`w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 ${
                errors.hazardId
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
              }`}
            >
              <option value="" disabled>
                Select a verified hazard from field reports...
              </option>
              {hazards.map((h) => (
                <option key={h._id || h.id} value={h._id || h.id}>
                  [{h.severity}] {h.title} - {h.location.district}
                </option>
              ))}
            </select>
            {errors.hazardId && <p className="text-xs text-red-500 font-medium">{errors.hazardId}</p>}

            {selectedHazardObj && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">{selectedHazardObj.title}</p>
                  <p className="text-blue-800 mt-0.5">{selectedHazardObj.description}</p>
                </div>
              </div>
            )}
          </div>

          {/* 2. Warning Level & Priority Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Warning Level Selector */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                Warning Level <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    level: WarningLevel.WATCH,
                    label: 'WATCH',
                    desc: 'Be Aware',
                    color: 'border-blue-400 bg-blue-50 text-blue-800 hover:bg-blue-100',
                    active: 'ring-2 ring-blue-600 font-bold bg-blue-100',
                  },
                  {
                    level: WarningLevel.WARNING,
                    label: 'WARNING',
                    desc: 'Prepare Action',
                    color: 'border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100',
                    active: 'ring-2 ring-amber-600 font-bold bg-amber-100',
                  },
                  {
                    level: WarningLevel.EVACUATE,
                    label: 'EVACUATE',
                    desc: 'Immediate Move',
                    color: 'border-red-400 bg-red-50 text-red-800 hover:bg-red-100',
                    active: 'ring-2 ring-red-600 font-bold bg-red-100',
                  },
                ].map((item) => (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => setWarningLevel(item.level)}
                    className={`p-3 rounded-lg border text-center transition-all ${item.color} ${
                      warningLevel === item.level ? item.active : 'opacity-70'
                    }`}
                  >
                    <p className="text-xs font-bold">{item.label}</p>
                    <p className="text-[10px] mt-0.5 opacity-80">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Selector */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                Broadcast Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as WarningPriority)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value={WarningPriority.LOW}>LOW - Minor Localized</option>
                <option value={WarningPriority.MEDIUM}>MEDIUM - Heightened Vigilance</option>
                <option value={WarningPriority.HIGH}>HIGH - Dangerous Conditions</option>
                <option value={WarningPriority.CRITICAL}>CRITICAL - Life Threatening</option>
              </select>
              <p className="text-xs text-gray-500">Determines alert banner prominence and siren dispatch frequency.</p>
            </div>
          </div>

          {/* 3. Affected Geographic Area */}
          <div className="space-y-1">
            <Input
              label="Affected Geographic Area *"
              placeholder="e.g. Colombo District - Hanwella & Kolonnawa Basins"
              value={affectedArea}
              onChange={(e) => setAffectedArea(e.target.value)}
              error={errors.affectedArea}
            />
            <p className="text-xs text-gray-500">
              Only mobile users and siren towers located within this geographic boundary will be targeted.
            </p>
          </div>

          {/* 4. Start & Expiry Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-800">
                Effective Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                  errors.startTime
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
                }`}
              />
              {errors.startTime && <p className="text-xs text-red-500">{errors.startTime}</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-800">
                Expiry Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={expiryTime}
                onChange={(e) => setExpiryTime(e.target.value)}
                className={`w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                  errors.expiryTime
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
                }`}
              />
              {errors.expiryTime && <p className="text-xs text-red-500">{errors.expiryTime}</p>}
            </div>
          </div>

          {/* 5. Warning Advisory Message */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-semibold text-gray-800">
                Public Warning Message <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-gray-400">{message.length} chars</span>
            </div>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write concise, authoritative instructions for the public..."
              className={`w-full rounded-md border bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                errors.message
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
              }`}
            />
            {errors.message && <p className="text-xs text-red-500 font-medium">{errors.message}</p>}
          </div>

          {/* 6. Recommended Action */}
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-800">
              Recommended Protective Action <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={recommendedAction}
              onChange={(e) => setRecommendedAction(e.target.value)}
              placeholder="e.g. Evacuate low-lying riverbanks immediately. Report to designated community shelters."
              className={`w-full rounded-md border bg-white p-3 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                errors.recommendedAction
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
              }`}
            />
            {errors.recommendedAction && (
              <p className="text-xs text-red-500 font-medium">{errors.recommendedAction}</p>
            )}
          </div>

          {/* 7. Authorizing Officer */}
          <div className="space-y-1">
            <Input
              label="Authorizing Officer Identifier *"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              error={errors.createdBy}
            />
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={handleDraftClick}
                disabled={isSubmitting}
                className="flex items-center gap-2 flex-1 sm:flex-none justify-center"
              >
                <Save className="w-4 h-4" />
                <span>Save as Draft</span>
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="flex items-center gap-2 flex-1 sm:flex-none justify-center"
              >
                <Eye className="w-4 h-4" />
                <span>Preview & Publish</span>
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
