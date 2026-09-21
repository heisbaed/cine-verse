import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { ArrowDown, CalendarDays, Clock3, Info, Play, Star } from 'lucide-react';
import { getImageUrl, getMovieDetails, getMovieVideos } from '@/api/tmdb';
import TrailerModal from './TrailerModal';
import type { Movie } from '@/types/tmdb';

interface HeroCarouselProps {
  movies: Movie[];
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({ movies }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const backdropY = useTransform(scrollYProgress, [0, 1], [0, 110]);

  const movie = movies[currentIndex];

  const { data: details } = useQuery({
    queryKey: ['heroMovieDetails', movie?.id],
    queryFn: () => getMovieDetails(movie.id),
    enabled: !!movie?.id,
  });

  const { data: videos } = useQuery({
    queryKey: ['heroMovieVideos', movie?.id],
    queryFn: () => getMovieVideos(movie.id),
    enabled: trailerOpen && !!movie?.id,
  });

  useEffect(() => {
    if (movies.length < 2 || trailerOpen) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((current) => (current + 1) % movies.length);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [movies.length, trailerOpen]);

  if (!movie) return null;

  const releaseYear = movie.release_date?.split('-')[0];
  const genres = details?.genres.slice(0, 3) || [];

  return (
    <section
      ref={sectionRef}
      className="media-on-dark relative min-h-[calc(100svh-65px)] overflow-hidden text-white"
      aria-label="Featured movie"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={movie.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{ y: backdropY }}
          className="absolute -inset-y-16 inset-x-0"
        >
          <img
            src={getImageUrl(movie.backdrop_path, 'original')}
            alt=""
            className="h-full w-full object-cover object-center"
            aria-hidden="true"
          />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 bg-background/35" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-background/35" />
      <div className="hero-vignette absolute inset-0" />
      <div className="cinematic-particles absolute inset-0 opacity-45" />
      <div className="cinematic-orb cinematic-orb-gold absolute -left-32 top-1/4 h-80 w-80 rounded-full" />
      <div className="cinematic-orb cinematic-orb-ruby absolute -right-32 bottom-0 h-96 w-96 rounded-full" />

      <div className="relative mx-auto flex min-h-[calc(100svh-65px)] max-w-7xl items-end px-6 pb-28 pt-24 sm:items-center sm:py-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={`copy-${movie.id}`}
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-3xl"
          >
            <div className="mb-5 flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <span className="text-[10px] font-black uppercase tracking-[0.35em] text-gold sm:text-xs">
                Welcome to Cine-verse · Featured tonight
              </span>
            </div>

            <h1 className="cinema-title text-5xl font-black leading-[0.92] tracking-[-0.045em] sm:text-7xl lg:text-8xl">
              {movie.title}
            </h1>

            {details?.tagline && (
              <p className="mt-4 text-lg italic text-gold/75 sm:text-xl">
                &ldquo;{details.tagline}&rdquo;
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <span className="hero-rating-badge inline-flex items-center gap-2 rounded-lg border border-gold/35 bg-black/40 px-3 py-2 backdrop-blur-xl">
                <span className="rounded bg-gold px-1.5 py-0.5 text-[9px] font-black tracking-wider text-background">
                  TMDB
                </span>
                <Star size={14} fill="currentColor" className="text-gold" aria-hidden="true" />
                <span className="font-black">{movie.vote_average.toFixed(1)}</span>
              </span>
              {releaseYear && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-xs font-semibold text-white/70 backdrop-blur-xl">
                  <CalendarDays size={13} aria-hidden="true" /> {releaseYear}
                </span>
              )}
              {!!details?.runtime && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-xs font-semibold text-white/70 backdrop-blur-xl">
                  <Clock3 size={13} aria-hidden="true" />
                  {Math.floor(details.runtime / 60)}h {details.runtime % 60}m
                </span>
              )}
              {genres.map((genre) => (
                <span
                  key={genre.id}
                  className="rounded-full border border-white/15 bg-black/30 px-3 py-2 text-xs font-semibold text-white/65 backdrop-blur-xl"
                >
                  {genre.name}
                </span>
              ))}
            </div>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/68 line-clamp-3 sm:text-lg">
              {movie.overview}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => setTrailerOpen(true)}
                className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-sm font-black uppercase tracking-[0.1em] text-background shadow-[0_15px_50px_rgba(255,255,255,0.16)] transition-transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                <Play size={18} fill="currentColor" aria-hidden="true" />
                Watch trailer
              </button>
              <Link
                to={`/movie/${movie.id}`}
                className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/8 px-7 py-4 text-sm font-black uppercase tracking-[0.1em] text-white backdrop-blur-xl transition-all hover:border-gold/45 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-gold/60"
              >
                <Info size={18} aria-hidden="true" />
                More info
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>

        <a
          href="#discover"
          className="absolute bottom-7 left-6 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.28em] text-white/35 transition-colors hover:text-gold"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/20 backdrop-blur-md">
            <ArrowDown size={14} aria-hidden="true" />
          </span>
          <span className="hidden sm:inline">Scroll to discover</span>
        </a>

        <div
          className="absolute bottom-9 right-6 flex gap-1.5 sm:right-1/2 sm:translate-x-1/2"
          role="tablist"
          aria-label="Featured movies"
        >
          {movies.map((featuredMovie, index) => (
            <button
              key={featuredMovie.id}
              onClick={() => setCurrentIndex(index)}
              className={`h-1 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-gold/50 ${
                index === currentIndex ? 'w-9 bg-gold' : 'w-3 bg-white/30'
              }`}
              role="tab"
              aria-selected={index === currentIndex}
              aria-label={`Feature ${featuredMovie.title}`}
            />
          ))}
        </div>
      </div>

      <TrailerModal
        isOpen={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        videos={videos?.results || []}
        title={movie.title}
      />
    </section>
  );
};

export default HeroCarousel;
