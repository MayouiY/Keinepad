// End-to-end check: loads dist/ into Chromium, seeds a test site with cookies and storage,
// drives the side panel UI and verifies the effects inside the page.
// Usage: npm run build && npm run e2e   (screenshots land in .e2e/)
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

// Playwright is expected to be available globally (it is not a project dependency).
const { chromium } = createRequire(import.meta.url)('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const shots = join(root, '.e2e');
mkdirSync(shots, { recursive: true });

const SEED_PAGE = `<!doctype html><title>Keinepad test site</title><h1>test</h1><script>
(async () => {
  document.cookie = 'theme=light; path=/; max-age=3600';
  document.cookie = 'json=' + encodeURIComponent(JSON.stringify({ a: 1, b: [2, 3] })) + '; path=/';
  localStorage.setItem('token', 'abc');
  localStorage.setItem('settings', JSON.stringify({ dark: true }));
  sessionStorage.setItem('tabState', '42');
  await new Promise((res, rej) => {
    const req = indexedDB.open('app-db', 3);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore('todos', { keyPath: 'id' });
      s.add({ id: 1 }); s.add({ id: 2 });
    };
    req.onsuccess = () => { req.result.close(); res(); };
    req.onerror = () => rej(req.error);
  });
  const cache = await caches.open('static-v1');
  await cache.put('/a.js', new Response('a'));
  await cache.put('/b.css', new Response('b'));
  await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  window.__ready = true;
})().catch((e) => { window.__error = String(e); });
</script>`;

const server = createServer((req, res) => {
  if (req.url === '/sw.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end("self.addEventListener('fetch', () => {});");
  }
  if (req.url === '/favicon.ico') {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'set-cookie': [
      'sid=server-session; Path=/; HttpOnly; SameSite=Lax',
      'wide=1; Domain=example.test; Path=/; Max-Age=86400',
      'deep=1; Path=/other; Max-Age=86400',
    ],
  });
  res.end(SEED_PAGE);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const SITE = `http://app.example.test:${port}`;

async function launch(locale) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'keinepad-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    locale,
    // chrome.i18n follows the browser UI language, which on Linux comes from LANGUAGE.
    env: { ...process.env, LANGUAGE: locale.replace('-', '_') },
    args: [
      `--lang=${locale}`,
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      '--host-resolver-rules=MAP *.example.test 127.0.0.1',
      // Service workers and Cache Storage need a secure context.
      `--unsafely-treat-insecure-origin-as-secure=${SITE}`,
    ],
  });
  let [sw] = context.serviceWorkers();
  sw ??= await context.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  return { context, extId, cleanup: () => context.close().then(() => rmSync(userDataDir, { recursive: true, force: true })) };
}

async function openSite(context) {
  const site = await context.newPage();
  await site.goto(`${SITE}/`);
  await site.waitForFunction(() => window.__ready || window.__error);
  assert.equal(await site.evaluate(() => window.__error), undefined);
  return site;
}

async function openPanel(context, extId, tabUrl, file = 'sidepanel.html', viewport = { width: 400, height: 760 }) {
  const panel = await context.newPage();
  await panel.setViewportSize(viewport);
  await panel.goto(`chrome-extension://${extId}/${file}`);
  const tabId = await panel.evaluate(async (url) => (await chrome.tabs.query({ url }))[0]?.id, tabUrl);
  assert.ok(tabId, 'test tab found');
  await panel.goto(`chrome-extension://${extId}/${file}?tabId=${tabId}`);
  await panel.waitForSelector('[data-testid="cookie-list"] .row');
  return panel;
}

const step = (name) => console.log(`  ✓ ${name}`);
const pageCookies = (site) => site.evaluate(() => document.cookie);
const confirmOk = (panel) => panel.click('[data-testid="confirm-ok"]');

