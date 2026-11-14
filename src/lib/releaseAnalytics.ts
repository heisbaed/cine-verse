export interface ReleaseDownloads {
  repository: string;
  label: string;
  total: number;
  latest: { version: string; downloads: number; url: string } | null;
}

export const RELEASE_REPOSITORIES = [
  { repository: 'heisbaed/cine-verse', label: 'Phone · website downloads', kind: 'mobile' },
  { repository: 'heisbaed/cineverseTV', label: 'Android TV', kind: 'tv' },
] as const;

interface Release {
  tag_name: string; html_url: string; published_at: string;
  draft?: boolean; prerelease?: boolean;
  assets: Array<{ name: string; download_count: number }>;
}

export function summarizeReleases(releases: Release[], repository: string, label: string, kind: 'mobile' | 'tv'): ReleaseDownloads {
  const rows = releases.filter((release) => !release.draft && !release.prerelease)
    .map((release) => ({ release, assets: release.assets.filter((asset) =>
      asset.name.toLowerCase().endsWith('.apk') && (kind === 'tv' || !/(?:^|[-_])tv(?:[-_.]|$)/i.test(asset.name))) }))
    .filter((row) => row.assets.length)
    .sort((a, b) => b.release.published_at.localeCompare(a.release.published_at));
  const count = (assets: Release['assets']) => assets.reduce((sum, asset) => sum + Math.max(0, asset.download_count || 0), 0);
  const first = rows[0];
  return {
    repository, label, total: rows.reduce((sum, row) => sum + count(row.assets), 0),
    latest: first ? { version: first.release.tag_name, downloads: count(first.assets), url: first.release.html_url } : null,
  };
}

export async function getReleaseDownloads(source: typeof RELEASE_REPOSITORIES[number], signal?: AbortSignal): Promise<ReleaseDownloads> {
  const all: Release[] = [];
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(`https://api.github.com/repos/${source.repository}/releases?per_page=100&page=${page}`, { signal });
    if (!response.ok) throw new Error('Release download counts are temporarily unavailable');
    const releases = await response.json() as Release[];
    all.push(...releases);
    if (releases.length < 100) return summarizeReleases(all, source.repository, source.label, source.kind);
  }
  throw new Error('Release history exceeds the available download window');
}
