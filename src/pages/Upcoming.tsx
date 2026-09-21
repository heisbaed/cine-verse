import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { getUpcomingMovies, hasApiKey } from '@/api/tmdb';
import MovieGrid from '@/components/sections/MovieGrid';
import SetupScreen from '@/components/sections/SetupScreen';
import ErrorState from '@/components/ui/ErrorState';
import { useSEO } from '@/hooks/useSEO';

const getDaysUntil = (dateStr: string): number => {
  const releaseDate = new Date(dateStr);
  const today = new Date();
  const diffTime = releaseDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getMonthYear = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
};

const Upcoming: React.FC = () => {
  useSEO({
    title: 'Upcoming Releases',
    description:
      'Browse upcoming movie releases with release dates and countdowns on Cine-verse.',
  });

  const {
    data: upcomingData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['upcomingMovies'],
    queryFn: getUpcomingMovies,
    enabled: hasApiKey(),
  });

  if (!hasApiKey()) {
    return <SetupScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen px-6 py-10">
        <ErrorState
          message="Failed to load upcoming movies."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const movies = upcomingData?.results || [];

  const groupedByMonth: Record<string, typeof movies> = {};
  movies.forEach((movie) => {
    if (!movie.release_date) return;
    const key = getMonthYear(movie.release_date);
    if (!groupedByMonth[key]) {
      groupedByMonth[key] = [];
    }
    groupedByMonth[key].push(movie);
  });

  return (
    <div className="min-h-screen px-6 py-10">
      <h1 className="text-4xl sm:text-5xl font-black mb-8">
        Upcoming Releases
      </h1>

      {isLoading ? (
        <MovieGrid movies={[]} isLoading={true} />
      ) : (
        <div className="space-y-12">
          {/* Timeline View */}
          <div className="space-y-8">
            {Object.entries(groupedByMonth).map(([monthYear, monthMovies]) => (
              <div key={monthYear}>
                <h2 className="text-2xl font-black text-gold mb-4 flex items-center gap-2">
                  <CalendarDays size={24} aria-hidden="true" />
                  {monthYear}
                </h2>
                <div className="space-y-4">
                  {monthMovies.map((movie) => {
                    const daysUntil = getDaysUntil(movie.release_date);
                    return (
                      <a
                        key={movie.id}
                        href={`/movie/${movie.id}`}
                        className="block bg-surface border border-white/10 rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-6 hover:border-gold/30 transition-all group"
                      >
                        <div className="flex-shrink-0">
                          <img
                            src={`https://image.tmdb.org/t/p/w154${movie.poster_path}`}
                            alt={`${movie.title} poster`}
                            className="w-24 rounded-xl shadow-lg group-hover:scale-105 transition-transform"
                            loading="lazy"
                          />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                          <h3 className="text-2xl font-bold mb-2 group-hover:text-gold transition-colors">
                            {movie.title}
                          </h3>
                          <div className="flex items-center justify-center sm:justify-start flex-wrap gap-3 text-white/70">
                            <CalendarDays
                              size={18}
                              className="text-gold"
                              aria-hidden="true"
                            />
                            <span>
                              {new Date(
                                movie.release_date,
                              ).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                            {daysUntil > 0 && (
                              <span className="px-3 py-1 rounded-full bg-gold/20 text-gold font-bold text-sm">
                                {daysUntil} days left
                              </span>
                            )}
                            {daysUntil <= 0 && daysUntil > -30 && (
                              <span className="px-3 py-1 rounded-full bg-emerald/20 text-emerald font-bold text-sm">
                                Now Playing
                              </span>
                            )}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Grid View */}
          <div>
            <h2 className="text-3xl font-black mb-6">Browse Posters</h2>
            <MovieGrid movies={movies} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Upcoming;
