import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MediaItem, MediaType } from '@/types/tmdb';
import { getMediaType } from '@/utils/media';

interface WatchlistStore {
  watchlist: MediaItem[];
  setWatchlist: (items: MediaItem[]) => void;
  addToWatchlist: (item: MediaItem) => void;
  removeFromWatchlist: (id: number, mediaType: MediaType) => void;
  isInWatchlist: (id: number, mediaType: MediaType) => boolean;
}

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      watchlist: [],
      setWatchlist: (items) => set({ watchlist: items }),
      addToWatchlist: (item: MediaItem) => {
        const { watchlist } = get();
        const mediaType = getMediaType(item);
        if (
          !watchlist.some(
            (saved) =>
              saved.id === item.id && getMediaType(saved) === mediaType,
          )
        ) {
          set({ watchlist: [...watchlist, item] });
        }
      },
      removeFromWatchlist: (id: number, mediaType: MediaType) => {
        const { watchlist } = get();
        set({
          watchlist: watchlist.filter(
            (saved) =>
              saved.id !== id || getMediaType(saved) !== mediaType,
          ),
        });
      },
      isInWatchlist: (id: number, mediaType: MediaType) => {
        const { watchlist } = get();
        return watchlist.some(
          (saved) => saved.id === id && getMediaType(saved) === mediaType,
        );
      },
    }),
    {
      name: 'cine-verse-watchlist',
    },
  ),
);
