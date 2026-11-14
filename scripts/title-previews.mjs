import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function titlePreview(template, item, kind, origin) {
  const title = item.title || item.name;
  if (!Number.isSafeInteger(item.id) || item.id <= 0 || !title || !['movie', 'tv'].includes(kind)) return null;
  const path = `/${kind}/${item.id}`;
  const imagePath = item.backdrop_path || item.poster_path;
  const image = typeof imagePath === 'string' && /^\/[\w.-]+$/.test(imagePath)
    ? `https://image.tmdb.org/t/p/w780${imagePath}` : `${origin}/og-image.png`;
  const description = item.overview?.trim().slice(0, 280) || `Explore ${title} on Cineverse.`;
  const values = {
    'name="description"': description, 'property="og:title"': `${title} · Cineverse`,
    'property="og:description"': description, 'property="og:image"': image,
    'property="og:url"': `${origin}${path}`, 'name="twitter:title"': `${title} · Cineverse`,
    'name="twitter:description"': description, 'name="twitter:image"': image,
  };
  let html = template.replace(/<title>.*?<\/title>/s, () => `<title>${escapeHTML(title)} · Cineverse</title>`);
  for (const [attribute, value] of Object.entries(values)) {
    html = html.replace(new RegExp(`<meta ${attribute} content="[^"]*"\\s*/?>`),
      () => `<meta ${attribute} content="${escapeHTML(value)}" />`);
  }
  html = html.replace('</head>', `<link rel="canonical" href="${origin}${path}" />\n</head>`);
  // The application still renders normally; this public fallback is for readers without JavaScript.
  html = html.replace('</body>', `<noscript><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p><a href="/download">Get Cineverse</a></noscript></body>`);
  return { path, html, image, title };
}

export async function writeTitlePreviews({ template, queries, dist, origin }) {
  const titles = new Map();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Number.isSafeInteger(value.id) && (value.title || value.name) && ('overview' in value)) {
      const kind = value.media_type === 'tv' || 'first_air_date' in value ? 'tv' : 'movie';
      titles.set(`${kind}/${value.id}`, { item: value, kind });
    }
    if (Array.isArray(value)) value.forEach(visit);
    else { if (value.results) visit(value.results); if (value.pages) visit(value.pages); }
  };
  for (const query of queries) visit(query.state.data);
  const manifest = [];
  for (const { item, kind } of titles.values()) {
    const preview = titlePreview(template, item, kind, origin);
    if (!preview) continue;
    const folder = resolve(dist, kind, String(item.id));
    await mkdir(folder, { recursive: true });
    await writeFile(resolve(folder, 'index.html'), preview.html);
    manifest.push({ path: preview.path, title: preview.title, image: preview.image });
  }
  await writeFile(resolve(dist, 'title-previews.json'), JSON.stringify({ generatedAt: new Date().toISOString(), titles: manifest }));
  console.log(`Generated crawler-readable previews for ${manifest.length} catalog titles`);
}
