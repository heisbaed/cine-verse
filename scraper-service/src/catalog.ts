/** Public broadcast facts only. Remote HTML and scripts never reach the player or app. */
export type GuideSeason = { number: number; count: number; premiere: string | null; finale: string | null; weekdays: number[] };
export type SeasonGuide = { source: string; seasons: GuideSeason[] };
const headers = { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' };
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const clean = (value: string) => value.replace(/<[^>]*>/g, '').replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => {
  const n = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
  return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
}).replace(/&(?:amp|quot|apos|nbsp|ndash|mdash);/g, value => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ', '&ndash;': '-', '&mdash;': '-' })[value] ?? value).replace(/\s+/g, ' ').trim();
const normalized = (value: string) => clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function date(value: string): string | null {
  const found = clean(value).match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  const month = found ? months.findIndex(item => item.toLowerCase() === found[2].toLowerCase()) : -1;
  return found && month >= 0 ? `${found[3]}-${String(month + 1).padStart(2, '0')}-${found[1].padStart(2, '0')}` : null;
}
export function parseGuideSeasons(html: string): GuideSeason[] {
  const seasons: GuideSeason[] = [];
  const blocks = html.matchAll(/<span[^>]*id="[^"]*lblSeasonName_\d+"[^>]*>\s*Season\s+(\d+)\s*<\/span>([\s\S]*?)(?=<h3\b|$)/gi);
  for (const block of blocks) {
    const table = block[2].match(/<table\b[\s\S]*?<\/table>/i)?.[0];
    if (!table) continue;
    for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(item => clean(item[1]));
      if (cells.length < 5) continue;
      const count = Number(cells[4].replace(/,/g, ''));
      if (!Number.isSafeInteger(count) || count < 1 || count > 5000) continue;
      const weekdays = /weekdays|monday.{0,8}friday/i.test(cells[3]) ? [1, 2, 3, 4, 5] : [];
      seasons.push({ number: Number(block[1]), count, premiere: date(cells[1]), finale: date(cells[2]), weekdays });
      break;
    }
  }
  return seasons;
}

export async function regionalSeasonGuide(title: string, year: number | undefined, signal: AbortSignal): Promise<SeasonGuide> {
  const empty: SeasonGuide = { source: '', seasons: [] };
  const key = new Request(`https://catalog.cineverse.invalid/seasons?title=${encodeURIComponent(normalized(title))}&year=${year ?? ''}`);
  const cache = typeof caches !== 'undefined' ? await caches.open('cineverse-catalog-v1') : null;
  const cached = await cache?.match(key);
  if (cached) return cached.json() as Promise<SeasonGuide>;
  const response = await fetch(`https://www.tvsa.co.za/shows/listshows.aspx?search=${encodeURIComponent(title)}`, { headers, signal });
  if (!response.ok) throw new Error('Secondary catalog is unavailable');
  const html = await response.text();
  const matches = new Set<string>();
  for (const link of html.matchAll(/<a\b[^>]*href=["']\/shows\/viewshow\.aspx\?showid=(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (normalized(link[2]) === normalized(title)) matches.add(link[1]);
  }
  // Similar titles/remakes must never silently supply another show's seasons.
  for (const id of [...matches].slice(0, 3)) {
    const source = `https://www.tvsa.co.za/shows/viewshowseasons.aspx?showid=${id}`;
    const page = await fetch(source, { headers, signal });
    if (!page.ok) continue;
    const seasons = parseGuideSeasons(await page.text());
    const premiereYear = seasons.find(item => item.number === 1)?.premiere?.slice(0, 4);
    if (!seasons.length || (year && (!premiereYear || Math.abs(Number(premiereYear) - year) > 1))) continue;
    const result = { source, seasons };
    await cache?.put(key, new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } }));
    return result;
  }
  await cache?.put(key, new Response(JSON.stringify(empty), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } }));
  return empty;
}
