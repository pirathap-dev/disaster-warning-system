import { Bell, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export default function Header() {
  const { session, logout } = useAuth();
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-10 flex-shrink-0">
      <div className="flex-1">
        <h1 className="text-xl font-semibold text-gray-800">Disaster Management System</h1>
      </div>
      <div className="flex items-center space-x-4">
        <button className="text-gray-500 hover:text-brand-600 relative p-1 rounded-full hover:bg-gray-100 transition-colors">
          <Bell className="w-6 h-6" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center space-x-2 p-1">
          <UserCircle className="w-8 h-8 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 hidden sm:block">{session?.user.name}</span>
          <button aria-label="Sign out" title="Sign out" onClick={logout} className="p-2 rounded-md text-slate-500 hover:bg-slate-100"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>
    </header>
  );
}
