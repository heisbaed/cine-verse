import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getImageUrl, getMovieCredits, getMovieVideos } from '@/api/tmdb';
import TrailerModal from './TrailerModal';
import type { Movie } from '@/types/tmdb';

interface HeroCarouselProps {
  movies: Movie[];
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({ movies }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const movie = movies[currentIndex];
  const nextMovie = movies[(currentIndex + 1) % movies.length];

  const { data: credits } = useQuery({
    queryKey: ['homeHeroCredits', movie?.id],
    queryFn: () => getMovieCredits(movie.id),
    enabled: !!movie?.id,
  });
  const { data: videos } = useQuery({
    queryKey: ['homeHeroVideos', movie?.id],
    queryFn: () => getMovieVideos(movie.id),
    enabled: trailerOpen && !!movie?.id,
  });

  useEffect(() => {
    if (movies.length < 2 || trailerOpen) return;
    const timer = window.setInterval(
      () => setCurrentIndex((index) => (index + 1) % movies.length),
      9000,
    );
    return () => window.clearInterval(timer);
  }, [movies.length, trailerOpen]);

  if (!movie) return null;

  const cast = credits?.cast.filter((person) => person.profile_path).slice(0, 4) || [];

  return (
    <section className="media-on-dark overflow-hidden border-b border-gold/20 bg-[#070706] text-white">
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,0.9fr)_minmax(430px,1.1fr)]">
        <div className="order-2 flex min-w-0 flex-col justify-center px-5 pb-10 pt-5 sm:px-8 lg:order-1 lg:min-h-[610px] lg:px-10 lg:py-12">
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-gold">Featured premiere</p>
          <h1 className="cinema-title mt-4 max-w-[11ch] text-[clamp(3.2rem,6vw,6.6rem)] font-black leading-[0.86] tracking-[-0.03em]">
            {movie.title}
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-white/65 line-clamp-3">{movie.overview}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={`/movie/${movie.id}?play=1`} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-gold px-5 text-xs font-black uppercase tracking-[0.12em] text-black transition-colors hover:bg-white">
              <Play size={16} fill="currentColor" /> Play movie
            </Link>
            <Link to={`/movie/${movie.id}?torrents=1`} className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-gold/60 px-5 text-xs font-black uppercase tracking-[0.12em] text-gold transition-colors hover:bg-gold hover:text-black">
              <Download size={16} /> Download torrent
            </Link>
            <button onClick={() => setTrailerOpen(true)} className="min-h-12 px-3 text-xs font-bold text-white/55 transition-colors hover:text-gold">Watch trailer</button>
          </div>

          {cast.length > 0 && (
            <div className="mt-6 flex max-w-[420px] gap-2 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0">
              {cast.map((person) => (
                <Link
                  key={person.id}
                  to={`/explore?person=${person.id}&personName=${encodeURIComponent(person.name)}`}
                  className="w-24 min-w-0 shrink-0 rounded-xl border border-white/12 bg-white/5 p-1.5 text-center transition-colors hover:border-gold sm:w-auto"
                >
                  <img src={getImageUrl(person.profile_path, 'w185')} alt={person.name} className="aspect-square w-full rounded-lg object-cover object-top" />
                  <p className="mt-1.5 truncate text-[10px] font-bold">{person.name}</p>
                  <p className="truncate text-[8px] text-white/40">{person.character}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="order-1 px-4 pt-6 sm:px-8 lg:order-2 lg:flex lg:items-center lg:px-0 lg:py-10">
          <div className="reel-stage relative mx-auto h-[290px] w-full max-w-[680px] sm:h-[390px] lg:h-[520px]">
            <Link to={`/movie/${movie.id}`} className="reel-unit reel-unit-main absolute left-1/2 top-1/2 z-20 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 sm:left-[34%] sm:h-[360px] sm:w-[360px] lg:h-[440px] lg:w-[440px]" aria-label={`Open ${movie.title}`}>
              <span className="reel-face block h-full w-full overflow-hidden rounded-full border-2 border-gold/70">
                <img src={getImageUrl(movie.backdrop_path, 'original')} alt="" className="h-full w-full object-cover" />
                <i className="absolute left-1/2 top-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/50 bg-black" />
              </span>
            </Link>
            <Link to={`/movie/${movie.id}`} className="reel-unit reel-unit-two absolute left-[57%] top-1/2 z-10 hidden h-[300px] w-[300px] -translate-y-1/2 sm:block lg:h-[370px] lg:w-[370px]" aria-label={`Open ${movie.title}`}>
              <span className="reel-face block h-full w-full overflow-hidden rounded-full border border-white/25">
                <img src={getImageUrl(movie.poster_path, 'w780')} alt="" className="h-full w-full object-cover object-top" />
                <i className="absolute left-1/2 top-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black" />
              </span>
            </Link>
            {nextMovie && (
              <Link to={`/movie/${nextMovie.id}`} className="reel-unit reel-unit-three absolute -right-[16%] top-1/2 z-0 hidden h-[260px] w-[260px] -translate-y-1/2 lg:block" aria-label={`Open ${nextMovie.title}`}>
                <span className="reel-face block h-full w-full overflow-hidden rounded-full border border-ruby/60">
                  <img src={getImageUrl(nextMovie.backdrop_path, 'w780')} alt="" className="h-full w-full object-cover" />
                  <i className="absolute left-1/2 top-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ruby/40 bg-black" />
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1500px] justify-center gap-1.5 px-5 pb-5 lg:justify-end lg:px-10">
        {movies.map((item, index) => (
          <button key={item.id} onClick={() => setCurrentIndex(index)} className={`h-1.5 rounded-full transition-all ${index === currentIndex ? 'w-8 bg-gold' : 'w-2 bg-white/20'}`} aria-label={`Show ${item.title}`} />
        ))}
      </div>

      <TrailerModal isOpen={trailerOpen} onClose={() => setTrailerOpen(false)} videos={videos?.results || []} title={movie.title} />
    </section>
  );
};

export default HeroCarousel;
