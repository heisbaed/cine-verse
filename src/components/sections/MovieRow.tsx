import React, { useEffect, useRef } from 'react';
import MovieCard from '@/components/movie/MovieCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import type { MediaItem } from '@/types/tmdb';

interface MovieRowProps {
  title: string;
  movies: MediaItem[];
  isLoading?: boolean;
  autoScroll?: boolean;
}

const MovieRow: React.FC<MovieRowProps> = ({
  title,
  movies,
  isLoading,
  autoScroll = false,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (
      !autoScroll ||
      isLoading ||
      movies.length === 0 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      const row = rowRef.current;
      if (!row || pausedRef.current) return;

      const reachedEnd =
        row.scrollLeft + row.clientWidth >= row.scrollWidth - 24;
      row.scrollTo({
        left: reachedEnd ? 0 : row.scrollLeft + Math.min(row.clientWidth * 0.72, 720),
        behavior: 'smooth',
      });
    }, 3600);

    return () => window.clearInterval(interval);
  }, [autoScroll, isLoading, movies.length]);

  return (
    <section className="px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-3xl font-black">{title}</h2>
        {autoScroll && (
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.24em] text-white/30 sm:block">
            Auto-curated reel
          </span>
        )}
      </div>
      <div
        ref={rowRef}
        className="flex snap-x gap-5 overflow-x-auto pb-5 pt-3 scrollbar-hide"
        role="list"
        aria-label={title}
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        onFocus={() => {
          pausedRef.current = true;
        }}
        onBlur={() => {
          pausedRef.current = false;
        }}
      >
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="snap-start" role="listitem">
                <SkeletonCard />
              </div>
            ))
          : movies.map((movie, idx) => (
              <div key={movie.id} className="snap-start" role="listitem">
                <MovieCard movie={movie} index={idx} />
              </div>
            ))}
      </div>
    </section>
  );
};

export default MovieRow;
