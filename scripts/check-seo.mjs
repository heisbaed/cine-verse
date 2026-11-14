import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const origin = 'https://ourcineverse.web.app';
const pages = ['/', '/explore', '/upcoming', '/global', '/download'];
const read = (filename) => readFile(resolve(dist, filename), 'utf8');
const sw = await read('sw.js');
const assetNames = await readdir(resolve(dist, 'assets'));
const titles = new Set();

for (const path of pages) {
  const filename = path === '/' ? 'index.html' : `${path.slice(1)}.html`;
  const html = await read(filename);
  const body = html.split('<body>')[1].split('<script id="cineverse-query-state"')[0];
  assert.match(body, /<h1[\s>]/, `${path}: a visible page heading must be in the response`);
  assert.doesNotMatch(body, /<div hidden id="S:|<!--\$\?-->|Loading the next scene/, `${path}: no Suspense loading shell may hide the page`);
  assert.match(body, /Explore Cine-verse/, `${path}: navigation must be crawlable`);
  if (path !== '/download') {
    assert.ok((body.match(/href="\/movie\//g) || []).length >= 4, `${path}: catalog links must be in the HTML`);
  }
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.ok(html.includes(`rel="canonical" href="${origin}${path}"`));
  assert.match(html, /<meta name="robots" content="index, follow"/);
  assert.doesNotMatch(body, /style="[^"]*opacity:\s*0(?:[;"\s]|$)/, `${path}: prerendered content must be visible`);

  const title = html.match(/<title>(.*?)<\/title>/)[1];
  assert.ok(!titles.has(title), `${path}: page titles must be unique`);
  titles.add(title);
  const queryState = JSON.parse(html.match(/<script id="cineverse-query-state" type="application\/json">(.*?)<\/script>/s)[1]);
  assert.ok(queryState.queries.every((query) => query.state.status === 'success'));
  const scriptAsset = html.match(/type="module" crossorigin src="\/assets\/([^"]+)"/)[1];
  assert.ok(assetNames.includes(scriptAsset));

  const revision = createHash('md5').update(html).digest('hex');
  assert.ok(sw.includes(revision), `${path}: service worker must cache the finished page`);
  console.log(`PASS ${path}: rendered content, canonical, metadata, catalog state, PWA revision`);
}

for (const path of ['/dashboard', '/watchlist', '/404']) {
  assert.match(await read(`${path.slice(1)}.html`), /<meta name="robots" content="noindex, follow"/);
}
const shell = await read('app.html');
assert.doesNotMatch(shell, /rel="canonical"|property="og:url"/);
assert.match(shell, /<div id="root"><\/div>/);
const offlineState = JSON.parse(shell.match(/<script id="cineverse-query-state" type="application\/json">(.*?)<\/script>/s)[1]);
for (const queryName of ['trendingMovies', 'exploreMedia', 'upcomingMovies', 'globalMedia']) {
  assert.ok(offlineState.queries.some((query) => query.queryKey[0] === queryName));
}
assert.match(sw, /createHandlerBoundToURL\(["']\/app\.html["']\)/);
assert.doesNotMatch(sw, /url:["']404\.html["']/);
const sitemap = await read('sitemap.xml');
assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]), pages.map((path) => `${origin}${path}`));

for (const filename of ['firebase.json', 'firebase.release.json']) {
  const config = JSON.parse(await readFile(resolve(root, filename), 'utf8'));
  for (const hosting of config.hosting.filter((entry) => entry.public === 'dist')) {
    assert.ok(!hosting.rewrites.some((rewrite) => rewrite.source === '**'), `${filename}: unknown routes must return 404`);
    for (const path of pages.slice(1)) {
      assert.ok(hosting.rewrites.some((rewrite) => rewrite.source === path && rewrite.destination === `${path}.html`));
    }
    assert.ok(hosting.rewrites.some((rewrite) => rewrite.source === '/movie/**' && rewrite.destination === '/app.html'));
    for (const privatePath of ['/dashboard', '/watchlist']) {
      assert.ok(hosting.rewrites.some((rewrite) => rewrite.source === privatePath && rewrite.destination === `${privatePath}.html`));
    }
  }
}
console.log('PASS private pages, sitemap, SPA shell, hosting rewrites, real 404 routing');
