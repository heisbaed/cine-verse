import React from 'react';
import { Bookmark, BookmarkCheck, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getImageUrl } from '@/api/tmdb';
import { useWatchlistStore } from '@/store/watchlistStore';
import type { MediaItem } from '@/types/tmdb';
import { getMediaDate, getMediaTitle, getMediaType } from '@/utils/media';

interface MovieCardProps {
  movie: MediaItem;
  index?: number;
}

const MovieCard: React.FC<MovieCardProps> = ({ movie }) => {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlistStore();
  const mediaType = getMediaType(movie);
  const title = getMediaTitle(movie);
  const year = getMediaDate(movie)?.split('-')[0] || 'TBA';
  const inWatchlist = isInWatchlist(movie.id, mediaType);

  const toggleWatchlist = (event: React.MouseEvent) => {
    event.preventDefault();
    if (inWatchlist) removeFromWatchlist(movie.id, mediaType);
    else addToWatchlist(movie);
  };

  return (
    <article className="group relative w-36 flex-shrink-0 sm:w-44 lg:w-48">
      <Link to={`/${mediaType}/${movie.id}`} className="block focus:outline-none focus:ring-2 focus:ring-gold" aria-label={`View details for ${title}`}>
        <div className="relative aspect-[2/3] overflow-hidden bg-surface">
          <img
            src={getImageUrl(movie.poster_path, 'w500')}
            alt={`${title} poster`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
            loading="lazy"
          />
          {mediaType === 'tv' && (
            <span className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white">Series</span>
          )}
        </div>
        <h3 className="mt-3 truncate text-sm font-bold tracking-tight sm:text-base">{title}</h3>
        <p className="mt-1 flex items-center gap-2 text-xs text-white/48">
          <span>{year}</span>
          <span className="inline-flex items-center gap-1 text-gold"><Star size={11} fill="currentColor" aria-hidden="true" /> {movie.vote_average.toFixed(1)}</span>
        </p>
      </Link>
      <button
        onClick={toggleWatchlist}
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center bg-black/80 text-white transition-colors hover:bg-gold hover:text-black focus:outline-none focus:ring-2 focus:ring-gold"
        aria-label={inWatchlist ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
      >
        {inWatchlist ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
      </button>
    </article>
  );
};

export default MovieCard;
