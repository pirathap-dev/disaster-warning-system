import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-0 right-0 p-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center justify-between p-4 rounded-lg shadow-lg max-w-md w-full animate-in slide-in-from-right",
              t.type === 'success' && "bg-green-50 border-l-4 border-green-500",
              t.type === 'error' && "bg-red-50 border-l-4 border-red-500",
              t.type === 'info' && "bg-blue-50 border-l-4 border-blue-500"
            )}
          >
            <div className="flex items-center">
              {t.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500 mr-3" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 mr-3" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-blue-500 mr-3" />}
              <p className={cn(
                "text-sm font-medium",
                t.type === 'success' && "text-green-800",
                t.type === 'error' && "text-red-800",
                t.type === 'info' && "text-blue-800"
              )}>{t.message}</p>
            </div>
            <button 
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
