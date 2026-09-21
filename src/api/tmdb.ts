import axios from 'axios';
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
  params: {
    api_key: API_KEY,
    language: 'en-US',
  },
});

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
  const response = await tmdbApi.get(`/tv/${tvId}`);
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
  const response = await tmdbApi.get(`/tv/${tvId}/season/${seasonNumber}`);
  return response.data;
};

export const searchMovies = async (
  query: string,
  page: number = 1,
): Promise<MovieResponse> => {
  const response = await tmdbApi.get('/search/movie', {
    params: { query, page },
  });
  return response.data;
};

export const searchTVShows = async (
  query: string,
  page: number = 1,
): Promise<TVResponse> => {
  const response = await tmdbApi.get('/search/tv', {
    params: { query, page },
  });
  return response.data;
};

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
