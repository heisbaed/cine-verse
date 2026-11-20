import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPlaybackSources } from '@/api/scraper';
import type { PlaybackRequest } from '@/types/playback';

export function usePlaybackSources(request: PlaybackRequest | null) {
  const client = useQueryClient();
  return useQuery({
    queryKey: [
      'playbackSources',
      request?.kind ?? null,
      request?.tmdbId ?? null,
      request?.season ?? null,
      request?.episode ?? null,
    ],
    queryFn: ({ signal, queryKey }) => fetchPlaybackSources(request!, signal, sources => client.setQueryData(queryKey, sources)),
    enabled: Boolean(request),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
