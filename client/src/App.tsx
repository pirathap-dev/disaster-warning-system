import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import GroundReports from './pages/GroundReports';
import Warnings from './pages/Warnings';
import RescueCoordination from './pages/RescueCoordination';
import ShelterRelief from './pages/ShelterRelief';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './auth/AuthContext';
import { RoleRoute, UserHome } from './auth/RequireRole';
import { UserRole } from './types';
import Login from './pages/Login';
import TestAccess from './pages/TestAccess';

const testAccessEnabled = import.meta.env.VITE_ENABLE_TEST_ACCESS === 'true' &&
  (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'demo');

function TestAccessNotFound() {
  return <main className="min-h-screen bg-slate-100 p-8"><h1 className="text-2xl font-bold text-slate-900">404 · Page not found</h1></main>;
}

const citizens = [UserRole.CITIZEN, UserRole.VOLUNTEER];
const dmc = [UserRole.DMC_DUTY_OFFICER, UserRole.DMC_OFFICER];
const responseRoles = [UserRole.DISTRICT_OFFICER, UserRole.RESCUE_TEAM];
const shelterRoles = [UserRole.CITIZEN, UserRole.VOLUNTEER, UserRole.DISTRICT_OFFICER, UserRole.SHELTER_COORDINATOR, UserRole.RESOURCE_ORGANIZATION];

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
       <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/test-access" element={testAccessEnabled ? <TestAccess /> : <TestAccessNotFound />} />
          <Route path="/" element={<AppLayout />}>
            <Route index element={<UserHome />} />
            <Route path="dashboard" element={<RoleRoute roles={Object.values(UserRole)}><UserHome /></RoleRoute>} />
            <Route path="reports" element={<RoleRoute roles={[...citizens, ...dmc]}><GroundReports /></RoleRoute>} />
            <Route path="warnings" element={<RoleRoute roles={[...citizens, ...dmc]}><Warnings /></RoleRoute>} />
            <Route path="rescue" element={<RoleRoute roles={responseRoles}><RescueCoordination /></RoleRoute>} />
            <Route path="shelter" element={<RoleRoute roles={shelterRoles}><ShelterRelief /></RoleRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
       </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;

