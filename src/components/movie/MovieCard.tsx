import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Bookmark, BookmarkCheck, Play, Star } from 'lucide-react';
import { getImageUrl, getMovieVideos, getTVVideos } from '@/api/tmdb';
import { useWatchlistStore } from '@/store/watchlistStore';
import type { MediaItem } from '@/types/tmdb';
import { getMediaDate, getMediaTitle, getMediaType } from '@/utils/media';

interface MovieCardProps {
  movie: MediaItem;
  index?: number;
}

const getReleaseBadge = (date: string): string | null => {
  if (!date) return null;
  const releaseTime = new Date(date).getTime();
  if (!Number.isFinite(releaseTime)) return null;
  const daysFromToday = (releaseTime - Date.now()) / 86_400_000;
  if (daysFromToday > 0) return 'Coming soon';
  if (daysFromToday > -90) return 'New release';
  return null;
};

const MovieCard: React.FC<MovieCardProps> = ({ movie, index = 0 }) => {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } =
    useWatchlistStore();
  const mediaType = getMediaType(movie);
  const title = getMediaTitle(movie);
  const date = getMediaDate(movie);
  const releaseBadge = getReleaseBadge(date);
  const inWatchlist = isInWatchlist(movie.id, mediaType);
  const [previewRequested, setPreviewRequested] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotateXValue = useMotionValue(0);
  const rotateYValue = useMotionValue(0);
  const rotateX = useSpring(rotateXValue, { stiffness: 220, damping: 24 });
  const rotateY = useSpring(rotateYValue, { stiffness: 220, damping: 24 });

  const { data: previewVideos } = useQuery({
    queryKey: ['cardTrailer', mediaType, movie.id],
    queryFn: () =>
      mediaType === 'tv' ? getTVVideos(movie.id) : getMovieVideos(movie.id),
    enabled: previewRequested,
    staleTime: 1000 * 60 * 30,
  });

  const trailer =
    previewVideos?.results.find(
      (video) =>
        video.site === 'YouTube' &&
        video.type === 'Trailer' &&
        video.official,
    ) ||
    previewVideos?.results.find(
      (video) => video.site === 'YouTube' && video.type === 'Trailer',
    );

  useEffect(
    () => () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    },
    [],
  );

  const handlePointerEnter = () => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    previewTimer.current = setTimeout(() => setPreviewRequested(true), 900);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const horizontal = (event.clientX - rect.left) / rect.width - 0.5;
    const vertical = (event.clientY - rect.top) / rect.height - 0.5;
    rotateYValue.set(horizontal * 8);
    rotateXValue.set(vertical * -8);
  };

  const handlePointerLeave = () => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreviewRequested(false);
    rotateXValue.set(0);
    rotateYValue.set(0);
  };

  const handleBookmarkClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (inWatchlist) {
      removeFromWatchlist(movie.id, mediaType);
    } else {
      addToWatchlist(movie);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      whileHover={{ y: -8, scale: 1.025 }}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 900,
        transformStyle: 'preserve-3d',
      }}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="media-on-dark group relative w-44 flex-shrink-0 text-white sm:w-52"
    >
      <div className="pointer-events-none absolute -inset-2 rounded-[1.35rem] bg-gradient-to-br from-gold/25 via-transparent to-ruby/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />

      <Link
        to={`/${mediaType}/${movie.id}`}
        className="relative block overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-[0_18px_50px_rgba(0,0,0,0.45)] transition-colors group-hover:border-gold/35"
        aria-label={`View details for ${title}`}
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-background">
          <img
            src={getImageUrl(movie.poster_path, 'w500')}
            alt={`${title} poster`}
            className={`h-full w-full object-cover transition-all duration-700 group-hover:scale-110 ${
              trailer && previewRequested ? 'opacity-0' : 'opacity-100'
            }`}
            loading="lazy"
          />
          {trailer && previewRequested && (
            <iframe
              src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailer.key}&playsinline=1&rel=0&modestbranding=1`}
              title={`${title} trailer preview`}
              className="pointer-events-none absolute inset-0 h-full w-full scale-[1.45] border-0"
              allow="autoplay; encrypted-media; picture-in-picture"
              tabIndex={-1}
            />
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent opacity-95" />
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />

        <div className="absolute left-3 top-3 flex max-w-[7.5rem] flex-col items-start gap-1.5">
          {mediaType === 'tv' && (
            <span className="rounded-full border border-white/15 bg-background/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-gold backdrop-blur-md">
              Series
            </span>
          )}
          {releaseBadge && (
            <span className="rounded-full bg-ruby px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-lg">
              {releaseBadge}
            </span>
          )}
        </div>

        {trailer && previewRequested && (
          <span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gold text-background shadow-xl">
            <Play size={14} fill="currentColor" aria-hidden="true" />
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="line-clamp-2 text-lg font-bold leading-tight">
            {title}
          </h3>
          <p className="mt-2 hidden max-h-0 overflow-hidden text-xs leading-relaxed text-white/60 opacity-0 transition-all duration-500 group-hover:max-h-20 group-hover:opacity-100 sm:block line-clamp-3">
            {movie.overview || 'Open this title to discover the full story.'}
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm text-white/70">
            <span className="flex items-center gap-1 text-gold">
              <Star size={14} fill="currentColor" aria-hidden="true" />
              <span className="font-bold">{movie.vote_average.toFixed(1)}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{date?.split('-')[0] || 'TBA'}</span>
          </div>
        </div>
      </Link>

      <button
        onClick={handleBookmarkClick}
        className="absolute right-3 top-3 z-20 rounded-full border border-white/20 bg-background/65 p-2 text-gold backdrop-blur-md transition-all hover:bg-gold hover:text-background focus:outline-none focus:ring-2 focus:ring-gold/50"
        aria-label={
          inWatchlist
            ? `Remove ${title} from watchlist`
            : `Add ${title} to watchlist`
        }
      >
        {inWatchlist ? (
          <BookmarkCheck size={19} aria-hidden="true" />
        ) : (
          <Bookmark size={19} aria-hidden="true" />
        )}
      </button>
    </motion.div>
  );
};

export default MovieCard;
