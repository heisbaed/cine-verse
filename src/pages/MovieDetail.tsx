import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Star,
  Clock,
  Globe,
  User,
  DollarSign,
  TrendingUp,
  Calendar,
  Play,
  Share2,
} from 'lucide-react';
import {
  getMovieDetails,
  getMovieCredits,
  getMovieVideos,
  getSimilarMovies,
  getRecommendedMovies,
  getMovieReviews,
  getImageUrl,
} from '@/api/tmdb';
import MovieCard from '@/components/movie/MovieCard';
import CastCarousel from '@/components/sections/CastCarousel';
import CrewSection from '@/components/sections/CrewSection';
import TrailerSection from '@/components/sections/TrailerSection';
import TrailerModal from '@/components/sections/TrailerModal';
import VideoPlayer from '@/components/sections/VideoPlayer';
import ReviewsSection from '@/components/sections/ReviewsSection';
import ErrorState from '@/components/ui/ErrorState';
import { useSEO } from '@/hooks/useSEO';
import { useViewHistoryStore } from '@/store/viewHistoryStore';
import { getMovieEmbedSources } from '@/utils/embedSources';

const formatCurrency = (amount: number): string => {
  if (amount === 0) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

const MovieDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const movieId = parseInt(id || '0');

  const {
    data: movieDetails,
    isLoading: detailsLoading,
    error: detailsError,
    refetch: refetchDetails,
  } = useQuery({
    queryKey: ['movieDetails', movieId],
    queryFn: () => getMovieDetails(movieId),
    enabled: !!movieId,
  });

  const {
    data: credits,
    error: creditsError,
    refetch: refetchCredits,
  } = useQuery({
    queryKey: ['movieCredits', movieId],
    queryFn: () => getMovieCredits(movieId),
    enabled: !!movieId,
  });

  const {
    data: videos,
    error: videosError,
    refetch: refetchVideos,
  } = useQuery({
    queryKey: ['movieVideos', movieId],
    queryFn: () => getMovieVideos(movieId),
    enabled: !!movieId,
  });

  const { data: similarMovies } = useQuery({
    queryKey: ['similarMovies', movieId],
    queryFn: () => getSimilarMovies(movieId),
    enabled: !!movieId,
  });

  const { data: recommendedMovies } = useQuery({
    queryKey: ['recommendedMovies', movieId],
    queryFn: () => getRecommendedMovies(movieId),
    enabled: !!movieId,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['movieReviews', movieId],
    queryFn: () => getMovieReviews(movieId),
    enabled: !!movieId,
  });

  const [trailerOpen, setTrailerOpen] = useState(false);
  const [watchMode, setWatchMode] = useState<'trailer' | 'movie'>('trailer');
  const mediaSectionRef = useRef<HTMLDivElement>(null);
  const addRecentlyViewed = useViewHistoryStore(
    (state) => state.addRecentlyViewed,
  );

  useEffect(() => {
    if (movieDetails) addRecentlyViewed(movieDetails);
  }, [movieDetails, addRecentlyViewed]);

  useSEO({
    title: movieDetails?.title || 'Movie Details',
    description: movieDetails?.overview?.slice(0, 160) || '',
  });

  if (!movieId) {
    return (
      <ErrorState message="Invalid movie ID." onRetry={() => window.location.reload()} />
    );
  }

  if (detailsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gold text-2xl animate-pulse font-bold">
          Loading...
        </div>
      </div>
    );
  }

  if (detailsError || !movieDetails) {
    return (
      <div className="min-h-screen px-6 py-20">
        <ErrorState
          message="Failed to load movie details."
          onRetry={() => refetchDetails()}
        />
      </div>
    );
  }

  const trailer = videos?.results.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official,
  ) || videos?.results[0];

  const director = credits?.crew.find((c) => c.job === 'Director');
  const cast = credits?.cast || [];
  const crew = credits?.crew || [];

  const showFullMovie = () => {
    setWatchMode('movie');
    window.requestAnimationFrame(() => {
      mediaSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const shareMovie = async () => {
    const shareData = {
      title: movieDetails.title,
      text: `Discover ${movieDetails.title} on Cine-verse.`,
      url: window.location.href,
    };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="relative h-[60vh]">
        <img
          src={getImageUrl(movieDetails.backdrop_path, 'original')}
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      <div className="relative -mt-48 px-6 pb-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="sticky top-24"
            >
              <img
                src={getImageUrl(movieDetails.poster_path, 'w500')}
                alt={`${movieDetails.title} poster`}
                className="w-full rounded-3xl shadow-2xl border border-white/10"
              />
            </motion.div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex flex-wrap gap-2 mb-4">
                <span
                  className={`px-3 py-1 rounded-full font-bold text-sm ${
                    movieDetails.status === 'Released'
                      ? 'bg-emerald/20 text-emerald'
                      : movieDetails.status === 'Post Production'
                        ? 'bg-electric/20 text-electric'
                        : 'bg-gold/20 text-gold'
                  }`}
                >
                  {movieDetails.status}
                </span>
                {movieDetails.genres.slice(0, 4).map((g) => (
                  <span
                    key={g.id}
                    className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-sm"
                  >
                    {g.name}
                  </span>
                ))}
              </div>

              <h1 className="text-5xl sm:text-6xl font-black mb-4 leading-tight">
                {movieDetails.title}
              </h1>

              {movieDetails.tagline && (
                <p className="text-2xl text-gold/80 italic mb-6">
                  &ldquo;{movieDetails.tagline}&rdquo;
                </p>
              )}

              <p className="text-lg text-white/70 leading-relaxed mb-8">
                {movieDetails.overview}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-surface p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2 text-gold mb-1">
                    <Star size={18} fill="currentColor" aria-hidden="true" />
                    <span className="font-black text-xl">
                      {movieDetails.vote_average.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-white/50 text-sm">
                    Rating ({movieDetails.vote_count.toLocaleString()})
                  </div>
                </div>
                {movieDetails.runtime > 0 && (
                  <div className="bg-surface p-4 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-2 text-gold mb-1">
                      <Clock size={18} aria-hidden="true" />
                      <span className="font-black text-xl">
                        {Math.floor(movieDetails.runtime / 60)}h{' '}
                        {movieDetails.runtime % 60}m
                      </span>
                    </div>
                    <div className="text-white/50 text-sm">Runtime</div>
                  </div>
                )}
                <div className="bg-surface p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2 text-gold mb-1">
                    <Globe size={18} aria-hidden="true" />
                    <span className="font-black text-xl">
                      {movieDetails.original_language.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-white/50 text-sm">Language</div>
                </div>
                {director && (
                  <div className="bg-surface p-4 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-2 text-gold mb-1">
                      <User size={18} aria-hidden="true" />
                      <span className="font-black text-xl truncate">
                        {director.name}
                      </span>
                    </div>
                    <div className="text-white/50 text-sm">Director</div>
                  </div>
                )}
              </div>

              {movieDetails.budget > 0 || movieDetails.revenue > 0 ? (
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {movieDetails.budget > 0 && (
                    <div className="bg-surface p-4 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2 text-emerald mb-1">
                        <DollarSign size={18} aria-hidden="true" />
                        <span className="font-black text-lg">
                          {formatCurrency(movieDetails.budget)}
                        </span>
                      </div>
                      <div className="text-white/50 text-sm">Budget</div>
                    </div>
                  )}
                  {movieDetails.revenue > 0 && (
                    <div className="bg-surface p-4 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-2 text-emerald mb-1">
                        <TrendingUp size={18} aria-hidden="true" />
                        <span className="font-black text-lg">
                          {formatCurrency(movieDetails.revenue)}
                        </span>
                      </div>
                      <div className="text-white/50 text-sm">Revenue</div>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="mb-12 flex flex-wrap gap-3">
                {trailer && (
                  <button
                    onClick={() => {
                      setWatchMode('trailer');
                      setTrailerOpen(true);
                    }}
                    className="flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-sm font-black tracking-[0.1em] text-white transition-all hover:border-gold/40 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gold/50 sm:px-9"
                    aria-label={`Watch trailer for ${movieDetails.title}`}
                  >
                    <Play size={18} fill="currentColor" aria-hidden="true" />
                    WATCH TRAILER
                  </button>
                )}

                <button
                  onClick={showFullMovie}
                  className="flex items-center gap-3 rounded-full bg-gradient-to-r from-gold to-ruby px-7 py-4 text-sm font-black tracking-[0.1em] text-background shadow-[0_14px_45px_rgba(232,198,106,0.22)] transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-gold/50 sm:px-9"
                  aria-label={`Watch full movie ${movieDetails.title}`}
                >
                  <Play size={18} fill="currentColor" aria-hidden="true" />
                  WATCH FULL MOVIE
                </button>
                <button
                  onClick={() => void shareMovie()}
                  className="flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-sm font-black tracking-[0.1em] text-white transition-all hover:border-gold/40 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gold/50"
                >
                  <Share2 size={18} aria-hidden="true" />
                  SHARE
                </button>
              </div>
            </motion.div>

            {movieDetails.production_companies?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <h2 className="text-2xl font-black mb-4">Production</h2>
                <div className="flex flex-wrap gap-4">
                  {movieDetails.production_companies.map((company) => (
                    <div
                      key={company.id}
                      className="bg-surface px-5 py-3 rounded-xl border border-white/10 text-sm font-semibold"
                    >
                      {company.name}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <div ref={mediaSectionRef} className="scroll-mt-24">
              {watchMode === 'movie' ? (
                <VideoPlayer
                  embed={true}
                  src={getMovieEmbedSources(movieDetails.id)[0].url}
                  sources={getMovieEmbedSources(movieDetails.id)}
                  poster={getImageUrl(movieDetails.poster_path, 'w500')}
                  title={movieDetails.title}
                />
              ) : videosError && !trailer ? (
                <ErrorState
                  message="Failed to load videos."
                  onRetry={() => refetchVideos()}
                />
              ) : (
                <TrailerSection
                  videos={videos?.results || []}
                  title={movieDetails.title}
                />
              )}
            </div>

            {creditsError ? (
              <ErrorState
                message="Failed to load cast."
                onRetry={() => refetchCredits()}
              />
            ) : (
              <>
                <CastCarousel cast={cast} />
                <CrewSection crew={crew} />
              </>
            )}

            {similarMovies?.results &&
              similarMovies.results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <h2 className="text-3xl font-black mb-6">Similar Movies</h2>
                  <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
                    {similarMovies.results.slice(0, 10).map((movie) => (
                      <MovieCard key={movie.id} movie={movie} />
                    ))}
                  </div>
                </motion.div>
              )}

            {recommendedMovies?.results &&
              recommendedMovies.results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <h2 className="text-3xl font-black mb-6">Recommendations</h2>
                  <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
                    {recommendedMovies.results.slice(0, 10).map((movie) => (
                      <MovieCard key={movie.id} movie={movie} />
                    ))}
                  </div>
                </motion.div>
              )}

            {movieDetails.release_date && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex items-center gap-2 text-white/50 text-sm"
              >
                <Calendar size={16} aria-hidden="true" />
                <span>
                  Release Date:{' '}
                  {new Date(movieDetails.release_date).toLocaleDateString(
                    'en-US',
                    {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    },
                  )}
                </span>
              </motion.div>
            )}

            {reviewsData?.results && (
              <ReviewsSection reviews={reviewsData.results} />
            )}
          </div>
        </div>
      </div>

      <TrailerModal
        isOpen={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        videos={videos?.results || []}
        title={movieDetails.title}
      />
    </div>
  );
};

export default MovieDetail;
