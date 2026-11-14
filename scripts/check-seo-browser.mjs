import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const base = process.argv[2] || process.env.SEO_PREVIEW_URL || 'http://127.0.0.1:5000';
const origin = 'https://ourcineverse.web.app';
const chrome = process.env.CHROME_PATH || (process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome');
const profile = await mkdtemp(resolve(tmpdir(), 'cineverse-seo-chrome-'));
const artifacts = resolve(import.meta.dirname, '../research/seo');
await mkdir(artifacts, { recursive: true });
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--window-size=1440,1000', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const pending = new Map();
const exceptions = [];
const workerErrors = [];
let sequence = 0;

function send(method, params = {}, sessionId) {
  const id = ++sequence;
  return new Promise((resolveCommand, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Browser command timed out: ${method}`));
    }, 30000);
    pending.set(id, { resolve: resolveCommand, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

async function evaluate(session, expression) {
  const result = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true, userGesture: true,
  }, session);
  if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${result.exceptionDetails.text}`);
  return result.result.value;
}

async function waitFor(session, expression, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(session, expression)) return;
    await delay(200);
  }
  throw new Error(`Browser condition timed out: ${expression}`);
}

async function tab({ scripts = true, bypassWorker = true, mobile = false } = {}) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  await send('ServiceWorker.enable', {}, sessionId);
  // Browser QA must not write synthetic visits into production analytics.
  await send('Network.setBlockedURLs', { urls: ['*firebaseio.com*', '*firebasedatabase.app*',
    '*identitytoolkit.googleapis.com*', '*securetoken.googleapis.com*'] }, sessionId);
  await send('Network.setBypassServiceWorker', { bypass: bypassWorker }, sessionId);
  await send('Emulation.setScriptExecutionDisabled', { value: !scripts }, sessionId);
  if (mobile) await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  }, sessionId);
  return { session: sessionId, close: () => send('Target.closeTarget', { targetId }) };
}

async function navigate(session, path) {
  const result = await send('Page.navigate', { url: `${base}${path}` }, session);
  assert.ok(!result.errorText, `${path}: ${result.errorText}`);
  await waitFor(session, 'document.readyState !== "loading" && !!document.querySelector("h1")');
}

async function screenshot(session, filename) {
  const result = await send('Page.captureScreenshot', { format: 'png' }, session);
  await writeFile(resolve(artifacts, filename), Buffer.from(result.data, 'base64'));
}

