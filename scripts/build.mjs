import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { writeTitlePreviews } from './title-previews.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');

const escapeHTML = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

// TMDB descriptions are untrusted text inside a JSON script element.
const queryStateTag = (state) => '<script id="cineverse-query-state" type="application/json">'
  + JSON.stringify(state).replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  + '</script>';

function withMetadata(template, seo) {
  const values = {
    'name="description"': seo.description,
    'property="og:title"': seo.title,
    'property="og:description"': seo.description,
    'property="og:image"': seo.image,
    'property="og:url"': seo.canonical,
    'name="twitter:title"': seo.title,
    'name="twitter:description"': seo.description,
    'name="twitter:image"': seo.image,
  };
  let html = template.replace(/<title>.*?<\/title>/s, () => `<title>${escapeHTML(seo.title)}</title>`);
  for (const [attribute, value] of Object.entries(values)) {
    html = html.replace(new RegExp(`<meta ${attribute} content="[^"]*"\\s*/?>`),
      () => `<meta ${attribute} content="${escapeHTML(value)}" />`);
  }
  return html.replace('</head>', `    <link rel="canonical" href="${escapeHTML(seo.canonical)}" />\n    <meta name="robots" content="${seo.robots}" />\n  </head>`);
}

async function main() {
  await build({ root, build: { ssr: 'src/entry-prerender.tsx', outDir: '.prerender', emptyOutDir: true } });
  const { renderPage, getPageSEO, PUBLIC_PATHS, SITE_ORIGIN } = await import(
    pathToFileURL(resolve(root, '.prerender/entry-prerender.js')).href
  );

  await build({
    root,
    plugins: [{
      name: 'cineverse-prerender',
      // Run before vite-plugin-pwa generates the precache, so it hashes the
      // finished HTML instead of the original empty app shell.
      closeBundle: {
        order: 'pre',
        sequential: true,
        async handler() {
          const template = await readFile(resolve(dist, 'index.html'), 'utf8');
          // Unlisted movie/TV URLs must not inherit the homepage canonical or
          // its HTML. Their metadata and data load normally in the browser.
          const shell = template.replace(/\s*<meta property="og:url"[^>]*\/>/, '');
          const catalogQueries = new Map();

          for (const path of PUBLIC_PATHS) {
            const page = await renderPage(path);
            if (!page.html.includes('<h1') || (path !== '/download' && !page.html.includes('/movie/'))) {
              throw new Error(`Prerendered ${path} is missing its heading or catalog links.`);
            }
            for (const query of page.queryState.queries) catalogQueries.set(query.queryHash, query);
            const html = withMetadata(template, page.seo)
              .replace('<div id="root"></div>', () => `<div id="root">${page.html}</div>\n    ${queryStateTag(page.queryState)}`);
            const filename = path === '/' ? 'index.html' : `${path.slice(1)}.html`;
            await writeFile(resolve(dist, filename), html);
            console.log(`Prerendered ${path}: ${Buffer.byteLength(html).toLocaleString()} bytes`);
          }

          await writeTitlePreviews({ template, queries: [...catalogQueries.values()], dist, origin: SITE_ORIGIN });

          // The PWA's generic navigation shell keeps the public catalog data
          // available offline without showing the homepage at unrelated URLs.
          await writeFile(resolve(dist, 'app.html'), shell.replace('</body>',
            () => `  ${queryStateTag({ mutations: [], queries: [...catalogQueries.values()] })}\n  </body>`));

          for (const [path, title] of [['/watchlist', 'My Watchlist'], ['/dashboard', 'Private analytics']]) {
            await writeFile(resolve(dist, `${path.slice(1)}.html`),
              withMetadata(shell, getPageSEO({ title, noindex: true }, path)));
          }
          const notFound = withMetadata(shell, getPageSEO({ title: 'Page Not Found', noindex: true }, '/404'))
            .replace('<div id="root"></div>', '<div id="root"><main><h1>Page Not Found</h1><p>This page does not exist. <a href="/">Return to Cine-verse</a>.</p></main></div>');
          await writeFile(resolve(dist, '404.html'), notFound);

          const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
            + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + PUBLIC_PATHS.map((path) => `  <url><loc>${SITE_ORIGIN}${path}</loc></url>`).join('\n')
            + '\n</urlset>\n';
          await writeFile(resolve(dist, 'sitemap.xml'), sitemap);
        },
      },
    }],
  });
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Production build failed.');
  process.exitCode = 1;
}
