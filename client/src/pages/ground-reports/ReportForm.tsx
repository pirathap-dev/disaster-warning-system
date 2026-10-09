import React, { useState, useRef } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DisasterType, SeverityLevel, Location, IGroundReport } from '../../types';
import { GroundReportApi } from '../../services/api';
import { useToast } from '../../components/ui/Toast';

interface ReportFormProps {
  onSuccess: (report: IGroundReport) => void;
  onCancel: () => void;
}

const MAX_IMAGE_SIZE_MB = 5;

export default function ReportForm({ onSuccess, onCancel }: ReportFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [disasterType, setDisasterType] = useState<DisasterType | ''>('');
  const [severity, setSeverity] = useState<SeverityLevel | ''>('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<Location>({ latitude: 0, longitude: 0 });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const [gpsLoading, setGpsLoading] = useState(false);

  const handleGetLocation = () => {
    // Geolocation requires a secure context (HTTPS) or localhost
    if (!window.isSecureContext && !window.location.hostname.includes('localhost')) {
      toast(
        'Geolocation requires HTTPS. Please enter coordinates manually or access the app via localhost.',
        'error'
      );
      return;
    }
    if (!navigator.geolocation) {
      toast('Your browser does not support geolocation. Please enter coordinates manually.', 'error');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGpsLoading(false);
        toast(`Location captured: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`, 'success');
      },
      (error) => {
        setGpsLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast(
              'Location access denied. Please allow location in your browser settings, then try again.',
              'error'
            );
            break;
          case error.POSITION_UNAVAILABLE:
            toast('Location unavailable. Enter coordinates manually.', 'error');
            break;
          case error.TIMEOUT:
            toast('Location request timed out. Check your GPS signal and try again.', 'error');
            break;
          default:
            toast('Could not get location: ' + error.message, 'error');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,       // 10 second timeout
        maximumAge: 30000,    // Accept cached position up to 30s old
      }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file (JPG, PNG, WEBP, etc.)');
      return;
    }

    // Validate size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_IMAGE_SIZE_MB) {
      setImageError(`Image must be smaller than ${MAX_IMAGE_SIZE_MB}MB. Selected: ${sizeMB.toFixed(1)}MB`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      setImageBase64(result); // Full data URL: "data:image/jpeg;base64,..."
    };
    reader.onerror = () => {
      setImageError('Failed to read image file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!disasterType || !severity || !description) {
      toast('Please fill all required fields', 'error');
      return;
    }
    if (location.latitude === 0 && location.longitude === 0) {
      toast('Please capture or enter a valid location', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload: Partial<IGroundReport> = {
        disasterType: disasterType as DisasterType,
        severity: severity as SeverityLevel,
        description,
        location,
        ...(imageBase64 ? { imageUrl: imageBase64 } : {})
      };

      const res = await GroundReportApi.create(payload);

      if (res.success && res.data) {
        toast('Report submitted successfully!', 'success');
        if (res.data.isDuplicate) {
          toast('Warning: A similar report already exists nearby. Officers will be notified.', 'info');
        }
        onSuccess(res.data);
      } else {
        toast(res.error?.message || 'Failed to submit report', 'error');
      }
    } catch (err) {
      toast('Cannot reach the server. Please ensure the backend is running on port 5000.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Disaster Type & Severity side by side */}
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

      {/* Description */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">Description *</label>
        <textarea
          className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what you observed — location details, number of people affected, visible damage..."
          required
        />
      </div>

      {/* Image Upload */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Photo Evidence <span className="text-gray-400 font-normal">(optional, max {MAX_IMAGE_SIZE_MB}MB)</span>
        </label>

        {!imagePreview ? (
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-4xl mb-2">📸</div>
            <p className="text-sm text-gray-500">Click to upload a photo of the disaster</p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP up to {MAX_IMAGE_SIZE_MB}MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden border border-gray-200">
            <img
              src={imagePreview}
              alt="Disaster preview"
              className="w-full max-h-56 object-cover"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white bg-opacity-90 text-gray-700 text-xs px-2 py-1 rounded-md shadow hover:bg-opacity-100 transition"
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="bg-red-500 bg-opacity-90 text-white text-xs px-2 py-1 rounded-md shadow hover:bg-opacity-100 transition"
              >
                Remove
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
        )}

        {imageError && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-100">
            {imageError}
          </p>
        )}
      </div>

      {/* Location */}
      <div className="space-y-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-700">Location (GPS) *</label>
          <Button type="button" variant="outline" size="sm" onClick={handleGetLocation} disabled={gpsLoading}>
            {gpsLoading ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-brand-600 border-t-transparent rounded-full" />
                Acquiring GPS...
              </span>
            ) : '📍 Get Current Location'}
          </Button>
        </div>

        {location.latitude !== 0 || location.longitude !== 0 ? (
          <div className="text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-1.5 rounded-md">
            ✓ Coordinates set: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            step="any"
            label="Latitude"
            value={location.latitude || ''}
            onChange={(e) => setLocation({ ...location, latitude: parseFloat(e.target.value) || 0 })}
            placeholder="-90 to 90"
            required
          />
          <Input
            type="number"
            step="any"
            label="Longitude"
            value={location.longitude || ''}
            onChange={(e) => setLocation({ ...location, longitude: parseFloat(e.target.value) || 0 })}
            placeholder="-180 to 180"
            required
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Submitting...
            </span>
          ) : 'Submit Report'}
        </Button>
      </div>
    </form>
  );
}
