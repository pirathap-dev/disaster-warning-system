import React, { useState } from 'react';
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

export default function ReportForm({ onSuccess, onCancel }: ReportFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [disasterType, setDisasterType] = useState<DisasterType | ''>('');
  const [severity, setSeverity] = useState<SeverityLevel | ''>('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<Location>({ latitude: 0, longitude: 0 });

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          toast('Location captured', 'success');
        },
        (error) => toast('Failed to get location: ' + error.message, 'error')
      );
    } else {
      toast('Geolocation is not supported by this browser.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disasterType || !severity || !description) {
      toast('Please fill all required fields', 'error');
      return;
    }
    if (location.latitude === 0 && location.longitude === 0) {
      toast('Please capture or enter location', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        reporterId: 'citizen_123', // Hardcoded for demo
        disasterType: disasterType as DisasterType,
        severity: severity as SeverityLevel,
        description,
        location
      };
      const res = await GroundReportApi.create(payload);
      
      if (res.success && res.data) {
        toast('Report submitted successfully!', 'success');
        if (res.data.isDuplicate) {
          toast('Warning: A similar report was already filed recently in this area.', 'info');
        }
        onSuccess(res.data);
      } else {
        toast(res.error?.message || 'Failed to submit', 'error');
      }
    } catch (err) {
      toast('Network error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="space-y-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">Location (GPS) *</label>
          <Button type="button" variant="outline" size="sm" onClick={handleGetLocation}>
            Get Current Location
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input 
            type="number" 
            step="any" 
            label="Latitude" 
            value={location.latitude || ''} 
            onChange={(e) => setLocation({ ...location, latitude: parseFloat(e.target.value) })}
            required
          />
          <Input 
            type="number" 
            step="any" 
            label="Longitude" 
            value={location.longitude || ''} 
            onChange={(e) => setLocation({ ...location, longitude: parseFloat(e.target.value) })}
            required
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Report'}
        </Button>
      </div>
    </form>
  );
}
