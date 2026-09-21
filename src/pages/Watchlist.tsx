import React from 'react';
import { Bookmark } from 'lucide-react';
import MovieCard from '@/components/movie/MovieCard';
import EmptyState from '@/components/ui/EmptyState';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useSEO } from '@/hooks/useSEO';
import { getMediaType } from '@/utils/media';

const Watchlist: React.FC = () => {
  useSEO({
    title: 'My Watchlist',
    description: 'View your saved movies and TV series on Cine-verse.',
  });

  const { watchlist } = useWatchlistStore();

  return (
    <div className="min-h-screen px-6 py-10">
      <h1 className="text-4xl sm:text-5xl font-black mb-8 flex items-center gap-3">
        <Bookmark size={40} className="text-gold" aria-hidden="true" />
        My Watchlist
      </h1>

      {watchlist.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {watchlist.map((item, idx) => (
            <MovieCard
              key={`${getMediaType(item)}-${item.id}`}
              movie={item}
              index={idx}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your watchlist is empty"
          message="Start adding movies and series you want to watch!"
          icon={<Bookmark size={64} aria-hidden="true" />}
        />
      )}
    </div>
  );
};

export default Watchlist;
