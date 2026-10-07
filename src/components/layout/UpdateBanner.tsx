import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { UPDATE_EVENT, applySwUpdate } from '@/lib/swUpdate';

/**
 * "New version available" pill. The service worker (autoUpdate) downloads
 * releases in the background; this banner is the only thing that moves the
 * user onto them — otherwise stale bundles linger, especially on phones.
 */
const UpdateBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener(UPDATE_EVENT, show);
    return () => window.removeEventListener(UPDATE_EVENT, show);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full border border-gold/40 bg-surface/95 py-2 pl-4 pr-2 shadow-2xl backdrop-blur md:bottom-6"
    >
      <span className="whitespace-nowrap text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
        New version available
      </span>
      <button
        type="button"
        onClick={() => applySwUpdate()}
        className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-background transition-colors hover:bg-white"
      >
        <RefreshCw size={13} aria-hidden="true" /> Refresh
      </button>
    </div>
  );
};

export default UpdateBanner;
