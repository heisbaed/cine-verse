import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  getImageUrl,
  getMovieCredits,
  getNowPlayingMovies,
  getTopRatedMovies,
  getTrendingMovies,
  getTrendingTVShows,
  getUpcomingMovies,
  hasApiKey,
} from '@/api/tmdb';
import HeroCarousel from '@/components/sections/HeroCarousel';
import MovieRow from '@/components/sections/MovieRow';
import SetupScreen from '@/components/sections/SetupScreen';
import { useSEO } from '@/hooks/useSEO';
import { useViewHistoryStore } from '@/store/viewHistoryStore';
import type { Movie } from '@/types/tmdb';

const fallbackMovies: Movie[] = [
  {
    id: 533535,
    title: 'Deadpool & Wolverine',
    original_title: 'Deadpool & Wolverine',
    poster_path: '/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
    backdrop_path: '/yDHYTfA3R0jFYba16jBB1ef8oIt.jpg',
    overview: 'A high-energy superhero adventure crossing timelines and chaos.',
    release_date: '2024-07-24',
    vote_average: 7.6,
    vote_count: 7300,
    genre_ids: [28, 35, 878],
    original_language: 'en',
    adult: false,
    video: false,
    popularity: 1000,
  },
];

const Home: React.FC = () => {
  const recentlyViewed = useViewHistoryStore((state) => state.recentlyViewed);
  const apiReady = hasApiKey();

  useSEO({
    title: '',
    description: 'Discover trending movies and TV series from around the world on Cine-verse.',
  });

  const trending = useQuery({ queryKey: ['trendingMovies'], queryFn: getTrendingMovies, enabled: apiReady });
  const television = useQuery({ queryKey: ['trendingTVShows'], queryFn: getTrendingTVShows, enabled: apiReady });
  const nowPlaying = useQuery({ queryKey: ['nowPlayingMovies'], queryFn: getNowPlayingMovies, enabled: apiReady });
  const upcoming = useQuery({ queryKey: ['upcomingMovies'], queryFn: getUpcomingMovies, enabled: apiReady });
  const topRated = useQuery({ queryKey: ['topRatedMovies'], queryFn: getTopRatedMovies, enabled: apiReady });

  const trendingMovies = apiReady ? trending.data?.results || [] : fallbackMovies;
  const nowPlayingMovies = apiReady ? nowPlaying.data?.results || [] : fallbackMovies;
  const featuredMovie = trendingMovies[0];
  const featuredCredits = useQuery({
    queryKey: ['homeSpotlightCredits', featuredMovie?.id],
    queryFn: () => getMovieCredits(featuredMovie.id),
    enabled: apiReady && !!featuredMovie?.id,
  });
  const actors = featuredCredits.data?.cast.filter((person) => person.profile_path).slice(0, 3) || [];

  if (!apiReady) return <SetupScreen />;

  return (
    <div className="min-h-screen">
      <HeroCarousel movies={trendingMovies.slice(0, 5)} />

      <section className="mx-auto max-w-[1500px] px-5 py-10 sm:px-8 lg:px-10">
        <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-black">You might like</h2>
              <Link to="/explore" className="text-xs font-bold text-gold hover:underline">See all</Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {nowPlayingMovies.slice(0, 4).map((movie) => (
                <Link key={movie.id} to={`/movie/${movie.id}`} className="group overflow-hidden rounded-xl border border-white/10 bg-surface">
                  <img src={getImageUrl(movie.backdrop_path, 'w780')} alt="" className="aspect-[16/8] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <div className="flex min-w-0 items-center gap-3 p-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-black"><Play size={11} fill="currentColor" /></span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{movie.title}</strong><span className="text-[10px] text-white/40">{movie.release_date?.split('-')[0] || 'TBA'} · Movie</span></span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-gold"><Star size={11} fill="currentColor" />{movie.vote_average.toFixed(1)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {actors.length > 0 && (
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-black">Trending cast</h2>
                <Link to={`/movie/${featuredMovie.id}`} className="text-xs font-bold text-gold hover:underline">Full cast</Link>
              </div>
              <div className="media-on-dark mt-5 grid overflow-hidden rounded-xl border border-gold/45 bg-black text-white sm:grid-cols-3 xl:grid-cols-[1.2fr_0.8fr] xl:grid-rows-2">
                {actors.map((actor, index) => (
                  <Link
                    key={actor.id}
                    to={`/explore?person=${actor.id}&personName=${encodeURIComponent(actor.name)}`}
                    className={`group relative min-h-52 overflow-hidden border-gold/25 ${index === 0 ? 'sm:col-span-1 xl:row-span-2 xl:min-h-[360px] xl:border-r' : 'border-l sm:border-l xl:min-h-0 xl:border-b xl:border-l-0 last:border-b-0'}`}
                  >
                    <img src={getImageUrl(actor.profile_path, 'w500')} alt={actor.name} className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/82 p-3">
                      <h3 className="truncate text-sm font-black">{actor.name}</h3>
                      <p className="mt-1 truncate text-[9px] text-white/50">{actor.character}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="space-y-10 border-t border-white/10 pb-24 pt-10 sm:space-y-12">
        {recentlyViewed.length > 0 && <MovieRow title="Continue browsing" movies={recentlyViewed.slice(0, 12)} />}
        <MovieRow title="Trending now" movies={trendingMovies} isLoading={trending.isLoading} />
        <MovieRow title="Series" movies={television.data?.results || []} isLoading={television.isLoading} />
        <MovieRow title="Coming soon" movies={upcoming.data?.results || []} isLoading={upcoming.isLoading} />
        <MovieRow title="Critics' choice" movies={topRated.data?.results || []} isLoading={topRated.isLoading} />
      </div>
    </div>
  );
};

export default Home;
