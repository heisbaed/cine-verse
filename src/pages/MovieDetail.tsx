import DownloadModal from '@/components/sections/DownloadModal';
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ExternalLink, Play, Share2, Star, User } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  getImageUrl,
  getMovieCredits,
  getMovieDetails,
  getMovieReviews,
  getMovieVideos,
  getRecommendedMovies,
  getSimilarMovies,
} from '@/api/tmdb';
import MovieRow from '@/components/sections/MovieRow';
import TrailerModal from '@/components/sections/TrailerModal';
import VideoPlayer from '@/components/sections/VideoPlayer';
import ErrorState from '@/components/ui/ErrorState';
import { usePlaybackSources } from '@/hooks/usePlaybackSources';
import { useSEO } from '@/hooks/useSEO';
import { trackEvent } from '@/lib/siteTracking';
import { useViewHistoryStore } from '@/store/viewHistoryStore';

const MovieDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const movieId = Number(id);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showPlayer, setShowPlayer] = useState(searchParams.get('play') === '1');
  const addRecentlyViewed = useViewHistoryStore((state) => state.addRecentlyViewed);

  const details = useQuery({ queryKey: ['movieDetails', movieId], queryFn: () => getMovieDetails(movieId), enabled: movieId > 0 });
  const credits = useQuery({ queryKey: ['movieCredits', movieId], queryFn: () => getMovieCredits(movieId), enabled: movieId > 0 });
  const videos = useQuery({ queryKey: ['movieVideos', movieId], queryFn: () => getMovieVideos(movieId), enabled: movieId > 0 });
  const similar = useQuery({ queryKey: ['similarMovies', movieId], queryFn: () => getSimilarMovies(movieId), enabled: movieId > 0 });
  const recommended = useQuery({ queryKey: ['recommendedMovies', movieId], queryFn: () => getRecommendedMovies(movieId), enabled: movieId > 0 });
  const reviews = useQuery({ queryKey: ['movieReviews', movieId], queryFn: () => getMovieReviews(movieId), enabled: movieId > 0 });
  const movie = details.data;
  const playbackRequest = movieId > 0 ? { kind: 'movie' as const, tmdbId: movieId } : null;
  const sourcesQuery = usePlaybackSources(showPlayer || showDownload ? playbackRequest : null);

  useSEO({ title: movie?.title || 'Movie Details', description: movie?.overview?.slice(0, 160) || '', image: movie?.poster_path ? getImageUrl(movie.poster_path, 'w500') : undefined });

  useEffect(() => {
    if (movie) addRecentlyViewed(movie);
  }, [movie, addRecentlyViewed]);

  useEffect(() => {
    setShowPlayer(searchParams.get('play') === '1');
    setShowDownload(false);
    setTrailerOpen(false);
  }, [movieId, searchParams]);

  if (!movieId) return <ErrorState message="Invalid movie ID." onRetry={() => window.location.reload()} />;
  if (details.isLoading) return <div className="grid min-h-[65vh] place-items-center text-sm font-bold text-gold">Loading film...</div>;
  if (!movie) return <div className="px-5 py-20"><ErrorState message="Failed to load movie details." onRetry={() => details.refetch()} /></div>;

  const director = credits.data?.crew.find((person) => person.job === 'Director');
  const cast = credits.data?.cast.filter((person) => person.profile_path).slice(0, 12) || [];
  const trailer = videos.data?.results.find((video) => video.site === 'YouTube' && video.type === 'Trailer' && video.official) || videos.data?.results[0];
  const releaseYear = movie.release_date?.split('-')[0];

  const playMovie = () => {
    trackEvent('cta_click', { label: 'play' });
    setShowPlayer(true);
  };

  const openTrailer = () => {
    trackEvent('cta_click', { label: 'trailer-open' });
    setTrailerOpen(true);
  };

  const shareMovie = async () => {
    trackEvent('cta_click', { label: 'share' });
    const data = { title: movie.title, text: `Watch ${movie.title} on Cine-verse.`, url: window.location.href };
    if (navigator.share) await navigator.share(data);
    else await navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="min-h-screen pb-24">
      <section className="media-on-dark relative isolate overflow-hidden bg-black text-white">
        <img src={getImageUrl(movie.backdrop_path || movie.poster_path, 'w1280')} alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-top opacity-55" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/80 to-black/10" />
        <div className="mx-auto grid max-w-[1280px] items-end gap-6 px-5 pb-8 pt-28 sm:grid-cols-[9rem_minmax(0,1fr)] sm:px-8 sm:pt-40 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-9">
          {movie.poster_path && <img src={getImageUrl(movie.poster_path, 'w500')} alt=""
            className="hidden aspect-[2/3] w-full rounded-2xl border border-white/15 object-cover shadow-2xl sm:block" />}
          <div className="min-w-0 sm:col-start-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-white/75">
              {releaseYear && <span>{releaseYear}</span>}
              {movie.runtime > 0 && <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>}
              {movie.vote_average > 0 && <span className="inline-flex items-center gap-1 text-gold"><Star size={13} fill="currentColor" /> {movie.vote_average.toFixed(1)}</span>}
              {movie.genres.slice(0, 2).map((genre) => <Link key={genre.id} to={`/explore?genre=${genre.id}`}
                className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs hover:border-gold/50">{genre.name}</Link>)}
            </div>
            <h1 className="mt-3 max-w-4xl text-balance text-4xl font-black leading-none tracking-tight sm:text-5xl lg:text-7xl">{movie.title}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={playMovie} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-5 text-sm font-bold text-black hover:bg-white">
                <Play size={17} fill="currentColor" /> Play movie
              </button>
              <button type="button" onClick={() => setShowDownload(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 text-sm font-semibold text-white hover:border-gold/50">
                <Download size={17} /> Download
              </button>
              {trailer && <button onClick={openTrailer} className="min-h-11 rounded-full px-3 text-sm font-semibold text-white/75 hover:text-white">Trailer</button>}
              <button onClick={() => void shareMovie()} className="grid h-11 w-11 place-items-center rounded-full text-white/75 hover:bg-white/10 hover:text-white" aria-label="Share movie"><Share2 size={18} /></button>
            </div>
            {movie.overview && <p className="mt-5 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">{movie.overview}</p>}
            {director && <p className="mt-3 text-sm text-white/55">Directed by {director.name}</p>}
          </div>
        </div>
      </section>

      <DownloadModal isOpen={showDownload} onClose={() => setShowDownload(false)} request={playbackRequest} title={movie.title} sources={sourcesQuery.data || []} loading={sourcesQuery.isFetching} error={sourcesQuery.error?.message} onRetry={() => void sourcesQuery.refetch()} />
      {showPlayer && (
        <VideoPlayer
          mediaKey={`movie-${movieId}`}
          imdbId={movie.imdb_id}
          sources={sourcesQuery.data ?? []}
          loading={sourcesQuery.isFetching}
          error={sourcesQuery.isError ? sourcesQuery.error.message : null}
          onRetry={() => sourcesQuery.refetch()}
          poster={getImageUrl(movie.backdrop_path, 'w1280')}
          title={movie.title}
          subtitle={releaseYear ? `${releaseYear} · Movie` : 'Movie'}
          kind="movie"
          onClose={() => setShowPlayer(false)}
        />
      )}

      {cast.length > 0 && (
        <section className="mx-auto max-w-[1500px] px-5 py-10 sm:px-8 lg:px-10">
          <h2 className="text-xl font-black">Cast</h2>
          <div className="mt-5 flex snap-x gap-3 overflow-x-auto pb-3 scrollbar-hide">
            {cast.map((person) => (
              <Link key={person.id} to={`/explore?person=${person.id}&personName=${encodeURIComponent(person.name)}`} className="w-28 shrink-0 snap-start sm:w-32">
                <img src={getImageUrl(person.profile_path, 'w185')} alt={person.name} className="aspect-[4/5] w-full rounded-xl object-cover object-top" />
                <h3 className="mt-2 truncate text-sm font-bold">{person.name}</h3>
                <p className="mt-0.5 truncate text-[10px] text-white/40">{person.character}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {reviews.data?.results.length ? (
        <section className="mx-auto max-w-[1500px] px-5 pb-10 sm:px-8 lg:px-10">
          <h2 className="text-xl font-black">Reviews</h2>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {reviews.data.results.slice(0, 3).map((review) => (
              <article key={review.id} className="rounded-xl border border-white/10 bg-surface p-5">
                <div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-background text-white/30"><User size={16} /></span><h3 className="min-w-0 flex-1 truncate text-sm font-bold">{review.author}</h3>{review.author_details.rating && <span className="text-xs font-bold text-gold">{review.author_details.rating}/10</span>}</div>
                <p className="mt-4 text-sm leading-6 text-white/55 line-clamp-3">{review.content}</p>
                <a href={review.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-gold">Read review <ExternalLink size={12} /></a>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {similar.data?.results.length ? <div className="mb-10"><MovieRow title="Similar movies" movies={similar.data.results.slice(0, 12)} /></div> : null}
      {recommended.data?.results.length ? <MovieRow title="More like this" movies={recommended.data.results.slice(0, 12)} /> : null}

      <TrailerModal isOpen={trailerOpen} onClose={() => setTrailerOpen(false)} videos={videos.data?.results || []} title={movie.title} />
    </div>
  );
};

export default MovieDetail;
