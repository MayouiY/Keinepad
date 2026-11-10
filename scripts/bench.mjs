// Load-time benchmark: opens the popup (or side panel) page of dist/ over and over against a
// seeded test site and reports how long it takes until the browser could show it and until it
// has its data. With --compare, a second build is loaded into the same browser and the two take
// turns, so machine noise hits both alike.
// Usage: npm run build && npm run bench -- [--profile=light|typical|heavy] [--runs=20]
//          [--file=popup.html|sidepanel.html] [--tab=cookies|localStorage|sessionStorage|siteData]
//          [--icon-delay=<ms>] [--compare=<other build directory>]
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright is expected to be available globally (it is not a project dependency).
const { chromium } = createRequire(import.meta.url)('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const option = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const profile = option('profile', 'typical');
const runs = Number(option('runs', '20'));
const file = option('file', 'popup.html');
const tab = option('tab', 'cookies');
const iconDelay = Number(option('icon-delay', '0'));
const compare = option('compare', '');
const builds = [{ name: 'dist', dir: join(root, 'dist') }];
if (compare) builds.unshift({ name: 'compare', dir: resolve(compare) });

// What the inspected page holds: a small static site, a typical web app, a big PWA.
const PROFILES = {
  light: { cookies: 6, local: 4, bigValues: 0, session: 2, dbs: 0, stores: 0, records: 0, caches: 0, entries: 0 },
  typical: { cookies: 25, local: 30, bigValues: 2, session: 8, dbs: 2, stores: 3, records: 200, caches: 2, entries: 60 },
  heavy: { cookies: 80, local: 300, bigValues: 8, session: 60, dbs: 6, stores: 5, records: 2000, caches: 4, entries: 800 },
};
const P = PROFILES[profile];
if (!P) throw new Error(`Unknown profile "${profile}"`);

const SEED_PAGE = `<!doctype html><title>Keinepad bench site</title><link rel="icon" href="/icon.png"><h1>bench</h1><script>
(async () => {
  const P = ${JSON.stringify(P)};
  const text = (n) => { let s = ''; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); };
  for (let i = 0; i < P.cookies; i++) {
    const value = i % 5 ? text(20 + (i * 37) % 400) : encodeURIComponent(JSON.stringify({ id: i, token: text(300) }));
    document.cookie = 'cookie_' + i + '=' + value + '; path=/; max-age=' + 3600 * (i + 1);
  }
  localStorage.clear();
  sessionStorage.clear();
  for (let i = 0; i < P.local; i++) localStorage.setItem('key_' + i, i % 3 ? text(30 + (i * 17) % 300) : JSON.stringify({ i, data: text(200 + (i * 53) % 1500) }));
  for (let i = 0; i < P.bigValues; i++) localStorage.setItem('big_' + i, JSON.stringify({ blob: text(200000) }));
  for (let i = 0; i < P.session; i++) sessionStorage.setItem('key_' + i, text(50 + (i * 29) % 800));
  for (let d = 0; d < P.dbs; d++) {
    await new Promise((res, rej) => {
      const req = indexedDB.open('db_' + d, 1);
      req.onupgradeneeded = () => {
        for (let s = 0; s < P.stores; s++) {
          const store = req.result.createObjectStore('store_' + s, { keyPath: 'id' });
          for (let r = 0; r < P.records; r++) store.add({ id: r });
        }
      };
      req.onsuccess = () => { req.result.close(); res(); };
      req.onerror = () => rej(req.error);
    });
  }
  for (let c = 0; c < P.caches; c++) {
    const cache = await caches.open('cache_' + c);
    await Promise.all(Array.from({ length: P.entries }, (_, e) => cache.put('/asset/' + c + '/' + e + '.js', new Response('x'))));
  }
  if (P.caches) {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  }
  window.__ready = true;
})().catch((e) => { window.__error = String(e); });
</script>`;

const icon = readFileSync(join(builds[0].dir, 'icons/icon-32.png'));
// Many cookies make for long request headers.
const server = createServer({ maxHeaderSize: 1 << 20 }, (req, res) => {
  if (req.url === '/sw.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end("self.addEventListener('fetch', () => {});");
  }
  if (req.url === '/icon.png') {
    // With --icon-delay the icon is slow and uncacheable, like a site icon seen for the first time.
    const send = () => {
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': iconDelay ? 'no-store' : 'max-age=86400' });
      res.end(icon);
    };
    return void (iconDelay ? setTimeout(send, iconDelay) : send());
  }
  const setCookie = Array.from({ length: Math.min(10, P.cookies) }, (_, i) => `server_${i}=v${i}; Path=/; HttpOnly; Max-Age=86400`);
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'set-cookie': setCookie });
  res.end(SEED_PAGE);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const SITE = `http://app.example.test:${server.address().port}`;

const userDataDir = mkdtempSync(join(tmpdir(), 'keinepad-bench-'));
const dirs = builds.map((b) => b.dir).join(',');
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  args: [
    `--disable-extensions-except=${dirs}`,
    `--load-extension=${dirs}`,
    '--host-resolver-rules=MAP *.example.test 127.0.0.1',
    // Service workers and Cache Storage need a secure context.
    `--unsafely-treat-insecure-origin-as-secure=${SITE}`,
  ],
});
try {
  // Keep the self-update check off the network.
  await context.route('https://api.github.com/**', (route) => route.fulfill({ status: 404 }));
  for (let i = 0; i < 100 && context.serviceWorkers().length < builds.length; i++) await new Promise((r) => setTimeout(r, 100));
  // Tell the loaded extensions apart by the popup.html they serve.
  const workers = [...context.serviceWorkers()];
  for (const build of builds) {
    const html = readFileSync(join(build.dir, 'popup.html'), 'utf8');
    for (const worker of workers) {
      if ((await worker.evaluate(async () => (await fetch('/popup.html')).text())) !== html) continue;
      build.id = new URL(worker.url()).host;
      workers.splice(workers.indexOf(worker), 1);
      break;
    }
    if (!build.id) throw new Error(`The extension in ${build.dir} did not load`);
  }

  const site = await context.newPage();
  await site.goto(`${SITE}/`);
  await site.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 });
  const seedError = await site.evaluate(() => window.__error);
  if (seedError) throw new Error(`Seeding the test site failed: ${seedError}`);
  await site.waitForTimeout(iconDelay + 500); // let the tab pick up its icon

  const page = await context.newPage();
  await page.setViewportSize(file === 'popup.html' ? { width: 640, height: 580 } : { width: 400, height: 760 });
  let tabId;
  for (const build of builds) {
    await page.goto(`chrome-extension://${build.id}/${file}`);
    tabId = await page.evaluate(async (url) => (await chrome.tabs.query({ url }))[0]?.id, `${SITE}/`);
    // The selected tab is remembered per extension.
    await page.evaluate((key) => localStorage.setItem('keinepad.activeTab', key), tab);
  }

  // Notes when the interesting parts of the UI first show up.
  await page.addInitScript((active) => {
    const marks = (window.__marks = {});
    const checks = {
      content: () => {
        const panel = [...document.querySelectorAll('.content > .panel')].find((p) => p.style.display !== 'none');
        return !!panel?.querySelector(active === 'siteData' ? '[data-testid="section-idb"]' : '.rows .row');
      },
      counts: () => document.querySelectorAll('.tabs .tab .count').length === 4,
    };
    new MutationObserver(() => {
      for (const [name, check] of Object.entries(checks)) {
        if (marks[name] === undefined && check()) marks[name] = performance.now();
      }
    }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
  }, tab);

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const busyTime = async () => (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration').value * 1000;

  const samples = new Map(builds.map((b) => [b, []]));
  const WARM_UP = 2;
  for (let i = 0; i < runs + WARM_UP; i++) {
    for (const build of i % 2 ? builds : [...builds].reverse()) {
      await page.goto('about:blank');
      const busyBefore = await busyTime();
      // Nothing is evaluated in the page while it loads, so the measurement is not disturbed.
      await page.goto(`chrome-extension://${build.id}/${file}?tabId=${tabId}`, { waitUntil: 'commit' });
      let result;
      for (let waited = 0; !result; waited += 250) {
        await new Promise((r) => setTimeout(r, 250));
        const seen = await page.evaluate(() => ({
          ...window.__marks,
          load: performance.getEntriesByType('navigation')[0].loadEventEnd,
        }));
        if (seen.load > 0 && seen.content !== undefined && seen.counts !== undefined) result = seen;
        else if (waited > 60000) throw new Error(`${file} did not finish loading`);
      }
      if (i >= WARM_UP) samples.get(build).push({ ...result, busy: (await busyTime()) - busyBefore });
    }
  }

  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const columns = [
    ['load', 'shown'], // the browser shows the popup / side panel once its load event has fired
    ['content', 'data'], // the selected tab has its rows
    ['counts', 'badges'], // every tab has its count
    ['busy', 'busy'], // main-thread time spent
  ];
  console.log(`${file}, ${profile} site, ${tab} tab, ${runs} runs${iconDelay ? `, site icon takes ${iconDelay} ms` : ''} — medians in ms`);
  console.log(`${''.padEnd(10)}${columns.map(([, title]) => title.padStart(9)).join('')}`);
  for (const build of builds) {
    const row = columns.map(([key]) => median(samples.get(build).map((s) => s[key])).toFixed(1).padStart(9));
    console.log(`${build.name.padEnd(10)}${row.join('')}`);
  }
} finally {
  await context.close();
  rmSync(userDataDir, { recursive: true, force: true });
  server.close();
}
