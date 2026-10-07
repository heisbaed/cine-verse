import React, { useEffect, useRef, useState } from 'react';
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
import TorrentModal from '@/components/sections/TorrentModal';
import TrailerModal from '@/components/sections/TrailerModal';
import VideoPlayer from '@/components/sections/VideoPlayer';
import ErrorState from '@/components/ui/ErrorState';
import { useSEO } from '@/hooks/useSEO';
import { trackEvent } from '@/lib/siteTracking';
import { useViewHistoryStore } from '@/store/viewHistoryStore';
import { getMovieEmbedSources } from '@/utils/embedSources';

const MovieDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const movieId = Number(id);
  const mediaRef = useRef<HTMLElement>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [torrentOpen, setTorrentOpen] = useState(
    searchParams.get('torrents') === '1',
  );
  const [showPlayer, setShowPlayer] = useState(searchParams.get('play') === '1');
  const addRecentlyViewed = useViewHistoryStore((state) => state.addRecentlyViewed);

  const details = useQuery({ queryKey: ['movieDetails', movieId], queryFn: () => getMovieDetails(movieId), enabled: movieId > 0 });
  const credits = useQuery({ queryKey: ['movieCredits', movieId], queryFn: () => getMovieCredits(movieId), enabled: movieId > 0 });
  const videos = useQuery({ queryKey: ['movieVideos', movieId], queryFn: () => getMovieVideos(movieId), enabled: movieId > 0 });
  const similar = useQuery({ queryKey: ['similarMovies', movieId], queryFn: () => getSimilarMovies(movieId), enabled: movieId > 0 });
  const recommended = useQuery({ queryKey: ['recommendedMovies', movieId], queryFn: () => getRecommendedMovies(movieId), enabled: movieId > 0 });
  const reviews = useQuery({ queryKey: ['movieReviews', movieId], queryFn: () => getMovieReviews(movieId), enabled: movieId > 0 });
  const movie = details.data;

  useSEO({ title: movie?.title || 'Movie Details', description: movie?.overview?.slice(0, 160) || '', image: movie?.poster_path ? getImageUrl(movie.poster_path, 'w500') : undefined });

  useEffect(() => {
    if (movie) addRecentlyViewed(movie);
  }, [movie, addRecentlyViewed]);

  useEffect(() => {
    if (!movie || searchParams.get('play') !== '1') return;
    setShowPlayer(true);
    window.requestAnimationFrame(() => mediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [movie, searchParams]);

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
    window.requestAnimationFrame(() => mediaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const openTorrents = () => {
    trackEvent('cta_click', { label: 'torrent-open' });
    setTorrentOpen(true);
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
      <div className="media-on-dark bg-black text-white">
        <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8 lg:px-10 lg:py-10">
          <img src={getImageUrl(movie.backdrop_path, 'original')} alt={`${movie.title} backdrop`} className="aspect-[16/8] w-full rounded-xl object-cover object-center sm:aspect-[16/7] lg:aspect-[16/6]" />

          <div className="grid gap-7 py-8 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-10">
            <img src={getImageUrl(movie.poster_path, 'w500')} alt={`${movie.title} poster`} className="mx-auto aspect-[2/3] w-full max-w-[160px] rounded-xl object-cover sm:max-w-[200px] md:max-w-none" />

            <div className="min-w-0 self-center">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">
                {releaseYear && <span>{releaseYear}</span>}
                {movie.runtime > 0 && <span>{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>}
                <span className="inline-flex items-center gap-1 text-gold"><Star size={11} fill="currentColor" /> {movie.vote_average.toFixed(1)}</span>
                {movie.genres.slice(0, 3).map((genre) => <span key={genre.id}>{genre.name}</span>)}
              </div>
              <h1 className="cinema-title mt-4 text-[clamp(2.6rem,7vw,7.4rem)] font-black leading-[0.88] tracking-[-0.03em]">{movie.title}</h1>
              {movie.tagline && <p className="mt-4 text-base font-semibold text-gold/80">{movie.tagline}</p>}

              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={playMovie} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-gold px-6 text-xs font-black uppercase tracking-[0.12em] text-black hover:bg-white"><Play size={17} fill="currentColor" /> Play movie</button>
                <button onClick={() => openTorrents()} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-gold/60 px-6 text-xs font-black uppercase tracking-[0.12em] text-gold hover:bg-gold hover:text-black"><Download size={17} /> Download torrent</button>
                {trailer && <button onClick={() => openTrailer()} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-white/20 px-5 text-xs font-bold text-white/70 hover:border-white hover:text-white"><Play size={15} /> Trailer</button>}
                <button onClick={() => void shareMovie()} className="grid h-12 w-12 place-items-center rounded-lg border border-white/20 text-white/60 hover:text-white" aria-label="Share movie"><Share2 size={17} /></button>
              </div>

              <p className="mt-6 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">{movie.overview}</p>

              <dl className="mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="border-l border-gold/45 pl-3"><dt className="text-[9px] uppercase tracking-wider text-white/35">Status</dt><dd className="mt-1 text-sm font-bold">{movie.status}</dd></div>
                <div className="border-l border-gold/45 pl-3"><dt className="text-[9px] uppercase tracking-wider text-white/35">Language</dt><dd className="mt-1 text-sm font-bold">{movie.original_language.toUpperCase()}</dd></div>
                <div className="border-l border-gold/45 pl-3"><dt className="text-[9px] uppercase tracking-wider text-white/35">Director</dt><dd className="mt-1 truncate text-sm font-bold">{director?.name || 'Not listed'}</dd></div>
                <div className="border-l border-gold/45 pl-3"><dt className="text-[9px] uppercase tracking-wider text-white/35">Release</dt><dd className="mt-1 text-sm font-bold">{movie.release_date || 'TBA'}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <section ref={mediaRef} className="scroll-mt-20 border-b border-white/10 py-10">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-10">
          <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl font-black">{showPlayer ? 'Now playing' : 'Watch the movie'}</h2>{!showPlayer && <button onClick={playMovie} className="text-xs font-bold text-gold">Start player</button>}</div>
          {showPlayer ? (
            <VideoPlayer embed src={getMovieEmbedSources(movie.id)[0].url} sources={getMovieEmbedSources(movie.id)} poster={getImageUrl(movie.backdrop_path, 'w1280')} title={movie.title} />
          ) : (
            <button onClick={playMovie} className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-black text-white">
              <img src={getImageUrl(movie.backdrop_path, 'w1280')} alt="" className="h-full w-full object-cover opacity-55 transition-transform duration-500 group-hover:scale-[1.02]" />
              <span className="absolute inset-0 grid place-items-center"><span className="inline-flex items-center gap-3 rounded-lg bg-gold px-6 py-4 text-sm font-black uppercase tracking-wider text-black"><Play size={19} fill="currentColor" /> Play full movie</span></span>
            </button>
          )}
        </div>
      </section>

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
      <TorrentModal
        isOpen={torrentOpen}
        onClose={() => setTorrentOpen(false)}
        movieTitle={movie.title}
        imdbId={movie.imdb_id}
        year={movie.release_date}
      />
    </div>
  );
};

export default MovieDetail;
