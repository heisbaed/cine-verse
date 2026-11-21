import axios from 'axios';
import { completeSeasonEpisodes, completeTVSeasons, needsEpisodeCompletion } from './catalogSeasons';
import type {
  MovieDetails,
  TVDetails,
  Credits,
  VideosResponse,
  MovieResponse,
  TVResponse,
  GenresResponse,
  ReviewsResponse,
  ExternalIds,
  WatchProvidersResponse,
  PeopleResponse,
  PersonCombinedCredits,
  SeasonDetails,
} from '@/types/tmdb';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE_URL = 'https://image.tmdb.org/t/p';

const tmdbApi = axios.create({
  baseURL: BASE_URL,
  timeout: import.meta.env.SSR ? 15000 : 0,
  params: {
    api_key: API_KEY,
    language: 'en-US',
  },
});

// Shared-key throttling: 20-50 concurrent users burst past TMDB's rate
// limit (~40 req/10s per key). Retry 429/5xx with backoff honoring
// Retry-After; fail fast on 401 (invalid key — retrying is pointless).
tmdbApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as { __retryCount?: number } & Record<string, unknown>;
    const status = error.response?.status as number | undefined;
    if (status === 401) return Promise.reject(error);
    const retryable =
      status === 429 || !status || (status >= 500 && status < 600);
    if (!retryable || !config) return Promise.reject(error);
    config.__retryCount = (config.__retryCount || 0) + 1;
    if (config.__retryCount > 3) return Promise.reject(error);
    const retryAfter = Number(error.response?.headers?.['retry-after']);
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 10000)
      : Math.min(1000 * 2 ** (config.__retryCount - 1), 8000);
    await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
    return tmdbApi.request(config as never);
  },
);

export const getImageUrl = (
  path: string | null,
  size: string = 'w500',
): string => {
  if (!path) {
    return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=700&q=80';
  }
  return `${IMG_BASE_URL}/${size}${path}`;
};

export const getTrendingMovies = async (): Promise<MovieResponse> => {
  const response = await tmdbApi.get('/trending/movie/week');
  return response.data;
};

export const getPopularMovies = async (): Promise<MovieResponse> => {
  const response = await tmdbApi.get('/movie/popular');
  return response.data;
};

export const getTopRatedMovies = async (): Promise<MovieResponse> => {
  const response = await tmdbApi.get('/movie/top_rated');
  return response.data;
};

export const getUpcomingMovies = async (): Promise<MovieResponse> => {
  const response = await tmdbApi.get('/movie/upcoming');
  return response.data;
};

export const getNowPlayingMovies = async (): Promise<MovieResponse> => {
  const response = await tmdbApi.get('/movie/now_playing');
  return response.data;
};

export const getTrendingTVShows = async (): Promise<TVResponse> => {
  const response = await tmdbApi.get('/trending/tv/week');
  return response.data;
};

export const getPopularTVShows = async (): Promise<TVResponse> => {
  const response = await tmdbApi.get('/tv/popular');
  return response.data;
};

export const getTopRatedTVShows = async (): Promise<TVResponse> => {
  const response = await tmdbApi.get('/tv/top_rated');
  return response.data;
};

export const getOnTheAirTVShows = async (): Promise<TVResponse> => {
  const response = await tmdbApi.get('/tv/on_the_air');
  return response.data;
};

export const getMovieDetails = async (
  movieId: number,
): Promise<MovieDetails> => {
  const response = await tmdbApi.get(`/movie/${movieId}`, {
    params: { append_to_response: 'external_ids' },
  });
  return response.data;
};

export const getMovieCredits = async (movieId: number): Promise<Credits> => {
  const response = await tmdbApi.get(`/movie/${movieId}/credits`);
  return response.data;
};

export const getMovieVideos = async (
  movieId: number,
): Promise<VideosResponse> => {
  const response = await tmdbApi.get(`/movie/${movieId}/videos`);
  return response.data;
};

export const getSimilarMovies = async (
  movieId: number,
): Promise<MovieResponse> => {
  const response = await tmdbApi.get(`/movie/${movieId}/similar`);
  return response.data;
};

export const getRecommendedMovies = async (
  movieId: number,
): Promise<MovieResponse> => {
  const response = await tmdbApi.get(`/movie/${movieId}/recommendations`);
  return response.data;
};

export const getMovieReviews = async (
  movieId: number,
): Promise<ReviewsResponse> => {
  const response = await tmdbApi.get(`/movie/${movieId}/reviews`);
  return response.data;
};

export const getTVDetails = async (tvId: number): Promise<TVDetails> => {
  const response = await tmdbApi.get(`/tv/${tvId}`, { params: { append_to_response: 'external_ids' } });
  return completeTVSeasons(response.data);
};

export const getTVExternalIds = async (tvId: number): Promise<ExternalIds> => {
  const response = await tmdbApi.get(`/tv/${tvId}/external_ids`);
  return response.data;
};

export const getTVCredits = async (tvId: number): Promise<Credits> => {
  const response = await tmdbApi.get(`/tv/${tvId}/credits`);
  return response.data;
};

export const getTVVideos = async (tvId: number): Promise<VideosResponse> => {
  const response = await tmdbApi.get(`/tv/${tvId}/videos`);
  return response.data;
};

export const getSimilarTVShows = async (tvId: number): Promise<TVResponse> => {
  const response = await tmdbApi.get(`/tv/${tvId}/similar`);
  return response.data;
};

