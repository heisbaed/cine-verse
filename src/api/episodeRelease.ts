import { getTVSeasonDetails } from './tmdb';

type EpisodeRequest = { kind: 'movie' | 'tv'; tmdbId: number; season?: number; episode?: number };
type EpisodeDate = { episode_number: number; air_date: string | null };
const seasons = new Map<string, { until: number; value: Promise<EpisodeDate[] | null> }>();

export function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export const isUpcomingEpisode = (date?: string | null) => !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date > localToday();
export const releaseLabel = (date: string) => `Available ${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
export class EpisodeNotReleasedError extends Error {
  readonly code = 'UPCOMING_EPISODE';
  constructor(readonly airDate: string) { super(releaseLabel(airDate)); this.name = 'EpisodeNotReleasedError'; }
}

async function episodeDates(request: EpisodeRequest): Promise<EpisodeDate[] | null> {
  if (request.kind !== 'tv' || !request.season) return null;
  const key = `${request.tmdbId}:${request.season}`;
  if ((seasons.get(key)?.until ?? 0) <= Date.now()) {
    const value = getTVSeasonDetails(request.tmdbId, request.season).then(data => data.episodes).catch(() => null);
    seasons.set(key, { until: Date.now() + 5 * 60_000, value });
    if (seasons.size > 50) seasons.delete(seasons.keys().next().value!);
  }
  // Missing or slow catalog data must never prevent a provider from finding a real file.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([seasons.get(key)!.value, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 3000); })]); }
  finally { if (timer) clearTimeout(timer); }
}

export async function assertEpisodeReleased(request: EpisodeRequest) {
  const episode = (await episodeDates(request))?.find(item => item.episode_number === request.episode);
  if (isUpcomingEpisode(episode?.air_date)) throw new EpisodeNotReleasedError(episode!.air_date!);
}

export async function releasedEpisodeCount(request: EpisodeRequest): Promise<number | undefined> {
  const episodes = await episodeDates(request);
  if (!episodes?.length) return undefined;
  return Math.max(0, ...episodes.filter(item => !isUpcomingEpisode(item.air_date)).map(item => item.episode_number));
}
