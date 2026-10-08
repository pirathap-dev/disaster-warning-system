import { Bell, UserCircle } from 'lucide-react';

export default function Header() {
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
        <div className="flex items-center space-x-2 cursor-pointer p-1 rounded-md hover:bg-gray-100 transition-colors">
          <UserCircle className="w-8 h-8 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 hidden sm:block">Demo User</span>
        </div>
      </div>
    </header>
  );
}
