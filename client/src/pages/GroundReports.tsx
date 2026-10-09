import CitizenView from './ground-reports/CitizenView';
import DMCOfficerView from './ground-reports/DMCOfficerView';
import { useAuth } from '../auth/AuthContext';
import { UserRole } from '../types';

export default function GroundReports() {
  const { session } = useAuth();
  const isDmc = session?.user.role === UserRole.DMC_DUTY_OFFICER || session?.user.role === UserRole.DMC_OFFICER;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ground Reports</h2>
          <p className="text-gray-500">Submit and verify disaster ground reports.</p>
        </div>
      </div>

      {isDmc ? <DMCOfficerView /> : <CitizenView />}
    </div>
  );
}
