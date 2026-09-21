import React from 'react';
import MovieCard from '@/components/movie/MovieCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import type { MediaItem } from '@/types/tmdb';
import { getMediaType } from '@/utils/media';

interface MovieGridProps {
  movies: MediaItem[];
  isLoading?: boolean;
}

const MovieGrid: React.FC<MovieGridProps> = ({ movies, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {movies.map((movie, idx) => (
        <MovieCard
          key={`${getMediaType(movie)}-${movie.id}`}
          movie={movie}
          index={idx}
        />
      ))}
    </div>
  );
};

export default MovieGrid;
