import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MediaItem } from '@/types/tmdb';
import { getMediaType } from '@/utils/media';

interface ViewHistoryStore {
  recentlyViewed: MediaItem[];
  setRecentlyViewed: (items: MediaItem[]) => void;
  addRecentlyViewed: (item: MediaItem) => void;
  clearRecentlyViewed: () => void;
}

export const useViewHistoryStore = create<ViewHistoryStore>()(
  persist(
    (set, get) => ({
      recentlyViewed: [],
      setRecentlyViewed: (items) => set({ recentlyViewed: items.slice(0, 20) }),
      addRecentlyViewed: (item) => {
        const mediaType = getMediaType(item);
        const nextItems = get().recentlyViewed.filter(
          (saved) =>
            saved.id !== item.id || getMediaType(saved) !== mediaType,
        );
        set({ recentlyViewed: [item, ...nextItems].slice(0, 20) });
      },
      clearRecentlyViewed: () => set({ recentlyViewed: [] }),
    }),
    {
      name: 'cine-verse-view-history',
    },
  ),
);
