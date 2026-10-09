import React, { useState, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DisasterType, SeverityLevel, IGroundReport } from '../../types';
import { GroundReportApi } from '../../services/api';
import { useToast } from '../../components/ui/Toast';

interface EditReportFormProps {
  report: IGroundReport;
  onSuccess: (report: IGroundReport) => void;
  onCancel: () => void;
}

const CITIZEN_ID = 'citizen_123';

export default function EditReportForm({ report, onSuccess, onCancel }: EditReportFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [disasterType, setDisasterType] = useState<DisasterType>(report.disasterType);
  const [severity, setSeverity] = useState<SeverityLevel>(report.severity);
  const [description, setDescription] = useState(report.description);
  const [imagePreview, setImagePreview] = useState<string | null>(report.imageUrl || null);
  const [imageBase64, setImageBase64] = useState<string | null>(report.imageUrl || null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lat, setLat] = useState(report.location.latitude);
  const [lng, setLng] = useState(report.location.longitude);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setImageError('Please select a valid image file.'); return; }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 5) { setImageError(`Image must be smaller than 5MB. Selected: ${sizeMB.toFixed(1)}MB`); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      setImageBase64(result);
    };
    reader.onerror = () => setImageError('Failed to read image file.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { toast('Description is required', 'error'); return; }

    setLoading(true);
    try {
      const res = await GroundReportApi.edit(report._id, CITIZEN_ID, {
        disasterType,
        severity,
        description,
        imageUrl: imageBase64 || undefined,
        location: { latitude: lat, longitude: lng }
      });

      if (res.success && res.data) {
        toast('Report updated successfully', 'success');
        if (res.data.isDuplicate) {
          toast('Warning: Similar report detected nearby after update.', 'info');
        }
        onSuccess(res.data);
      } else {
        toast(res.error?.message || 'Failed to update', 'error');
      }
    } catch {
      toast('Network error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Disaster Type *"
          value={disasterType}
          onChange={(e) => setDisasterType(e.target.value as DisasterType)}
          options={Object.values(DisasterType).map(t => ({ label: t, value: t }))}
          required
        />
        <Select
          label="Severity Level *"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
          options={Object.values(SeverityLevel).map(t => ({ label: t, value: t }))}
          required
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Description *</label>
        <textarea
          className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      {/* Image Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Photo Evidence <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        {!imagePreview ? (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-3xl mb-1">📸</div>
            <p className="text-sm text-gray-500">Click to upload a photo</p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden border border-gray-200">
            <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-cover" />
            <div className="absolute top-2 right-2 flex gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="bg-white bg-opacity-90 text-xs px-2 py-1 rounded shadow">Change</button>
              <button type="button" onClick={() => { setImagePreview(null); setImageBase64(null); }}
                className="bg-red-500 text-white text-xs px-2 py-1 rounded shadow">Remove</button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>
        )}
        {imageError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-100">{imageError}</p>}
      </div>

      {/* Location */}
      <div className="space-y-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700">Location (GPS)</label>
        <div className="grid grid-cols-2 gap-4">
          <Input type="number" step="any" label="Latitude"
            value={lat} onChange={(e) => setLat(parseFloat(e.target.value) || 0)} required />
          <Input type="number" step="any" label="Longitude"
            value={lng} onChange={(e) => setLng(parseFloat(e.target.value) || 0)} required />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
