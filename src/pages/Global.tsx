import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Film, Globe, Tv } from 'lucide-react';
import { discoverMovies, discoverTVShows, hasApiKey } from '@/api/tmdb';
import MovieGrid from '@/components/sections/MovieGrid';
import SetupScreen from '@/components/sections/SetupScreen';
import ErrorState from '@/components/ui/ErrorState';
import { useSEO } from '@/hooks/useSEO';
import type { MediaResponse } from '@/types/tmdb';

interface Region {
  name: string;
  params: Record<string, string>;
}

const regions: Region[] = [
  { name: 'Hollywood', params: { with_original_language: 'en' } },
  { name: 'Bollywood', params: { with_original_language: 'hi' } },
  { name: 'Nollywood', params: { with_original_language: 'yo' } },
  { name: 'East Africa', params: { with_original_language: 'sw' } },
  { name: 'South Africa', params: { with_original_language: 'af' } },
  { name: 'Korean Cinema', params: { with_original_language: 'ko' } },
  { name: 'Japanese Cinema', params: { with_original_language: 'ja' } },
  { name: 'Chinese Cinema', params: { with_original_language: 'zh' } },
  { name: 'French Cinema', params: { with_original_language: 'fr' } },
  { name: 'European Cinema', params: { with_original_language: 'de' } },
  { name: 'Latin Cinema', params: { with_original_language: 'es' } },
  { name: 'Middle Eastern Cinema', params: { with_original_language: 'ar' } },
  { name: 'Turkish Cinema', params: { with_original_language: 'tr' } },
  { name: 'Italian Cinema', params: { with_original_language: 'it' } },
];

const Global: React.FC = () => {
  useSEO({
    title: 'Global Cinema',
    description:
      'Explore movies from around the world — Hollywood, Bollywood, Nollywood, Korean Cinema, and more on Cine-verse.',
  });

  const [selectedRegion, setSelectedRegion] = useState(regions[0]);
  const [contentType, setContentType] = useState<'movie' | 'tv'>('movie');

  const {
    data: regionMovies,
    isLoading,
    error,
    refetch,
  } = useQuery<MediaResponse>({
    queryKey: ['globalMedia', contentType, selectedRegion.name],
    queryFn: () =>
      contentType === 'tv'
        ? discoverTVShows({
            ...selectedRegion.params,
            sort_by: 'popularity.desc',
          })
        : discoverMovies({
            ...selectedRegion.params,
            sort_by: 'popularity.desc',
          }),
    enabled: hasApiKey(),
  });

  if (!hasApiKey()) {
    return <SetupScreen />;
  }

  const media = regionMovies?.results || [];

  return (
    <div className="min-h-screen px-6 py-10">
      <h1 className="text-4xl sm:text-5xl font-black mb-8 flex items-center gap-3">
        <Globe size={40} className="text-gold" aria-hidden="true" />
        Global Cinema
      </h1>

      <div
        className="mb-7 inline-flex rounded-full border border-white/10 bg-surface p-1.5"
        role="tablist"
        aria-label="Global content type"
      >
        <button
          onClick={() => setContentType('movie')}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black transition-all ${
            contentType === 'movie'
              ? 'bg-gold text-background'
              : 'text-white/55 hover:text-white'
          }`}
          role="tab"
          aria-selected={contentType === 'movie'}
        >
          <Film size={16} aria-hidden="true" /> Movies
        </button>
        <button
          onClick={() => setContentType('tv')}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black transition-all ${
            contentType === 'tv'
              ? 'bg-gold text-background'
              : 'text-white/55 hover:text-white'
          }`}
          role="tab"
          aria-selected={contentType === 'tv'}
        >
          <Tv size={16} aria-hidden="true" /> TV Series
        </button>
      </div>

      <div
        className="flex flex-wrap gap-3 mb-10"
        role="tablist"
        aria-label="Select a region"
      >
        {regions.map((region) => (
          <button
            key={region.name}
            onClick={() => setSelectedRegion(region)}
            className={`px-6 py-3 rounded-full font-bold transition-all focus:outline-none focus:ring-2 focus:ring-gold/50 ${
              selectedRegion.name === region.name
                ? 'bg-gradient-to-r from-gold to-ruby text-background'
                : 'bg-surface text-white/70 border border-white/10 hover:bg-white/10'
            }`}
            role="tab"
            aria-selected={selectedRegion.name === region.name}
            aria-label={`View ${region.name} ${contentType === 'tv' ? 'TV series' : 'movies'}`}
          >
            {region.name}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState
          message={`Failed to load regional ${contentType === 'tv' ? 'TV series' : 'movies'}.`}
          onRetry={() => refetch()}
        />
      ) : (
        <MovieGrid movies={media} isLoading={isLoading} />
      )}
    </div>
  );
};

export default Global;
