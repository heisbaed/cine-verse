import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getTrendingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getUpcomingMovies,
  getNowPlayingMovies,
  getTrendingTVShows,
  getPopularTVShows,
  getTopRatedTVShows,
  getOnTheAirTVShows,
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
    overview:
      'A high-energy superhero adventure crossing timelines and chaos.',
    release_date: '2024-07-24',
    vote_average: 7.6,
    vote_count: 7300,
    genre_ids: [28, 35, 878],
    original_language: 'en',
    adult: false,
    video: false,
    popularity: 1000,
  },
  {
    id: 1022789,
    title: 'Inside Out 2',
    original_title: 'Inside Out 2',
    poster_path: '/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg',
    backdrop_path: '/stKGOm8UyhuLPR9sZLjs5AkmncA.jpg',
    overview:
      'Riley enters teenage years as new emotions arrive at headquarters.',
    release_date: '2024-06-11',
    vote_average: 7.6,
    vote_count: 5400,
    genre_ids: [16, 10751, 12],
    original_language: 'en',
    adult: false,
    video: false,
    popularity: 950,
  },
  {
    id: 823464,
    title: 'Godzilla x Kong: The New Empire',
    original_title: 'Godzilla x Kong: The New Empire',
    poster_path: '/z1p34vh7dEOnLDmyCrlUVLuoDzd.jpg',
    backdrop_path: '/j3Z3XktmWB1VhsS8iXNcrR86PXi.jpg',
    overview:
      'Two ancient titans face a hidden threat from deep within the Earth.',
    release_date: '2024-03-27',
    vote_average: 7.1,
    vote_count: 3900,
    genre_ids: [878, 28, 12],
    original_language: 'en',
    adult: false,
    video: false,
    popularity: 900,
  },
];

const Home: React.FC = () => {
  const recentlyViewed = useViewHistoryStore(
    (state) => state.recentlyViewed,
  );

  useSEO({
    title: '',
    description:
      'Discover trending movies and TV series from around the world on Cine-verse.',
  });

  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ['trendingMovies'],
    queryFn: getTrendingMovies,
    enabled: hasApiKey(),
  });

  const { data: popularData, isLoading: popularLoading } = useQuery({
    queryKey: ['popularMovies'],
    queryFn: getPopularMovies,
    enabled: hasApiKey(),
  });

  const { data: topRatedData, isLoading: topRatedLoading } = useQuery({
    queryKey: ['topRatedMovies'],
    queryFn: getTopRatedMovies,
    enabled: hasApiKey(),
  });

  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ['upcomingMovies'],
    queryFn: getUpcomingMovies,
    enabled: hasApiKey(),
  });

  const { data: nowPlayingData, isLoading: nowPlayingLoading } = useQuery({
    queryKey: ['nowPlayingMovies'],
    queryFn: getNowPlayingMovies,
    enabled: hasApiKey(),
  });

  const { data: trendingTVData, isLoading: trendingTVLoading } = useQuery({
    queryKey: ['trendingTVShows'],
    queryFn: getTrendingTVShows,
    enabled: hasApiKey(),
  });

  const { data: popularTVData, isLoading: popularTVLoading } = useQuery({
    queryKey: ['popularTVShows'],
    queryFn: getPopularTVShows,
    enabled: hasApiKey(),
  });

  const { data: topRatedTVData, isLoading: topRatedTVLoading } = useQuery({
    queryKey: ['topRatedTVShows'],
    queryFn: getTopRatedTVShows,
    enabled: hasApiKey(),
  });

  const { data: onTheAirTVData, isLoading: onTheAirTVLoading } = useQuery({
    queryKey: ['onTheAirTVShows'],
    queryFn: getOnTheAirTVShows,
    enabled: hasApiKey(),
  });

  const trendingMovies = hasApiKey()
    ? trendingData?.results || []
    : fallbackMovies;
  const popularMovies = hasApiKey()
    ? popularData?.results || []
    : fallbackMovies;
  const topRatedMovies = hasApiKey()
    ? topRatedData?.results || []
    : fallbackMovies;
  const upcomingMovies = hasApiKey()
    ? upcomingData?.results || []
    : fallbackMovies;
  const nowPlayingMovies = hasApiKey()
    ? nowPlayingData?.results || []
    : fallbackMovies;
  const trendingTVShows = trendingTVData?.results || [];
  const popularTVShows = popularTVData?.results || [];
  const topRatedTVShows = topRatedTVData?.results || [];
  const onTheAirTVShows = onTheAirTVData?.results || [];

  if (!hasApiKey()) {
    return <SetupScreen />;
  }

  return (
    <div className="min-h-screen">
      <HeroCarousel movies={trendingMovies.slice(0, 5)} />

      <div id="discover" className="scroll-mt-24 space-y-14 pb-24 pt-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.32em] text-gold">
              The curtain rises here
            </p>
            <h2 className="cinema-title text-4xl font-black leading-tight sm:text-6xl">
              The screen is yours.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/55 sm:text-lg">
              Start with what the world is watching, then wander through every
              corner of cinema at your own pace.
            </p>
          </div>
        </div>
        {recentlyViewed.length > 0 && (
          <MovieRow
            title="Continue Browsing"
            movies={recentlyViewed.slice(0, 12)}
          />
        )}
        <MovieRow
          title="In the Spotlight"
          movies={trendingMovies}
          isLoading={trendingLoading}
          autoScroll
        />
        <MovieRow
          title="Trending Series"
          movies={trendingTVShows}
          isLoading={trendingTVLoading}
          autoScroll
        />
        <MovieRow
          title="Now Playing"
          movies={nowPlayingMovies}
          isLoading={nowPlayingLoading}
        />
        <MovieRow
          title="On the Air"
          movies={onTheAirTVShows}
          isLoading={onTheAirTVLoading}
        />
        <MovieRow
          title="Upcoming"
          movies={upcomingMovies}
          isLoading={upcomingLoading}
        />
        <MovieRow
          title="Popular"
          movies={popularMovies}
          isLoading={popularLoading}
        />
        <MovieRow
          title="Popular TV Shows"
          movies={popularTVShows}
          isLoading={popularTVLoading}
        />
        <MovieRow
          title="Top Rated"
          movies={topRatedMovies}
          isLoading={topRatedLoading}
        />
        <MovieRow
          title="Top Rated Series"
          movies={topRatedTVShows}
          isLoading={topRatedTVLoading}
        />
      </div>
    </div>
  );
};

export default Home;
