import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-500">Welcome to the Disaster Warning & Emergency Coordination System.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Placeholder summary cards */}
        {['Active Warnings', 'Pending Reports', 'Active Rescues', 'Shelter Capacity'].map((title, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
              <div className="mt-2 flex items-baseline">
                <p className="text-3xl font-semibold text-gray-900">0</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              <p>Activity feed will appear here</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              <p>System metrics will appear here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
