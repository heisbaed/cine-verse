import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Film, LoaderCircle, Search, Tv, UserRound, X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import {
  discoverMovies,
  discoverTVShows,
  getGenres,
  getImageUrl,
  getPersonCombinedCredits,
  getTVGenres,
  hasApiKey,
  searchMovies,
  searchPeople,
  searchTVShows,
} from '@/api/tmdb';
import MovieGrid from '@/components/sections/MovieGrid';
import SetupScreen from '@/components/sections/SetupScreen';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { useSEO } from '@/hooks/useSEO';
import type { MediaItem, MediaResponse } from '@/types/tmdb';
import { getMediaDate, getMediaTitle } from '@/utils/media';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 50 }, (_, index) => currentYear - index);

const languages = [
  { code: '', name: 'All Languages' },
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ko', name: 'Korean' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'ar', name: 'Arabic' },
  { code: 'tr', name: 'Turkish' },
  { code: 'it', name: 'Italian' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'sw', name: 'Swahili' },
];

const sortOptions = [
  { value: 'popularity.desc', label: 'Popularity (High to Low)' },
  { value: 'popularity.asc', label: 'Popularity (Low to High)' },
  { value: 'vote_average.desc', label: 'Rating (High to Low)' },
  { value: 'vote_average.asc', label: 'Rating (Low to High)' },
  { value: 'release_date.desc', label: 'Release Date (Newest)' },
  { value: 'release_date.asc', label: 'Release Date (Oldest)' },
  { value: 'revenue.desc', label: 'Revenue (High to Low)' },
  { value: 'title.asc', label: 'Title (A-Z)' },
];

const tvSortOptions = [
  { value: 'popularity.desc', label: 'Popularity (High to Low)' },
  { value: 'popularity.asc', label: 'Popularity (Low to High)' },
  { value: 'vote_average.desc', label: 'Rating (High to Low)' },
  { value: 'vote_average.asc', label: 'Rating (Low to High)' },
  { value: 'first_air_date.desc', label: 'First Air Date (Newest)' },
  { value: 'first_air_date.asc', label: 'First Air Date (Oldest)' },
  { value: 'name.asc', label: 'Title (A-Z)' },
];

const sortCredits = (items: MediaItem[], sortBy: string): MediaItem[] => {
  const sorted = [...items];
  const ascending = sortBy.endsWith('.asc');
  const direction = ascending ? 1 : -1;

  sorted.sort((first, second) => {
    if (sortBy.startsWith('vote_average')) {
      return (first.vote_average - second.vote_average) * direction;
    }
    if (
      sortBy.startsWith('release_date') ||
      sortBy.startsWith('first_air_date')
    ) {
      return (
        (new Date(getMediaDate(first)).getTime() -
          new Date(getMediaDate(second)).getTime()) *
        direction
      );
    }
    if (sortBy.startsWith('title') || sortBy.startsWith('name')) {
      return getMediaTitle(first).localeCompare(getMediaTitle(second));
    }
    return (first.popularity - second.popularity) * direction;
  });
  return sorted;
};

