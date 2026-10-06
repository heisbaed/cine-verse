import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MovieCard from '@/components/movie/MovieCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import type { MediaItem } from '@/types/tmdb';

interface MovieRowProps {
  title: string;
  movies: MediaItem[];
  isLoading?: boolean;
  autoScroll?: boolean;
}

const MovieRow: React.FC<MovieRowProps> = ({ title, movies, isLoading }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => {
    rowRef.current?.scrollBy({ left: direction * Math.min(window.innerWidth * 0.72, 760), behavior: 'smooth' });
  };

  return (
    <section className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <h2 className="text-lg font-black uppercase tracking-[0.08em] sm:text-xl">{title}</h2>
        <div className="flex gap-1">
          <button onClick={() => scroll(-1)} className="grid h-8 w-8 place-items-center border border-white/15 text-white/60 transition-colors hover:border-gold hover:text-gold" aria-label={`Scroll ${title} left`}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button onClick={() => scroll(1)} className="grid h-8 w-8 place-items-center border border-white/15 text-white/60 transition-colors hover:border-gold hover:text-gold" aria-label={`Scroll ${title} right`}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div ref={rowRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 scrollbar-hide sm:gap-4" role="list" aria-label={title}>
        {isLoading
          ? Array.from({ length: 8 }).map((_, index) => <div key={index} className="snap-start" role="listitem"><SkeletonCard /></div>)
          : movies.map((movie) => <div key={`${getMediaKey(movie)}`} className="snap-start" role="listitem"><MovieCard movie={movie} /></div>)}
      </div>
    </section>
  );
};

const getMediaKey = (movie: MediaItem): string => `${'name' in movie ? 'tv' : 'movie'}-${movie.id}`;

export default MovieRow;