export const getRecommendedTVShows = async (
  tvId: number,
): Promise<TVResponse> => {
  const response = await tmdbApi.get(`/tv/${tvId}/recommendations`);
  return response.data;
};

export const getTVReviews = async (tvId: number): Promise<ReviewsResponse> => {
  const response = await tmdbApi.get(`/tv/${tvId}/reviews`);
  return response.data;
};

export const getTVSeasonDetails = async (
  tvId: number,
  seasonNumber: number,
): Promise<SeasonDetails> => {
  let original: SeasonDetails | null = null;
  try { original = (await tmdbApi.get(`/tv/${tvId}/season/${seasonNumber}`)).data; }
  catch (error) { if ((error as { response?: { status?: number } }).response?.status !== 404) throw error; }
  if (original && !needsEpisodeCompletion(tvId, seasonNumber, original.episodes.length)) return original;
  const show = await getTVDetails(tvId);
  const completed = await completeSeasonEpisodes(show, seasonNumber, original);
  if (!completed) throw new Error('Episode details are not available yet.');
  return completed;
};

// Search aliases improve discovery; records always retain the catalog's real IDs.
const catalogQuery = (query: string) => {
  const normalized = query.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
  const aliases: Record<string, string> = {
    'all queens men': "All the Queen's Men", 'all the queens men': "All the Queen's Men",
    'blood of legacy': 'Blood Legacy', 'the 4 of us': 'The Four of Us',
  };
  return aliases[normalized] ?? query.trim().replace(/['’]s(?=\s|$)/gi, '').replace(/\s+(movies|films|filmography)$/i, '').trim();
};
const creditSearch = new Map<string, Promise<PersonCombinedCredits | null>>();
async function matchingCredits(query: string): Promise<PersonCombinedCredits | null> {
  const normalized = query.toLowerCase().replace(/[’']/g, '').trim();
  if (normalized.length < 4) return null;
  if (!creditSearch.has(normalized)) {
    const pending = (async () => {
      const { data } = await tmdbApi.get('/search/person', { params: { query } });
      const person = data.results?.find((candidate: { name: string; id: number }) =>
        candidate.name.toLowerCase().replace(/[’']/g, '') === normalized);
      if (!person) return null;
      return (await tmdbApi.get(`/person/${person.id}/combined_credits`)).data as PersonCombinedCredits;
    })().catch(() => null);
    creditSearch.set(normalized, pending);
    if (creditSearch.size > 30) creditSearch.delete(creditSearch.keys().next().value!);
  }
  return creditSearch.get(normalized)!;
}
async function searchCatalog(kind: 'movie' | 'tv', query: string, page: number) {
  const cleaned = catalogQuery(query);
  let [response, credits] = await Promise.all([
    tmdbApi.get(`/search/${kind}`, { params: { query: cleaned, page, include_adult: false } }),
    page === 1 ? matchingCredits(cleaned) : Promise.resolve(null),
  ]);
  const corrected = cleaned.replace(/\bto loose\b/gi, 'to lose');
  if (corrected !== cleaned && !response.data.total_results) {
    response = await tmdbApi.get(`/search/${kind}`, { params: { query: corrected, page, include_adult: false } });
  }
  const extra = [...(credits?.cast ?? []), ...(credits?.crew ?? [])].filter((item) => item.media_type === kind);
  const seen = new Set<number>();
  return { ...response.data, results: [...response.data.results, ...extra].filter((item) => {
    if (seen.has(item.id)) return false; seen.add(item.id); return true;
  }) };
}
export const searchMovies = async (query: string, page = 1): Promise<MovieResponse> => searchCatalog('movie', query, page);
export const searchTVShows = async (query: string, page = 1): Promise<TVResponse> => searchCatalog('tv', query, page);

export const searchPeople = async (
  query: string,
  page: number = 1,
): Promise<PeopleResponse> => {
  const response = await tmdbApi.get('/search/person', {
    params: { query, page },
  });
  return response.data;
};

export const getPersonCombinedCredits = async (
  personId: number,
): Promise<PersonCombinedCredits> => {
  const response = await tmdbApi.get(`/person/${personId}/combined_credits`);
  return response.data;
};

export const discoverMovies = async (
  params: Record<string, string> = {},
): Promise<MovieResponse> => {
  const response = await tmdbApi.get('/discover/movie', { params });
  return response.data;
};

export const discoverTVShows = async (
  params: Record<string, string> = {},
): Promise<TVResponse> => {
  const response = await tmdbApi.get('/discover/tv', { params });
  return response.data;
};

export const getGenres = async (): Promise<GenresResponse> => {
  const response = await tmdbApi.get('/genre/movie/list');
  return response.data;
};

export const getTVGenres = async (): Promise<GenresResponse> => {
  const response = await tmdbApi.get('/genre/tv/list');
  return response.data;
};

export const getMovieExternalIds = async (
  movieId: number,
): Promise<ExternalIds> => {
  const response = await tmdbApi.get(`/movie/${movieId}/external_ids`);
  return response.data;
};

export const getWatchProviders = async (
  movieId: number,
): Promise<WatchProvidersResponse> => {
  const response = await tmdbApi.get(`/movie/${movieId}/watch/providers`);
  return response.data;
};

export const hasApiKey = (): boolean => !!API_KEY;
