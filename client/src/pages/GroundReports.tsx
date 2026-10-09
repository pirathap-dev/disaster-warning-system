import React, { useState } from 'react';
import CitizenView from './ground-reports/CitizenView';
import DMCOfficerView from './ground-reports/DMCOfficerView';
import { Button } from '../components/ui/Button';

export default function GroundReports() {
  const [role, setRole] = useState<'CITIZEN' | 'DMC'>('CITIZEN');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ground Reports</h2>
          <p className="text-gray-500">Submit and verify disaster ground reports.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button 
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${role === 'CITIZEN' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setRole('CITIZEN')}
          >
            Citizen View
          </button>
          <button 
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${role === 'DMC' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setRole('DMC')}
          >
            DMC Officer View
          </button>
        </div>
      </div>

      {role === 'CITIZEN' ? <CitizenView /> : <DMCOfficerView />}
    </div>
  );
}
