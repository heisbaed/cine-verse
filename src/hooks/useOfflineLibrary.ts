import { useEffect, useState } from 'react';
import { listOfflineItems } from '@/api/offline';
import type { OfflineItem } from '@/types/playback';

const UPDATE_EVENT = 'cineverse-offline-updated';

export function useOfflineLibrary(): OfflineItem[] {
  const [items, setItems] = useState<OfflineItem[]>(() => listOfflineItems());

  useEffect(() => {
    const refresh = () => setItems(listOfflineItems());
    refresh();
    window.addEventListener(UPDATE_EVENT, refresh);
    return () => window.removeEventListener(UPDATE_EVENT, refresh);
  }, []);

  return items;
}
