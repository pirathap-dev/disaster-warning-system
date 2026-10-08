import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import GroundReports from './pages/GroundReports';
import Warnings from './pages/Warnings';
import RescueCoordination from './pages/RescueCoordination';
import ShelterRelief from './pages/ShelterRelief';
import { ToastProvider } from './components/ui/Toast';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="reports" element={<GroundReports />} />
            <Route path="warnings" element={<Warnings />} />
            <Route path="rescue" element={<RescueCoordination />} />
            <Route path="shelter" element={<ShelterRelief />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;

