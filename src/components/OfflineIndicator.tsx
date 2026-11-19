import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-5 left-4 z-50 flex items-center gap-2 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl px-4 py-2.5 text-xs font-medium text-[#1D1D1F] dark:text-[#F5F5F7] shadow-lg"
    >
      <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
      <span>Offline mode · Saved spots, phrases & checklists ready</span>
    </div>
  );
};
