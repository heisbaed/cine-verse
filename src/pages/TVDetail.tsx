import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Globe,
  Layers3,
  Play,
  Star,
  Share2,
  Tv,
  User,
} from 'lucide-react';
import {
  getImageUrl,
  getRecommendedTVShows,
  getSimilarTVShows,
  getTVCredits,
  getTVDetails,
  getTVReviews,
  getTVSeasonDetails,
  getTVVideos,
} from '@/api/tmdb';
import MovieCard from '@/components/movie/MovieCard';
import CastCarousel from '@/components/sections/CastCarousel';
import CrewSection from '@/components/sections/CrewSection';
import ReviewsSection from '@/components/sections/ReviewsSection';
import TrailerModal from '@/components/sections/TrailerModal';
import TrailerSection from '@/components/sections/TrailerSection';
import VideoPlayer from '@/components/sections/VideoPlayer';
import ErrorState from '@/components/ui/ErrorState';
import { useSEO } from '@/hooks/useSEO';
import { useViewHistoryStore } from '@/store/viewHistoryStore';
import { getTVEmbedSources } from '@/utils/embedSources';

const TVDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const tvId = Number.parseInt(id || '0');
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [watchMode, setWatchMode] = useState<'trailer' | 'series'>('trailer');
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const mediaSectionRef = useRef<HTMLDivElement>(null);
  const addRecentlyViewed = useViewHistoryStore(
    (state) => state.addRecentlyViewed,
  );

  const {
    data: details,
    isLoading,
    error: detailsError,
    refetch: refetchDetails,
  } = useQuery({
    queryKey: ['tvDetails', tvId],
    queryFn: () => getTVDetails(tvId),
    enabled: !!tvId,
  });

  const {
    data: credits,
    error: creditsError,
    refetch: refetchCredits,
  } = useQuery({
    queryKey: ['tvCredits', tvId],
    queryFn: () => getTVCredits(tvId),
    enabled: !!tvId,
  });

  const {
    data: videos,
    error: videosError,
    refetch: refetchVideos,
  } = useQuery({
    queryKey: ['tvVideos', tvId],
    queryFn: () => getTVVideos(tvId),
    enabled: !!tvId,
  });

  const { data: similarShows } = useQuery({
    queryKey: ['similarTVShows', tvId],
    queryFn: () => getSimilarTVShows(tvId),
    enabled: !!tvId,
  });

  const { data: recommendations } = useQuery({
    queryKey: ['recommendedTVShows', tvId],
    queryFn: () => getRecommendedTVShows(tvId),
    enabled: !!tvId,
  });

  const { data: reviews } = useQuery({
    queryKey: ['tvReviews', tvId],
    queryFn: () => getTVReviews(tvId),
    enabled: !!tvId,
  });

  const { data: seasonDetails, isLoading: seasonLoading } = useQuery({
    queryKey: ['tvSeasonDetails', tvId, selectedSeason],
    queryFn: () => getTVSeasonDetails(tvId, selectedSeason),
    enabled: !!tvId && selectedSeason >= 0,
  });

  useEffect(() => {
    if (!details) return;
    const firstSeason =
      details.seasons.find(
        (season) => season.season_number > 0 && season.episode_count > 0,
      ) || details.seasons.find((season) => season.episode_count > 0);
    setSelectedSeason(firstSeason?.season_number || 1);
    setSelectedEpisode(1);
    addRecentlyViewed(details);
  }, [details, addRecentlyViewed]);

  useSEO({
    title: details?.name || 'TV Series Details',
    description: details?.overview?.slice(0, 160) || '',
  });

  if (!tvId) {
    return (
      <ErrorState
        message="Invalid TV series ID."
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-2xl font-bold text-gold animate-pulse">
          Loading series...
        </div>
      </div>
    );
  }

  if (detailsError || !details) {
    return (
      <div className="min-h-screen px-6 py-20">
        <ErrorState
          message="Failed to load TV series details."
          onRetry={() => refetchDetails()}
        />
      </div>
    );
  }

  const trailer =
    videos?.results.find(
      (video) =>
        video.site === 'YouTube' &&
        video.type === 'Trailer' &&
        video.official,
    ) ||
    videos?.results.find(
      (video) => video.site === 'YouTube' && video.type === 'Trailer',
    ) ||
    videos?.results.find((video) => video.site === 'YouTube');
  const creator = details.created_by[0];
  const runtime = details.episode_run_time[0];
  const cast = credits?.cast || [];
  const crew = credits?.crew || [];
  const regularSeasons = details.seasons.filter(
    (season) => season.season_number > 0 && season.episode_count > 0,
  );
  const playableSeasons =
    regularSeasons.length > 0
      ? regularSeasons
      : details.seasons.filter((season) => season.episode_count > 0);
  const activeSeason = playableSeasons.find(
    (season) => season.season_number === selectedSeason,
  );
  const episodeCount =
    seasonDetails?.episodes.length || activeSeason?.episode_count || 1;
  const activeEpisode = seasonDetails?.episodes.find(
    (episode) => episode.episode_number === selectedEpisode,
  );

  const showSeries = () => {
    setWatchMode('series');
    window.requestAnimationFrame(() => {
      mediaSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const shareSeries = async () => {
    const shareData = {
      title: details.name,
      text: `Discover ${details.name} on Cine-verse.`,
      url: window.location.href,
    };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  const selectSeason = (seasonNumber: number) => {
    setSelectedSeason(seasonNumber);
    setSelectedEpisode(1);
    setWatchMode('series');
    window.requestAnimationFrame(() => {
      mediaSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const selectEpisode = (episodeNumber: number) => {
    setSelectedEpisode(episodeNumber);
    setWatchMode('series');
    window.requestAnimationFrame(() => {
      mediaSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  return (
    <div className="min-h-screen">
      <div className="relative h-[58vh] min-h-[430px]">
        <img
          src={getImageUrl(details.backdrop_path, 'original')}
          alt=""
          className="h-full w-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
      </div>

      <div className="relative -mt-48 px-6 pb-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="sticky top-24"
            >
              <img
                src={getImageUrl(details.poster_path, 'w500')}
                alt={`${details.name} poster`}
                className="w-full rounded-3xl border border-white/10 shadow-2xl"
              />
            </motion.div>
          </div>

          <div className="space-y-9 lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1 text-sm font-bold text-gold">
                  <Tv size={14} aria-hidden="true" />
                  TV SERIES
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold ${
                    details.in_production
                      ? 'bg-emerald/15 text-emerald'
                      : 'bg-white/10 text-white/70'
                  }`}
                >
                  {details.status}
                </span>
                {details.genres.slice(0, 4).map((genre) => (
                  <span
                    key={genre.id}
                    className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/70"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>

              <h1 className="cinema-title text-5xl font-black leading-tight sm:text-7xl">
                {details.name}
              </h1>
              {details.tagline && (
                <p className="mt-4 text-xl italic text-gold/75 sm:text-2xl">
                  &ldquo;{details.tagline}&rdquo;
                </p>
              )}
              <p className="mt-6 text-lg leading-relaxed text-white/70">
                {details.overview}
              </p>

              <div className="my-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-surface p-4">
                  <div className="mb-1 flex items-center gap-2 text-gold">
                    <Star size={18} fill="currentColor" aria-hidden="true" />
                    <span className="text-xl font-black">
                      {details.vote_average.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-sm text-white/45">Viewer rating</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-surface p-4">
                  <div className="mb-1 flex items-center gap-2 text-gold">
                    <Layers3 size={18} aria-hidden="true" />
                    <span className="text-xl font-black">
                      {details.number_of_seasons}
                    </span>
                  </div>
                  <div className="text-sm text-white/45">Seasons</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-surface p-4">
                  <div className="mb-1 flex items-center gap-2 text-gold">
                    <Play size={18} aria-hidden="true" />
                    <span className="text-xl font-black">
                      {details.number_of_episodes}
                    </span>
                  </div>
                  <div className="text-sm text-white/45">Episodes</div>
                </div>
                {runtime ? (
                  <div className="rounded-2xl border border-white/10 bg-surface p-4">
                    <div className="mb-1 flex items-center gap-2 text-gold">
                      <Clock size={18} aria-hidden="true" />
                      <span className="text-xl font-black">{runtime}m</span>
                    </div>
                    <div className="text-sm text-white/45">Per episode</div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-surface p-4">
                    <div className="mb-1 flex items-center gap-2 text-gold">
                      <Globe size={18} aria-hidden="true" />
                      <span className="text-xl font-black">
                        {details.original_language.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm text-white/45">Language</div>
                  </div>
                )}
              </div>

              {creator && (
                <div className="mb-8 flex items-center gap-3 text-white/55">
                  <User size={17} className="text-gold" aria-hidden="true" />
                  Created by <span className="font-bold text-white">{creator.name}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {trailer && (
                  <button
                    onClick={() => {
                      setWatchMode('trailer');
                      setTrailerOpen(true);
                    }}
                    className="flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-sm font-black tracking-[0.1em] transition-all hover:border-gold/40 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gold/50 sm:px-9"
                  >
                    <Play size={18} fill="currentColor" aria-hidden="true" />
                    WATCH TRAILER
                  </button>
                )}
                <button
                  onClick={showSeries}
                  className="flex items-center gap-3 rounded-full bg-gradient-to-r from-gold to-ruby px-7 py-4 text-sm font-black tracking-[0.1em] text-background shadow-[0_14px_45px_rgba(232,198,106,0.22)] transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-gold/50 sm:px-9"
                >
                  <Play size={18} fill="currentColor" aria-hidden="true" />
                  WATCH SERIES
                </button>
                <button
                  onClick={() => void shareSeries()}
                  className="flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-sm font-black tracking-[0.1em] transition-all hover:border-gold/40 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-gold/50"
                >
                  <Share2 size={18} aria-hidden="true" />
                  SHARE
                </button>
              </div>
            </motion.div>

            {details.networks.length > 0 && (
              <div>
                <h2 className="mb-4 text-xl font-black">Networks</h2>
                <div className="flex flex-wrap gap-3">
                  {details.networks.map((network) => (
                    <div
                      key={network.id}
                      className="rounded-xl border border-white/10 bg-surface px-4 py-2 text-sm font-semibold"
                    >
                      {network.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div ref={mediaSectionRef} className="scroll-mt-24">
              {watchMode === 'series' ? (
                <div>
                  <div className="mb-5 rounded-2xl border border-white/10 bg-surface p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                      <label className="flex-1 text-xs font-black uppercase tracking-[0.2em] text-white/45">
                        Season
                        <select
                          value={selectedSeason}
                          onChange={(event) => {
                            setSelectedSeason(Number(event.target.value));
                            setSelectedEpisode(1);
                          }}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-base font-bold text-white outline-none focus:border-gold/60"
                        >
                          {playableSeasons.map((season) => (
                            <option
                              key={season.id}
                              value={season.season_number}
                            >
                              {season.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex-1 text-xs font-black uppercase tracking-[0.2em] text-white/45">
                        Episode
                        <select
                          value={selectedEpisode}
                          onChange={(event) =>
                            setSelectedEpisode(Number(event.target.value))
                          }
                          className="mt-2 w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-base font-bold text-white outline-none focus:border-gold/60"
                        >
                          {seasonDetails?.episodes.length
                            ? seasonDetails.episodes.map((episode) => (
                                <option
                                  key={episode.id}
                                  value={episode.episode_number}
                                >
                                  E{episode.episode_number}: {episode.name}
                                </option>
                              ))
                            : Array.from(
                                { length: episodeCount },
                                (_, index) => (
                                  <option key={index + 1} value={index + 1}>
                                    Episode {index + 1}
                                  </option>
                                ),
                              )}
                        </select>
                      </label>
                    </div>
                  </div>

                  {seasonLoading ? (
                    <div className="mb-5 animate-pulse rounded-2xl border border-white/10 bg-surface p-5">
                      <div className="h-5 w-1/3 rounded bg-white/10" />
                      <div className="mt-3 h-4 w-full rounded bg-white/5" />
                      <div className="mt-2 h-4 w-2/3 rounded bg-white/5" />
                    </div>
                  ) : activeEpisode ? (
                    <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-surface sm:grid sm:grid-cols-[14rem_1fr]">
                      {activeEpisode.still_path ? (
                        <img
                          src={getImageUrl(activeEpisode.still_path, 'w500')}
                          alt=""
                          className="aspect-video h-full w-full object-cover"
                        />
                      ) : (
                        <div className="media-on-dark grid aspect-video place-items-center bg-black text-gold">
                          <Play size={32} aria-hidden="true" />
                        </div>
                      )}
                      <div className="p-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gold/70">
                          Season {selectedSeason} · Episode {activeEpisode.episode_number}
                        </p>
                        <h3 className="mt-2 text-2xl font-black">
                          {activeEpisode.name}
                        </h3>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/45">
                          {activeEpisode.air_date && (
                            <span className="flex items-center gap-1.5">
                              <Calendar size={13} aria-hidden="true" />
                              {new Date(activeEpisode.air_date).toLocaleDateString()}
                            </span>
                          )}
                          {activeEpisode.runtime && (
                            <span className="flex items-center gap-1.5">
                              <Clock size={13} aria-hidden="true" />
                              {activeEpisode.runtime} min
                            </span>
                          )}
                          {activeEpisode.vote_average > 0 && (
                            <span className="flex items-center gap-1.5 text-gold">
                              <Star size={13} fill="currentColor" aria-hidden="true" />
                              {activeEpisode.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                        {activeEpisode.overview && (
                          <p className="mt-3 text-sm leading-relaxed text-white/55 line-clamp-3">
                            {activeEpisode.overview}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <VideoPlayer
                    key={`${selectedSeason}-${selectedEpisode}`}
                    embed={true}
                    src={
                      getTVEmbedSources(
                        details.id,
                        selectedSeason,
                        selectedEpisode,
                      )[0].url
                    }
                    sources={getTVEmbedSources(
                      details.id,
                      selectedSeason,
                      selectedEpisode,
                    )}
                    poster={getImageUrl(details.poster_path, 'w500')}
                    title={`${details.name} - S${selectedSeason} E${selectedEpisode}${activeEpisode ? `: ${activeEpisode.name}` : ''}`}
                  />

                  {!!seasonDetails?.episodes.length && (
                    <section className="mt-8">
                      <div className="mb-5 flex items-end justify-between gap-4">
                        <div>
                          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.26em] text-gold/65">
                            Season {selectedSeason}
                          </p>
                          <h3 className="text-2xl font-black">Episode Guide</h3>
                        </div>
                        <span className="text-sm text-white/35">
                          {seasonDetails.episodes.length} episodes
                        </span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {seasonDetails.episodes.map((episode) => (
                          <button
                            key={episode.id}
                            onClick={() => selectEpisode(episode.episode_number)}
                            className={`overflow-hidden rounded-2xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-gold/50 ${
                              episode.episode_number === selectedEpisode
                                ? 'border-gold/60 bg-gold/10'
                                : 'border-white/10 bg-surface hover:border-gold/30'
                            }`}
                          >
                            <div className="relative aspect-video overflow-hidden bg-background">
                              {episode.still_path ? (
                                <img
                                  src={getImageUrl(episode.still_path, 'w500')}
                                  alt=""
                                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="media-on-dark grid h-full place-items-center bg-black text-gold">
                                  <Play size={27} aria-hidden="true" />
                                </div>
                              )}
                              <span className="absolute left-3 top-3 rounded-full bg-background/75 px-2.5 py-1 text-[10px] font-black text-gold backdrop-blur-md">
                                E{episode.episode_number}
                              </span>
                              {episode.runtime && (
                                <span className="media-on-dark absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                                  {episode.runtime}m
                                </span>
                              )}
                            </div>
                            <div className="p-4">
                              <h4 className="line-clamp-1 font-bold">
                                {episode.name}
                              </h4>
                              {episode.overview && (
                                <p className="mt-2 text-xs leading-relaxed text-white/45 line-clamp-2">
                                  {episode.overview}
                                </p>
                              )}
                              {episode.air_date && (
                                <p className="mt-3 text-[11px] text-white/30">
                                  {new Date(episode.air_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              ) : videosError && !trailer ? (
                <ErrorState
                  message="Failed to load series videos."
                  onRetry={() => refetchVideos()}
                />
              ) : (
                <TrailerSection
                  videos={videos?.results || []}
                  title={details.name}
                />
              )}
            </div>

            {playableSeasons.length > 0 && (
              <section>
                <div className="mb-5 flex items-end justify-between">
                  <div>
                    <p className="mb-1 text-[10px] font-black uppercase tracking-[0.28em] text-gold/65">
                      Episode guide
                    </p>
                    <h2 className="text-3xl font-black">Seasons</h2>
                  </div>
                  <span className="text-sm text-white/35">
                    {details.number_of_episodes} episodes
                  </span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                  {playableSeasons.map((season) => (
                    <button
                      key={season.id}
                      onClick={() => selectSeason(season.season_number)}
                      className={`w-40 flex-shrink-0 overflow-hidden rounded-2xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-gold/50 ${
                        selectedSeason === season.season_number
                          ? 'border-gold/70 bg-gold/10'
                          : 'border-white/10 bg-surface hover:border-gold/35'
                      }`}
                    >
                      <img
                        src={getImageUrl(season.poster_path, 'w300')}
                        alt=""
                        className="aspect-[2/3] w-full object-cover"
                        loading="lazy"
                      />
                      <div className="p-3">
                        <div className="line-clamp-2 font-bold">{season.name}</div>
                        <div className="mt-1 text-xs text-white/45">
                          {season.episode_count} episodes
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {creditsError ? (
              <ErrorState
                message="Failed to load series cast."
                onRetry={() => refetchCredits()}
              />
            ) : (
              <>
                <CastCarousel cast={cast} />
                <CrewSection crew={crew} />
              </>
            )}

            {similarShows?.results && similarShows.results.length > 0 && (
              <section>
                <h2 className="mb-6 text-3xl font-black">Similar Series</h2>
                <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
                  {similarShows.results.slice(0, 10).map((show) => (
                    <MovieCard key={show.id} movie={show} />
                  ))}
                </div>
              </section>
            )}

            {recommendations?.results &&
              recommendations.results.length > 0 && (
                <section>
                  <h2 className="mb-6 text-3xl font-black">
                    More Series For You
                  </h2>
                  <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide">
                    {recommendations.results.slice(0, 10).map((show) => (
                      <MovieCard key={show.id} movie={show} />
                    ))}
                  </div>
                </section>
              )}

            {details.first_air_date && (
              <div className="flex items-center gap-2 text-sm text-white/45">
                <Calendar size={16} aria-hidden="true" />
                First aired:{' '}
                {new Date(details.first_air_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            )}

            {reviews?.results && <ReviewsSection reviews={reviews.results} />}
          </div>
        </div>
      </div>

      <TrailerModal
        isOpen={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        videos={videos?.results || []}
        title={details.name}
      />
    </div>
  );
};

export default TVDetail;
