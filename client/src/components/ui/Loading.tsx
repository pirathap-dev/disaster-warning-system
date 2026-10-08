import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingProps {
  text?: string;
  className?: string;
  fullScreen?: boolean;
}

export function Loading({ text = 'Loading...', className, fullScreen = false }: LoadingProps) {
  const containerClasses = fullScreen 
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
    : cn("flex flex-col items-center justify-center p-8", className);

  return (
    <div className={containerClasses}>
      <Loader2 className="h-8 w-8 animate-spin text-brand-600 mb-4" />
      <p className="text-sm font-medium text-gray-600">{text}</p>
    </div>
  );
}
