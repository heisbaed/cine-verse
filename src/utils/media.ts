import type { MediaItem, MediaType, Movie, TVShow } from '@/types/tmdb';

export const getMediaType = (item: MediaItem): MediaType =>
  'name' in item ? 'tv' : 'movie';

export const getMediaTitle = (item: MediaItem): string =>
  'name' in item ? item.name : item.title;

export const getMediaDate = (item: MediaItem): string =>
  'name' in item ? item.first_air_date : item.release_date;

export const isTVShow = (item: MediaItem): item is TVShow => 'name' in item;

export const isMovie = (item: MediaItem): item is Movie => 'title' in item;
