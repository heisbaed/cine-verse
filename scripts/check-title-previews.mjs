import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { titlePreview } from './title-previews.mjs';

const template = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const item = { id: 550, title: 'A "title" </script>', overview: '<img src=x onerror=alert(1)>', backdrop_path: '/image.jpg' };
const preview = titlePreview(template, item, 'movie', 'https://ourcineverse.web.app');
assert.ok(preview.html.includes('A &quot;title&quot; &lt;/script&gt;'));
assert.ok(preview.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert.ok(preview.html.includes('content="https://image.tmdb.org/t/p/w780/image.jpg"'));
assert.ok(preview.html.includes('href="https://ourcineverse.web.app/movie/550"'));
assert.equal(titlePreview(template, { id: -1, title: 'Bad' }, 'movie', 'https://ourcineverse.web.app'), null);
const manifest = JSON.parse(await readFile(new URL('../dist/title-previews.json', import.meta.url), 'utf8'));
assert.ok(manifest.titles.length > 0);
for (const title of manifest.titles) {
  const html = await readFile(new URL(`../dist${title.path}/index.html`, import.meta.url), 'utf8');
  assert.ok(html.includes(`content="${title.image}"`));
  assert.ok(html.includes(`href="https://ourcineverse.web.app${title.path}"`));
  assert.ok(!html.includes('og-image.svg'));
}
console.log(`PASS ${manifest.titles.length} title preview documents, canonical URLs, image metadata and HTML escaping`);