try {
  console.log(`Checking ${base}`);
  let port;
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      port = (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      break;
    } catch { await delay(100); }
  }
  assert.ok(port, 'Chrome did not start');
  const info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
    if (message.method === 'ServiceWorker.workerErrorReported') {
      workerErrors.push(message.params.errorMessage.errorMessage);
    }
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timeout);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
  });

  for (const path of ['/', '/explore', '/upcoming', '/global', '/download']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, `${path}: HTTP status`);
    const page = await tab({ scripts: false });
    try {
      await navigate(page.session, path);
      const data = await evaluate(page.session, `({
        title: document.title,
        canonical: document.querySelector('link[rel="canonical"]').href,
        heading: document.querySelector('h1').innerText,
        visible: getComputedStyle(document.querySelector('main')).opacity,
        headingVisible: document.querySelector('h1').checkVisibility(),
        titles: document.querySelectorAll('a[href^="/movie/"]').length,
        overflow: document.documentElement.scrollWidth > innerWidth + 1
      })`);
      assert.equal(data.canonical, `${origin}${path}`);
      assert.equal(data.visible, '1');
      assert.equal(data.headingVisible, true, `${path}: heading must be visible without JavaScript`);
      assert.ok(data.heading.length > 1);
      assert.ok(!data.overflow, `${path}: horizontal overflow`);
      if (path !== '/download') assert.ok(data.titles >= 4);
      if (path === '/') await screenshot(page.session, 'home-desktop-nojs.png');
      console.log(`PASS JavaScript disabled ${path}: ${data.heading} (${data.titles} title links)`);
    } finally { await page.close(); }
  }

  const mobile = await tab({ scripts: false, mobile: true });
  await navigate(mobile.session, '/');
  assert.equal(await evaluate(mobile.session, 'document.documentElement.scrollWidth <= innerWidth + 1'), true);
  await screenshot(mobile.session, 'home-mobile-nojs.png');
  await mobile.close();

  for (const path of ['/dashboard', '/watchlist', '/link']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /name="robots" content="noindex, follow"/);
  }
  const missing = await fetch(`${base}/this-page-does-not-exist-seo-check`);
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /name="robots" content="noindex, follow"/);
  const movieShell = await (await fetch(`${base}/movie/533535`)).text();
  assert.doesNotMatch(movieShell, /rel="canonical"/);
  console.log('PASS HTTP routing: private noindex HTML, real 404, separate detail shell');

  const app = await tab({ mobile: true });
  await navigate(app.session, '/');
  await waitFor(app.session, '!document.getElementById("cineverse-query-state")');
  await evaluate(app.session, 'document.querySelector(\'footer nav a[href="/explore"]\').click()');
  await waitFor(app.session, 'document.querySelector("h1")?.innerText === "Explore Movies" && document.querySelectorAll(\'main article a[href^="/movie/"]\').length >= 4');
  const moviePath = await evaluate(app.session, 'document.querySelector(\'main article a[href^="/movie/"]\').getAttribute("href")');
  await evaluate(app.session, 'document.querySelector(\'main article a[href^="/movie/"]\').click()');
  await waitFor(app.session, `document.querySelector('link[rel="canonical"]')?.href === ${JSON.stringify(origin + moviePath)} && document.querySelector('meta[property="og:image"]')?.content.startsWith('https://image.tmdb.org/')`);
  assert.ok(await evaluate(app.session, 'document.querySelector("h1").innerText.length > 1'));
  await evaluate(app.session, 'document.querySelector(\'footer nav a[href="/global"]\').click()');
  await waitFor(app.session, `document.querySelector('link[rel="canonical"]')?.href === '${origin}/global' && document.querySelector('meta[property="og:image"]')?.content === '${origin}/og-image.png'`);
  await evaluate(app.session, 'document.querySelector(\'a[href="/explore?type=tv"]\').click()');
  await waitFor(app.session, 'document.querySelector("h1")?.innerText === "Explore TV Series" && document.querySelectorAll(\'main article a[href^="/tv/"]\').length >= 4');
  assert.equal(await evaluate(app.session, 'document.querySelector(\'link[rel="canonical"]\').href'), `${origin}/explore`);
  await screenshot(app.session, 'explore-tv-mobile.png');
  await evaluate(app.session, 'document.querySelector(\'a[href="/watchlist"]\').click()');
  await waitFor(app.session, 'document.querySelector(\'meta[name="robots"]\')?.content === "noindex, follow"');
  await navigate(app.session, '/dashboard');
  await waitFor(app.session, 'document.body.innerText.toLowerCase().includes("sign in")');
  assert.equal(await evaluate(app.session, 'document.querySelector(\'meta[name="robots"]\').content'), 'noindex, follow');
  await app.close();
  console.log('PASS browser app: navigation, movie metadata, image reset, TV filters, watchlist, dashboard gate');

  const offline = await tab({ bypassWorker: false });
  await navigate(offline.session, '/');
  await waitFor(offline.session, '!document.getElementById("cineverse-query-state")');
  try {
    await waitFor(offline.session, '!!navigator.serviceWorker?.controller');
  } catch (error) {
    console.error('Service worker diagnostics:', JSON.stringify({
      registrations: await evaluate(offline.session, 'navigator.serviceWorker.getRegistrations().then(items => items.map(item => ({ scope: item.scope, active: item.active?.state, installing: item.installing?.state, waiting: item.waiting?.state })))'),
      errors: workerErrors,
    }));
    throw error;
  }
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0,
    downloadThroughput: 0, uploadThroughput: 0 }, offline.session);
  for (const path of ['/explore', '/global', '/']) {
    await navigate(offline.session, path);
    await waitFor(offline.session, `!document.getElementById('cineverse-query-state') && document.querySelectorAll('main a[href^="/movie/"]').length >= 4 && document.querySelector('link[rel="canonical"]')?.href === ${JSON.stringify(origin + path)}`);
  }
  await offline.close();
  console.log('PASS PWA: offline navigation and catalog data for Explore, Global, and Home');
  assert.deepEqual(exceptions, [], 'Browser runtime exceptions');
  assert.deepEqual(workerErrors, [], 'Service worker errors');
  console.log(`PASS no runtime exceptions. Screenshots: ${artifacts}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await send('Browser.close').catch(() => undefined);
    socket.close();
  }
  browser.kill();
}
