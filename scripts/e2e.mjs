// End-to-end check: loads dist/ into Chromium, seeds a test site with cookies and storage,
// drives the side panel UI and verifies the effects inside the page.
// Usage: npm run build && npm run e2e   (screenshots land in .e2e/)
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

// How long the test site takes to deliver the icon of /icon-page.
const ICON_DELAY = 1000;

const server = createServer((req, res) => {
  if (req.url === '/sw.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end("self.addEventListener('fetch', () => {});");
  }
  if (req.url === '/icon-page') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><title>icon</title><link rel="icon" href="/slow-icon.png"><h1>icon</h1>');
  }
  if (req.url === '/slow-icon.png') {
    // Never cached, so every page showing this icon has to wait for it.
    return void setTimeout(() => {
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      res.end(readFileSync(join(dist, 'icons/icon-32.png')));
    }, ICON_DELAY);
  }
  if (req.url === '/gbk') {
    // "中文测试" in GBK, mislabelled as UTF-8 so the page renders garbled until overridden.
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    const h1 = Buffer.from([0xd6, 0xd0, 0xce, 0xc4, 0xb2, 0xe2, 0xca, 0xd4]);
    return res.end(Buffer.concat([Buffer.from('<!doctype html><title>gbk</title><h1>'), h1, Buffer.from('</h1>')]));
  }
  if (req.url === '/data.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end('{"ok":true}');
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

const { version: manifestVersion } = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
let githubLatest = manifestVersion;

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
  // Self-update checks hit the GitHub API; answer them locally so runs are hermetic.
  await context.route('https://api.github.com/**', (route) =>
    route.fulfill({
      json: {
        tag_name: `v${githubLatest}`,
        name: `v${githubLatest}`,
        body: '## What\'s Changed\n* Test change',
        html_url: `https://github.com/MayouiY/Keinepad/releases/tag/v${githubLatest}`,
        published_at: '2026-10-28T00:00:00Z',
        assets: [{ name: `keinepad-${githubLatest}.zip`, browser_download_url: `https://example.invalid/keinepad-${githubLatest}.zip` }],
      },
    }),
  );
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
  // The header icon is only added after the load event; wait for it so screenshots are stable.
  await panel.waitForFunction(() => document.querySelector('img.favicon')?.complete);
  return panel;
}

// Opens the real toolbar popup. Playwright does not expose it as a page, so it is driven over
// the DevTools protocol; `evaluate` runs an expression in it.
async function openToolbarPopup(context) {
  const session = await context.browser().newBrowserCDPSession();
  const [worker] = context.serviceWorkers();
  await worker.evaluate(() => chrome.action.openPopup());
  const { targetInfos } = await session.send('Target.getTargets');
  const target = targetInfos.find((t) => t.type === 'page' && t.url.endsWith('/popup.html'));
  assert.ok(target, 'toolbar popup opened');
  const { sessionId } = await session.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
  const pending = new Map();
  session.on('Target.receivedMessageFromTarget', ({ message }) => {
    const { id, result } = JSON.parse(message);
    pending.get(id)?.(result);
    pending.delete(id);
  });
  const evaluate = (expression) =>
    new Promise((resolve) => {
      const id = pending.size + 1;
      pending.set(id, (result) => resolve(result.result.value));
      const message = { id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } };
      session.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify(message) });
    });
  return { evaluate, close: () => session.detach() };
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

  // Tabs that were not opened yet get their badges from a cheap look at the page; their
  // listings (which can be megabytes of page data) are only fetched when the tab is opened.
  await panel.waitForFunction(() => document.querySelectorAll('.tabs .count').length === 4);
  const badge = (key) => panel.textContent(`[data-testid="tab-${key}"] .count`);
  assert.deepEqual([await badge('localStorage'), await badge('sessionStorage'), await badge('siteData')], ['2', '1', '3']);
  assert.equal(await panel.$('[data-testid="storage-list"]'), null);
  assert.equal(await panel.$('[data-testid="section-idb"]'), null);
  step('counts the contents of unopened tabs without loading them');

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

  // Export: second-level choice between clipboard and file.
  // Capture clipboard writes instead of reading the real clipboard (needs focus and permissions).
  await panel.evaluate(() => {
    navigator.clipboard.writeText = async (text) => void (window.__clipboard = text);
  });
  await panel.click('[data-testid="export"]');
  await panel.screenshot({ path: join(shots, 'export-menu.png') });
  await panel.click('[data-testid="export-clipboard"]');
  await panel.waitForSelector('[data-testid="export-clipboard"]', { state: 'detached' });
  const copiedExport = JSON.parse(await panel.evaluate(() => window.__clipboard));
  assert.ok(copiedExport.cookies.some((c) => c.name === 'theme2'), 'clipboard export contains cookies');
  await panel.click('[data-testid="export"]');
  const [cookieDownload] = await Promise.all([panel.waitForEvent('download'), panel.click('[data-testid="export-file"]')]);
  assert.equal(cookieDownload.suggestedFilename(), 'cookies-app.example.test.json');
  step('exports cookies to clipboard or file');

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

  await panel.click('.panel:not([style*="none"]) [data-testid="export"]');
  await panel.screenshot({ path: join(shots, 'export-menu-storage.png') });
  await panel.click('[data-testid="export-clipboard"]');
  await panel.waitForSelector('[data-testid="export-clipboard"]', { state: 'detached' });
  assert.deepEqual(JSON.parse(await panel.evaluate(() => window.__clipboard)), { token: 'xyz' });
  await panel.click('.panel:not([style*="none"]) [data-testid="export"]');
  const [storageDownload] = await Promise.all([panel.waitForEvent('download'), panel.click('[data-testid="export-file"]')]);
  assert.equal(storageDownload.suggestedFilename(), 'localStorage-app.example.test.json');
  step('exports localStorage to clipboard or file');

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

  // Without ?tabId the side panel shows the active tab of its window and follows tab switches.
  const follower = await context.newPage();
  await follower.goto(`chrome-extension://${extId}/sidepanel.html`);
  await follower.waitForSelector('.unsupported'); // its own tab, an extension page, is active
  await site.bringToFront();
  await follower.waitForSelector('[data-testid="cookie-list"] .row');
  assert.equal(await follower.textContent('[data-testid="site-host"]'), 'app.example.test');
  step('side panel follows the active tab');
  await follower.close();

  // The browser only shows the toolbar popup (and the side panel) once its document has loaded,
  // so the load event must not wait for the site's icon, however slowly that arrives.
  const iconSite = await context.newPage();
  await iconSite.goto(`${SITE}/icon-page`);
  const iconTabId = await panel.evaluate(async (url) => {
    for (;;) {
      const [tab] = await chrome.tabs.query({ url });
      if (tab?.favIconUrl) return tab.id;
      await new Promise((r) => setTimeout(r, 100));
    }
  }, `${SITE}/icon-page`);
  const iconPopup = await context.newPage();
  await iconPopup.goto(`chrome-extension://${extId}/popup.html?tabId=${iconTabId}`);
  const loadedAfter = await iconPopup.evaluate(() => performance.getEntriesByType('navigation')[0].loadEventEnd);
  assert.ok(loadedAfter < ICON_DELAY / 2, `popup load waited for the site icon (${Math.round(loadedAfter)} ms)`);
  await iconPopup.waitForFunction((src) => {
    const img = document.querySelector('img.favicon');
    return img?.src === src && img.complete && img.naturalWidth > 0;
  }, `${SITE}/slow-icon.png`);
  step('does not wait for the site icon before showing up');
  await Promise.all([iconSite.close(), iconPopup.close()]);

  // A popup that cannot have its full 640×580 (short screen, high page zoom) fills the room it
  // gets, so that its lists scroll instead of the page. Below a minimum the page scrolls instead.
  const small = await openPanel(context, extId, `${SITE}/`, 'popup.html', { width: 520, height: 420 });
  const layout = () =>
    small.evaluate(() => ({
      body: [document.body.offsetWidth, document.body.offsetHeight],
      page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    }));
  assert.deepEqual(await layout(), { body: [520, 420], page: [520, 420] });
  await small.setViewportSize({ width: 300, height: 200 });
  assert.deepEqual(await layout(), { body: [640, 580], page: [640, 580] });
  await small.close();
  // The real toolbar popup is sized by the browser from its content: it must settle on one
  // size, without growing for page scrollbars, and nothing may be left to scroll. (The window
  // is made wide first: a popup cannot be wider than the screen left of its toolbar button.)
  await site.setViewportSize({ width: 1000, height: 700 });
  await site.bringToFront();
  const toolbarPopup = await openToolbarPopup(context);
  const shown = JSON.parse(
    await toolbarPopup.evaluate(`new Promise((resolve) => {
      const sizes = new Set();
      const sample = () => sizes.add(innerWidth + 'x' + innerHeight);
      const timer = setInterval(sample, 20);
      setTimeout(() => {
        clearInterval(timer);
        sample();
        const page = document.documentElement;
        resolve(JSON.stringify({ sizes: [...sizes], width: innerWidth, height: innerHeight, pageWidth: page.scrollWidth, pageHeight: page.scrollHeight }));
      }, 400);
    })`),
  );
  assert.equal(shown.sizes.length, 1, `toolbar popup keeps changing size: ${shown.sizes.join(', ')}`);
  assert.equal(shown.width, 640);
  assert.deepEqual([shown.pageWidth, shown.pageHeight], [shown.width, shown.height]);
  await toolbarPopup.evaluate('window.close()');
  await toolbarPopup.close();
  step(`fits the popup into the room it gets (toolbar popup: ${shown.sizes[0]})`);

  // Page encoding override: re-decode a mislabelled GBK page, then restore auto-detection.
  const gbk = await context.newPage();
  await gbk.goto(`${SITE}/gbk`);
  assert.notEqual(await gbk.textContent('h1'), '中文测试');
  const encPanel = await openPanel(context, extId, `${SITE}/gbk`);
  assert.match(await encPanel.textContent('[data-testid="encoding-select"] option[value=""]'), /UTF-8/);
  await Promise.all([gbk.waitForEvent('load'), encPanel.selectOption('[data-testid="encoding-select"]', 'GBK')]);
  assert.equal(await gbk.textContent('h1'), '中文测试');
  assert.equal(await gbk.evaluate(() => document.characterSet), 'GBK');
  await encPanel.waitForFunction(() => /GBK/.test(document.querySelector('[data-testid="encoding-select"] option[value=""]')?.textContent ?? ''));
  assert.equal(await encPanel.inputValue('[data-testid="encoding-select"]'), 'GBK');
  // Non-text documents on the same host in the same tab keep their own Content-Type.
  await gbk.goto(`${SITE}/data.json`);
  assert.equal(await gbk.evaluate(() => document.contentType), 'application/json');
  await gbk.goto(`${SITE}/gbk`);
  assert.equal(await gbk.textContent('h1'), '中文测试');
  step('overrides the page encoding and keeps it while browsing the site');
  await encPanel.screenshot({ path: join(shots, 'encoding-en.png') });
  await Promise.all([gbk.waitForEvent('load'), encPanel.selectOption('[data-testid="encoding-select"]', '')]);
  assert.notEqual(await gbk.textContent('h1'), '中文测试');
  assert.equal(await gbk.evaluate(() => document.characterSet), 'UTF-8');
  const rulesLeft = await encPanel.evaluate(() => chrome.declarativeNetRequest.getSessionRules());
  assert.equal(rulesLeft.length, 0);
  step('restores auto-detected encoding');
  await Promise.all([gbk.waitForEvent('load'), encPanel.selectOption('[data-testid="encoding-select"]', 'Big5')]);
  await gbk.close();
  await encPanel.waitForFunction(async () => (await chrome.declarativeNetRequest.getSessionRules()).length === 0);
  step('drops the override when the tab closes');
  // The right-click menu items exist (update() rejects unknown ids).
  const [bg] = context.serviceWorkers();
  await bg.evaluate(() => Promise.all(['encoding', 'encoding:auto', 'encoding:GBK', 'encoding-more', 'encoding:KOI8-R'].map((id) => chrome.contextMenus.update(id, {}))));
  step('registers the page encoding context menu');
  await encPanel.close();

  // Self-update: a newer GitHub release shows a banner and badge until skipped.
  const resetUpdateCheck = (page) =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('keinepad', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('kv');
          req.onsuccess = () => {
            const tx = req.result.transaction('kv', 'readwrite');
            tx.objectStore('kv').delete('update.state');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        }),
    );
  assert.equal(await panel.$('[data-testid="update-banner"]'), null);
  githubLatest = '99.0.0';
  await resetUpdateCheck(panel);
  await panel.reload();
  await panel.waitForSelector('[data-testid="update-banner"]');
  assert.match(await panel.textContent('[data-testid="update-banner"]'), /99\.0\.0/);
  assert.equal(await panel.evaluate(() => chrome.action.getBadgeText({})), 'NEW');
  step('notifies about a newer GitHub release');
  await panel.click('[data-testid="update-banner"] .btn:first-of-type');
  assert.match(await panel.textContent('.modal-body'), /Test change/);
  await panel.screenshot({ path: join(shots, 'update-en.png') });
  await panel.click('.modal-footer .btn:first-child');
  await panel.waitForSelector('[data-testid="update-banner"]', { state: 'detached' });
  assert.equal(await panel.evaluate(() => chrome.action.getBadgeText({})), '');
  await panel.reload();
  await panel.waitForSelector('[data-testid="cookie-list"] .row');
  assert.equal(await panel.$('[data-testid="update-banner"]'), null);
  step('skips a dismissed version');
  await bg.evaluate(() => Promise.all(['update:check', 'update:auto'].map((id) => chrome.contextMenus.update(id, {}))));
  step('registers the update menu on the toolbar icon');
  githubLatest = manifestVersion;

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