const Explore: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const urlGenre = searchParams.get('genre') || '';
  const personId = Number.parseInt(searchParams.get('person') || '0');
  const personName = searchParams.get('personName') || '';
  const contentType = searchParams.get('type') === 'tv' ? 'tv' : 'movie';
  const [query, setQuery] = useState(urlQuery);
  const [selectedGenre, setSelectedGenre] = useState(urlGenre);
  const [year, setYear] = useState('');
  const [language, setLanguage] = useState('');
  const [minRating, setMinRating] = useState('');
  const [sortBy, setSortBy] = useState('popularity.desc');
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 500);

  useSEO({
    title: personName
      ? `${personName} Movies & Series`
      : `Explore ${contentType === 'tv' ? 'TV Series' : 'Movies'}`,
    description:
      'Search titles and actors, or discover movies and TV series by genre, year, language, and rating.',
  });

  useEffect(() => {
    setQuery(urlQuery);
    setSelectedGenre(urlGenre);
    setSortBy('popularity.desc');
  }, [urlQuery, urlGenre, contentType, personId]);

  const changeContentType = (type: 'movie' | 'tv') => {
    const nextParams = new URLSearchParams(searchParams);
    if (type === 'tv') {
      nextParams.set('type', 'tv');
    } else {
      nextParams.delete('type');
    }
    nextParams.delete('genre');
    setSearchParams(nextParams);
  };

  const selectPerson = (id: number, name: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('person', String(id));
    nextParams.set('personName', name);
    nextParams.delete('q');
    nextParams.delete('genre');
    setSearchParams(nextParams);
  };

  const clearPerson = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('person');
    nextParams.delete('personName');
    setSearchParams(nextParams);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!personId) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('person');
    nextParams.delete('personName');
    if (value) nextParams.set('q', value);
    setSearchParams(nextParams, { replace: true });
  };

  const {
    data: genresData,
    error: genresError,
    refetch: refetchGenres,
  } = useQuery({
    queryKey: ['genres', contentType],
    queryFn: contentType === 'tv' ? getTVGenres : getGenres,
    enabled: hasApiKey(),
  });

  const { data: peopleData, isFetching: peopleLoading } = useQuery({
    queryKey: ['peopleSearch', debouncedQuery],
    queryFn: () => searchPeople(debouncedQuery),
    enabled:
      hasApiKey() && !personId && debouncedQuery.trim().length >= 2,
  });

  const {
    data: searchResults,
    isLoading,
    error: searchError,
    refetch: refetchSearch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'exploreMedia',
      contentType,
      debouncedQuery,
      personId,
      selectedGenre,
      year,
      language,
      minRating,
      sortBy,
    ],
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<MediaResponse> => {
      const page = typeof pageParam === 'number' ? pageParam : 1;

      if (personId) {
        const credits = await getPersonCombinedCredits(personId);
        const seen = new Set<number>();
        let matchingCredits = credits.cast.filter((item) => {
          if (item.media_type !== contentType || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        }) as MediaItem[];

        if (selectedGenre) {
          matchingCredits = matchingCredits.filter((item) =>
            item.genre_ids?.includes(Number(selectedGenre)),
          );
        }
        if (year) {
          matchingCredits = matchingCredits.filter(
            (item) => getMediaDate(item)?.split('-')[0] === year,
          );
        }
        if (language) {
          matchingCredits = matchingCredits.filter(
            (item) => item.original_language === language,
          );
        }
        if (minRating) {
          matchingCredits = matchingCredits.filter(
            (item) => item.vote_average >= Number(minRating),
          );
        }

        matchingCredits = sortCredits(matchingCredits, sortBy);
        const start = (page - 1) * 20;
        return {
          page,
          results: matchingCredits.slice(start, start + 20),
          total_pages: Math.max(1, Math.ceil(matchingCredits.length / 20)),
          total_results: matchingCredits.length,
        };
      }

      if (debouncedQuery) {
        return contentType === 'tv'
          ? await searchTVShows(debouncedQuery, page)
          : await searchMovies(debouncedQuery, page);
      }

      const params: Record<string, string> = {
        sort_by: sortBy,
        page: String(page),
      };
      if (selectedGenre) params.with_genres = selectedGenre;
      if (year) {
        params[
          contentType === 'tv' ? 'first_air_date_year' : 'primary_release_year'
        ] = year;
      }
      if (language) params.with_original_language = language;
      if (minRating) params['vote_average.gte'] = minRating;
      return contentType === 'tv'
        ? await discoverTVShows(params)
        : await discoverMovies(params);
    },
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    enabled: hasApiKey(),
  });

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void fetchNextPage();
      },
      { rootMargin: '500px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (!hasApiKey()) return <SetupScreen />;

  const media = searchResults?.pages.flatMap((page) => page.results) || [];
  const genres = genresData?.genres || [];
  const totalResults = searchResults?.pages[0]?.total_results || 0;

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mb-8">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-gold">
          Discover your next story
        </p>
        <h1 className="text-4xl font-black sm:text-5xl">
          {personName
            ? `${contentType === 'tv' ? 'Series' : 'Movies'} featuring ${personName}`
            : `Explore ${contentType === 'tv' ? 'TV Series' : 'Movies'}`}
        </h1>
        {!isLoading && totalResults > 0 && (
          <p className="mt-3 text-sm text-white/40">
            {totalResults.toLocaleString()} titles found
          </p>
        )}
      </div>

      <div
        className="mb-6 inline-flex rounded-full border border-white/10 bg-surface p-1.5"
        role="tablist"
        aria-label="Content type"
      >
        <button
          onClick={() => changeContentType('movie')}
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
          onClick={() => changeContentType('tv')}
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

      <div className="mb-10 space-y-4 rounded-3xl border border-white/10 bg-surface p-6">
        {personId > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-gold/25 bg-gold/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <UserRound size={19} className="text-gold" aria-hidden="true" />
              <span className="text-sm">
                Showing acting credits for{' '}
                <strong className="text-gold">{personName}</strong>
              </span>
            </div>
            <button
              onClick={clearPerson}
              className="rounded-full p-1 text-white/45 hover:bg-white/10 hover:text-white"
              aria-label="Clear actor filter"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="relative">
          <label htmlFor="movie-search" className="sr-only">
            Search titles or actors
          </label>
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50"
            size={20}
            aria-hidden="true"
          />
          <input
            id="movie-search"
            type="text"
            placeholder={`Search ${contentType === 'tv' ? 'series' : 'movies'} or actors...`}
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-background py-4 pl-12 pr-4 text-white transition-all placeholder-white/40 focus:border-gold/50 focus:outline-none"
          />
        </div>

        {!personId && debouncedQuery.length >= 2 && (
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-gold/65">
              <UserRound size={14} aria-hidden="true" /> People
              {peopleLoading && <LoaderCircle size={13} className="animate-spin" />}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {peopleData?.results.slice(0, 6).map((person) => (
                <button
                  key={person.id}
                  onClick={() => selectPerson(person.id, person.name)}
                  className="flex min-w-48 items-center gap-3 rounded-2xl border border-white/10 bg-background/60 p-3 text-left transition-all hover:border-gold/40"
                >
                  {person.profile_path ? (
                    <img
                      src={getImageUrl(person.profile_path, 'w185')}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-white/5 text-white/30">
                      <UserRound size={21} aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {person.name}
                    </span>
                    <span className="text-xs text-white/35">
                      {person.known_for_department || 'Acting'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <select
            value={selectedGenre}
            onChange={(event) => setSelectedGenre(event.target.value)}
            className="rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white transition-all focus:border-gold/50 focus:outline-none"
            aria-label="Filter by genre"
          >
            <option value="">All Genres</option>
            {genres.map((genre) => (
              <option key={genre.id} value={genre.id.toString()}>
                {genre.name}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white transition-all focus:border-gold/50 focus:outline-none"
            aria-label="Filter by year"
          >
            <option value="">All Years</option>
            {years.map((value) => (
              <option key={value} value={value.toString()}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white transition-all focus:border-gold/50 focus:outline-none"
            aria-label="Filter by language"
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={minRating}
            onChange={(event) => setMinRating(event.target.value)}
            className="rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white transition-all focus:border-gold/50 focus:outline-none"
            aria-label="Minimum rating"
          >
            <option value="">Min Rating</option>
            {[9, 8, 7, 6, 5].map((rating) => (
              <option key={rating} value={rating}>
                {rating}+
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-2xl border border-white/10 bg-background px-4 py-3 text-sm text-white transition-all focus:border-gold/50 focus:outline-none"
            aria-label="Sort by"
          >
            {(contentType === 'tv' ? tvSortOptions : sortOptions).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {genresError && !genresData ? (
        <ErrorState
          message="Failed to load genres."
          onRetry={() => refetchGenres()}
        />
      ) : searchError ? (
        <ErrorState
          message={`Failed to load ${contentType === 'tv' ? 'TV series' : 'movie'} results.`}
          onRetry={() => refetchSearch()}
        />
      ) : isLoading ? (
        <MovieGrid movies={[]} isLoading={true} />
      ) : media.length > 0 ? (
        <>
          <MovieGrid movies={media} />
          <div ref={loadMoreRef} className="flex min-h-32 items-center justify-center">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-3 text-sm text-white/40">
                <LoaderCircle size={19} className="animate-spin text-gold" />
                Loading more titles...
              </div>
            ) : hasNextPage ? (
              <button
                onClick={() => void fetchNextPage()}
                className="rounded-full border border-white/10 bg-surface px-6 py-3 text-sm font-bold text-white/60 transition-all hover:border-gold/40 hover:text-gold"
              >
                Load more
              </button>
            ) : (
              <p className="text-sm text-white/30">You reached the end.</p>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          title="No Titles Found"
          message={
            personName
              ? `No ${contentType === 'tv' ? 'series' : 'movies'} found for ${personName} with these filters.`
              : debouncedQuery
                ? `No results for "${debouncedQuery}". Try a title or choose an actor above.`
                : 'No titles match your filters. Try adjusting your criteria.'
          }
        />
      )}
    </div>
  );
};

export default Explore;
