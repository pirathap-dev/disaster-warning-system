import { NavLink } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, FileText, Activity, Users, Home } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../auth/AuthContext';
import { UserRole } from '../types';

const navItems = [
  { name: 'Ground Reports', path: '/reports', icon: FileText, roles: [UserRole.CITIZEN, UserRole.VOLUNTEER, UserRole.DMC_DUTY_OFFICER, UserRole.DMC_OFFICER] },
  { name: 'Warnings', path: '/warnings', icon: Activity, roles: [UserRole.CITIZEN, UserRole.VOLUNTEER, UserRole.DMC_DUTY_OFFICER, UserRole.DMC_OFFICER] },
  { name: 'Rescue Coordination', path: '/rescue', icon: Users, roles: [UserRole.DISTRICT_OFFICER, UserRole.RESCUE_TEAM] },
  { name: 'Shelter & Relief', path: '/shelter', icon: Home, roles: [UserRole.CITIZEN, UserRole.VOLUNTEER, UserRole.DISTRICT_OFFICER, UserRole.SHELTER_COORDINATOR, UserRole.RESOURCE_ORGANIZATION] },
];

export default function Sidebar() {
  const { session } = useAuth();
  const visibleItems = navItems.filter((item) => session && item.roles.includes(session.user.role));
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full border-r border-slate-800">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <ShieldAlert className="w-8 h-8 text-brand-500 mr-3" />
        <span className="font-bold text-lg tracking-tight">DWECS</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {visibleItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) => cn(
                  'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive 
                    ? 'bg-brand-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <item.icon className="w-5 h-5 mr-3 flex-shrink-0" />
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