// ---------------------------------------------------------------------------------------
const { context, extId, cleanup } = await launch('en-US');
try {
  console.log('functional checks (en-US)');
  const site = await openSite(context);
  const panel = await openPanel(context, extId, `${SITE}/`);

  // Cookies: listing, sent-to-page detection and site root widening.
  const names = await panel.$$eval('[data-testid="cookie-list"] .row', (rows) => rows.map((r) => r.dataset.name));
  for (const n of ['sid', 'theme', 'json', 'wide', 'deep']) assert.ok(names.includes(n), `cookie ${n} listed`);
  assert.ok(await panel.$('.row.dim[data-name="deep"]'), 'path-restricted cookie marked as not sent');
  assert.match(await panel.textContent('.site-origin'), /\*\.example\.test/);
  step('lists cookies incl. HttpOnly, parent-domain and other-path cookies');

  // Edit value.
  await panel.click('.row[data-name="theme"]');
  await panel.fill('[data-testid="cookie-editor"] textarea[name="value"]', 'dark');
  await panel.click('[data-testid="cookie-save"]');
  await panel.waitForSelector('[data-testid="cookie-editor"]', { state: 'detached' });
  assert.match(await pageCookies(site), /theme=dark/);
  step('edits cookie value');

  // JSON preview of an URL-encoded value.
  await panel.click('.row[data-name="json"]');
  assert.match(await panel.textContent('.value-preview'), /"b": \[/);
  await panel.keyboard.press('Escape');
  step('previews URL-encoded JSON values');

  // Rename (identity change → remove + set).
  await panel.click('.row[data-name="theme"]');
  await panel.fill('[data-testid="cookie-editor"] input[name="name"]', 'theme2');
  await panel.click('[data-testid="cookie-save"]');
  await panel.waitForSelector('.row[data-name="theme2"]');
  assert.doesNotMatch(await pageCookies(site), /(^|; )theme=/);
  assert.match(await pageCookies(site), /theme2=dark/);
  step('renames cookie');

  // Validation.
  await panel.click('[data-testid="cookie-add"]');
  await panel.fill('[data-testid="cookie-editor"] input[name="name"]', 'bad name');
  await panel.click('[data-testid="cookie-save"]');
  await panel.waitForSelector('[data-testid="cookie-errors"]');
  // Add a domain cookie.
  await panel.fill('[data-testid="cookie-editor"] input[name="name"]', 'added');
  await panel.fill('[data-testid="cookie-editor"] textarea[name="value"]', 'v1');
  await panel.fill('[data-testid="cookie-editor"] input[name="domain"]', 'example.test');
  await panel.uncheck('[data-testid="cookie-editor"] input[name="hostOnly"]');
  await panel.click('[data-testid="cookie-save"]');
  await panel.waitForSelector('.row[data-name="added"]');
  assert.match(await pageCookies(site), /added=v1/);
  const added = await panel.evaluate(() => chrome.cookies.getAll({ name: 'added' }));
  assert.equal(added[0].domain, '.example.test');
  step('validates and adds a domain cookie');

  // Delete single cookie.
  await panel.hover('.row[data-name="added"]');
  await panel.click('.row[data-name="added"] .icon-btn.danger');
  await panel.waitForSelector('.row[data-name="added"]', { state: 'detached' });
  assert.doesNotMatch(await pageCookies(site), /added=/);
  step('deletes a cookie');

  // localStorage.
  await panel.click('[data-testid="tab-localStorage"]');
  await panel.waitForSelector('[data-testid="storage-list"] .row[data-key="token"]');
  await panel.click('.row[data-key="token"]');
  await panel.fill('.modal textarea[name="value"]', 'xyz');
  await panel.click('[data-testid="storage-save"]');
  await panel.waitForSelector('.modal', { state: 'detached' });
  assert.equal(await site.evaluate(() => localStorage.getItem('token')), 'xyz');
  await panel.hover('.row[data-key="settings"]');
  await panel.click('.row[data-key="settings"] .icon-btn.danger');
  await panel.waitForSelector('.row[data-key="settings"]', { state: 'detached' });
  assert.equal(await site.evaluate(() => localStorage.getItem('settings')), null);
  step('edits and deletes localStorage items');

  // sessionStorage.
  await panel.click('[data-testid="tab-sessionStorage"]');
  await panel.waitForSelector('.panel:not([style*="none"]) .row[data-key="tabState"]');
  step('lists sessionStorage items');

  // Site data.
  await panel.click('[data-testid="tab-siteData"]');
  await panel.waitForSelector('[data-db="app-db"]');
  assert.match(await panel.textContent('[data-db="app-db"]'), /todos · 2 records/);
  assert.match(await panel.textContent('[data-cache="static-v1"]'), /2 entries/);
  await panel.waitForSelector('[data-testid="section-sw"] .row');
  step('inspects IndexedDB, Cache Storage and service workers');

  await panel.click('[data-cache="static-v1"] .disclosure');
  await panel.click('[data-cache="static-v1"] .sub-row .icon-btn.danger');
  await panel.waitForFunction(() => /1 entries/.test(document.querySelector('[data-cache="static-v1"]')?.textContent ?? ''));
  await panel.click('[data-cache="static-v1"] .row-line .icon-btn.danger');
  await confirmOk(panel);
  await panel.waitForSelector('[data-cache="static-v1"]', { state: 'detached' });
  assert.deepEqual(await site.evaluate(() => caches.keys()), []);
  step('deletes cache entries and caches');

  await panel.click('[data-db="app-db"] .icon-btn.danger');
  await confirmOk(panel);
  await panel.waitForSelector('[data-db="app-db"]', { state: 'detached' });
  assert.deepEqual(await site.evaluate(async () => (await indexedDB.databases()).map((d) => d.name)), []);
  step('deletes IndexedDB database');

  await panel.click('[data-testid="section-sw"] .row .btn-danger-ghost');
  await confirmOk(panel);
  await panel.waitForSelector('[data-testid="section-sw"] .row', { state: 'detached' });
  assert.equal(await site.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
  step('unregisters service worker');

  await panel.click('[data-testid="clear-http-cache"]');
  await panel.waitForSelector('.toast');
  step('clears HTTP cache');

  // One-click clear of everything, after re-seeding.
  await site.reload();
  await site.waitForFunction(() => window.__ready || window.__error);
  await panel.click('[data-testid="open-clear-site"]');
  await panel.uncheck('[data-testid="clear-options"] ~ .reload-option input');
  await panel.click('[data-testid="clear-site-confirm"]');
  await panel.waitForSelector('.modal', { state: 'detached' });
  const after = await site.evaluate(async () => ({
    cookies: document.cookie,
    local: localStorage.length,
    session: sessionStorage.length,
    dbs: (await indexedDB.databases()).length,
    caches: (await caches.keys()).length,
    sws: (await navigator.serviceWorker.getRegistrations()).length,
  }));
  const remaining = await panel.evaluate(() => chrome.cookies.getAll({ domain: 'example.test' }));
  assert.deepEqual(after, { cookies: '', local: 0, session: 0, dbs: 0, caches: 0, sws: 0 });
  assert.equal(remaining.length, 0);
  step('one-click clears all site data');

  await site.reload();
  await site.waitForFunction(() => window.__ready || window.__error);
  await panel.reload();
  // The last selected tab is remembered across reloads.
  await panel.waitForSelector('[data-testid="tab-siteData"].active');
  await panel.click('[data-testid="tab-cookies"]');
  await panel.waitForSelector('[data-testid="cookie-list"] .row');
  step('remembers the selected tab');

  // Restricted page handling.
  const blank = await context.newPage();
  await blank.goto('chrome://version');
  const restricted = await context.newPage();
  await restricted.goto(`chrome-extension://${extId}/popup.html`);
  const blankId = await restricted.evaluate(async () => (await chrome.tabs.query({ url: 'chrome://version/' }))[0]?.id);
  await restricted.goto(`chrome-extension://${extId}/popup.html?tabId=${blankId}`);
  await restricted.waitForSelector('.unsupported');
  step('shows a notice on restricted pages');
  await Promise.all([blank.close(), restricted.close()]);

  await panel.screenshot({ path: join(shots, 'sidepanel-en.png') });
  await site.bringToFront();
} finally {
  await cleanup();
}

// ---------------------------------------------------------------------------------------
console.log('localized screenshots');
for (const [locale, tag] of [
  ['en-US', 'en'],
  ['zh-CN', 'zh'],
  ['ja', 'ja'],
]) {
  const { context, extId, cleanup } = await launch(locale);
  try {
    await openSite(context);
    const popup = await openPanel(context, extId, `${SITE}/`, 'popup.html', { width: 640, height: 580 });
    await popup.screenshot({ path: join(shots, `popup-${tag}.png`) });
    await popup.click('.row[data-name="json"]');
    await popup.screenshot({ path: join(shots, `editor-${tag}.png`) });
    await popup.keyboard.press('Escape');
    await popup.click('[data-testid="tab-siteData"]');
    await popup.waitForSelector('[data-db="app-db"]');
    await popup.screenshot({ path: join(shots, `sitedata-${tag}.png`) });
    await popup.click('[data-testid="open-clear-site"]');
    await popup.screenshot({ path: join(shots, `clear-${tag}.png`) });
    const title = await popup.textContent('.modal-header h2');
    console.log(`  ✓ ${locale}: "${title}"`);
  } finally {
    await cleanup();
  }
}

server.close();
console.log(`done — screenshots in ${shots}`);
