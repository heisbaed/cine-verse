import type { Episode, Season, SeasonDetails, TVDetails } from '../types/tmdb';

type GuideSeason = { number: number; count: number; premiere: string | null; finale: string | null; weekdays: number[] };
type Guide = { source: string; seasons: GuideSeason[] };
const service = 'https://cineverse-stream-service.charlesbabuu0.workers.dev';
const guides = new Map<number, { until: number; pending: Promise<Guide | null>; value?: Guide }>();

function guideFor(show: TVDetails): Promise<Guide | null> {
  const saved = guides.get(show.id);
  if (saved && saved.until > Date.now()) return saved.pending;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  const query = new URLSearchParams({ title: show.name, year: show.first_air_date?.slice(0, 4) ?? '' });
  const pending = fetch(`${service}/catalog/tv/${show.id}?${query}`, { signal: controller.signal })
    .then(async response => {
      if (!response.ok) throw new Error('Catalog lookup unavailable');
      const data = await response.json() as Guide;
      if (data && Array.isArray(data.seasons)) {
        const entry = guides.get(show.id);
        if (entry?.pending === pending) entry.value = data;
      }
      return data && Array.isArray(data.seasons) ? data : null;
    }).catch(() => { guides.delete(show.id); return null; }).finally(() => clearTimeout(timer));
  guides.set(show.id, { until: Date.now() + 5 * 60_000, pending });
  if (guides.size > 50) guides.delete(guides.keys().next().value!);
  return pending;
}

export function needsEpisodeCompletion(id: number, season: number, count: number) {
  const entry = guides.get(id);
  return !!entry && entry.until > Date.now() && (entry.value?.seasons.find(item => item.number === season)?.count ?? 0) > count;
}

/** Add published seasons/counts without replacing TMDB identities, artwork or episode details. */
export async function completeTVSeasons(show: TVDetails): Promise<TVDetails> {
  const guide = await guideFor(show);
  if (!guide?.seasons.length) return show;
  const seasons: Season[] = [...show.seasons];
  for (const extra of guide.seasons) {
    if (!Number.isSafeInteger(extra.number) || extra.number < 1 || !Number.isSafeInteger(extra.count) || extra.count < 1 || extra.count > 5000) continue;
    const index = seasons.findIndex(season => season.season_number === extra.number);
    if (index >= 0) seasons[index] = { ...seasons[index], episode_count: Math.max(seasons[index].episode_count, extra.count) };
    else seasons.push({ id: -(show.id * 10000 + extra.number), name: `Season ${extra.number}`, season_number: extra.number,
      overview: '', poster_path: show.poster_path, air_date: extra.premiere, episode_count: extra.count, vote_average: 0 });
  }
  seasons.sort((a, b) => a.season_number - b.season_number);
  return { ...show, seasons, number_of_seasons: Math.max(show.number_of_seasons, seasons.filter(item => item.season_number > 0).length),
    number_of_episodes: Math.max(show.number_of_episodes, seasons.reduce((total, item) => total + item.episode_count, 0)) };
}

function scheduledDates(season: GuideSeason): string[] {
  if (!season.premiere || !season.finale || !season.weekdays?.length) return [];
  const dates: string[] = [];
  const end = new Date(`${season.finale}T12:00:00Z`).getTime();
  for (const day = new Date(`${season.premiere}T12:00:00Z`); day.getTime() <= end && dates.length <= 5000; day.setUTCDate(day.getUTCDate() + 1)) {
    if (season.weekdays.includes(day.getUTCDay())) dates.push(day.toISOString().slice(0, 10));
  }
  // Derive dates only when the published recurrence exactly agrees with the published total.
  return dates.length === season.count ? dates : [];
}

export async function completeSeasonEpisodes(show: TVDetails, number: number, original: SeasonDetails | null): Promise<SeasonDetails | null> {
  const guide = await guideFor(show);
  const extra = guide?.seasons.find(item => item.number === number);
  if (!extra || extra.count <= (original?.episodes.length ?? 0)) return original;
  const season = show.seasons.find(item => item.season_number === number);
  if (!season) return original;
  const existing = new Map(original?.episodes.map(item => [item.episode_number, item]));
  const dates = scheduledDates(extra);
  const episodes: Episode[] = Array.from({ length: Math.max(extra.count, original?.episode_count ?? 0) }, (_, index) => {
    const episode = index + 1;
    return existing.get(episode) ?? { id: -(show.id * 10000000 + number * 10000 + episode), name: `Episode ${episode}`,
      episode_number: episode, season_number: number, overview: '', still_path: null, runtime: null,
      air_date: dates[index] ?? null, vote_average: 0, vote_count: 0 };
  });
  return { ...season, ...original, season_number: number, episode_count: episodes.length, episodes };
}
