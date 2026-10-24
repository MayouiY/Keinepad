// Renders Chrome Web Store images into store/assets/: 1280x800 screenshots per locale,
// plus the 440x280 small promo tile and the 1400x560 marquee.
// Usage: npm run build && npm run store-assets
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright is expected to be available globally (it is not a project dependency).
const { chromium } = createRequire(import.meta.url)('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'store/assets');
const icon = `data:image/png;base64,${readFileSync(join(root, 'public/icons/icon.png')).toString('base64')}`;

// A small demo site with realistic-looking cookies, storage and caches.
const SEED_PAGE = `<!doctype html><title>Demo shop</title><h1>Demo shop</h1><script>
(async () => {
  document.cookie = 'theme=dark; path=/; max-age=2592000';
  document.cookie = 'cart=' + encodeURIComponent(JSON.stringify({ items: [{ sku: 'A-102', qty: 2 }], coupon: 'AUTUMN' })) + '; path=/';
  document.cookie = 'lang=en; path=/; max-age=31536000';
  document.cookie = 'ab_test=checkout_v2; path=/; max-age=604800';
  localStorage.setItem('user', JSON.stringify({ id: 1024, name: 'Keine', plan: 'pro' }));
  localStorage.setItem('feature_flags', JSON.stringify({ newCheckout: true, darkMode: true }));
  sessionStorage.setItem('scrollY', '1280');
  await new Promise((res, rej) => {
    const req = indexedDB.open('shop-db', 2);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore('orders', { keyPath: 'id' });
      for (let i = 1; i <= 12; i++) s.add({ id: i });
      req.result.createObjectStore('drafts', { keyPath: 'id' });
    };
    req.onsuccess = () => { req.result.close(); res(); };
    req.onerror = () => rej(req.error);
  });
  const cache = await caches.open('static-v3');
  for (const p of ['/app.js', '/app.css', '/logo.svg']) await cache.put(p, new Response('x'));
  await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  window.__ready = true;
})().catch((e) => { window.__error = String(e); });
</script>`;

// A signed-looking JWT so the value preview shows the decoder.
const jwt = [
  { alg: 'HS256', typ: 'JWT' },
  { sub: '1024', name: 'Keine', exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 7 },
]
  .map((p) => Buffer.from(JSON.stringify(p)).toString('base64url'))
  .concat('c2lnbmF0dXJl')
  .join('.');

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
      'session_id=8f2c1e9a7b3d; Path=/; HttpOnly; SameSite=Lax',
      `auth_token=${jwt}; Path=/; HttpOnly; Max-Age=604800`,
      'consent=granted; Domain=shop.example.test; Path=/; Max-Age=31536000',
    ],
  });
  res.end(SEED_PAGE);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const SITE = `http://www.shop.example.test:${server.address().port}`;

const COPY = {
  en: {
    font: "'Segoe UI', 'Noto Sans', sans-serif",
    shots: [
      ['All cookies of the site, at a glance', 'HttpOnly and partitioned cookies included. See which ones are sent with the current URL.'],
      ['Edit every cookie attribute', 'Value preview decodes URL encoding, JSON and JWT. Invalid combinations are caught before saving.'],
      ['Storage, IndexedDB, Cache Storage, Service Workers', 'Inspect and remove what the page has stored, without opening DevTools.'],
      ['Clear site data in one click', 'Pick exactly which data types to clear, then reload the page.'],
    ],
    tagline: 'Cookie & cache editor for the current site',
  },
  zh: {
    font: "'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif",
    shots: [
      ['当前站点的 Cookie 一目了然', '包含 HttpOnly 与分区 Cookie，并标出哪些会随当前 URL 发送。'],
      ['编辑 Cookie 的全部属性', '值预览支持 URL 解码、JSON 格式化与 JWT 解码，保存前自动校验。'],
      ['存储、IndexedDB、Cache Storage、Service Worker', '无需打开开发者工具，即可查看并删除页面保存的数据。'],
      ['一键清除站点数据', '自由勾选要清除的数据类型，清除后可强制刷新页面。'],
    ],
    tagline: '当前站点的 Cookie 与缓存编辑器',
  },
  ja: {
    font: "'Noto Sans CJK JP', 'Yu Gothic', sans-serif",
    shots: [
      ['サイトの Cookie をひと目で', 'HttpOnly やパーティション Cookie も表示。現在の URL に送信されるものも分かります。'],
      ['Cookie のすべての属性を編集', 'URL デコード・JSON 整形・JWT デコードに対応。保存前に不正な組み合わせを検出します。'],
      ['ストレージ・IndexedDB・Cache Storage・Service Worker', 'DevTools を開かずに、ページが保存したデータを確認・削除できます。'],
      ['サイトデータをワンクリックで削除', '削除するデータの種類を選んで、そのままページを再読み込みできます。'],
    ],
    tagline: '現在のサイトの Cookie & キャッシュエディタ',
  },
};

const BG = 'linear-gradient(135deg, #1f2a4d 0%, #2d3f73 55%, #2f6b57 100%)';

function frame({ width, height, body }) {
  return `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
  body{background:${BG};color:#fff;display:flex;align-items:center}
  .pixel{image-rendering:pixelated}
  </style>${body}`;
}

function screenshotPage(copy, [title, sub], shot) {
  return frame({
    width: 1280,
    height: 800,
    body: `<div style="font-family:${copy.font};display:flex;align-items:center;gap:56px;padding:0 64px;width:100%">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:36px">
          <img class="pixel" src="${icon}" width="64" height="64">
          <span style="font-size:28px;font-weight:700;letter-spacing:.5px">Keinepad</span>
        </div>
        <div style="font-size:40px;font-weight:700;line-height:1.25">${title}</div>
        <div style="font-size:21px;line-height:1.6;margin-top:22px;opacity:.85">${sub}</div>
      </div>
      <img src="${shot}" style="width:660px;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,.45)">
    </div>`,
  });
}

async function render(browser, html, width, height, path) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  // The store wants images without an alpha channel, so render JPEG rather than RGBA PNG.
  await page.screenshot({ path, type: 'jpeg', quality: 95 });
  await page.close();
}

async function capture(locale) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'keinepad-store-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    locale,
    env: { ...process.env, LANGUAGE: locale.replace('-', '_') },
    deviceScaleFactor: 2,
    args: [
      `--lang=${locale}`,
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      '--host-resolver-rules=MAP *.example.test 127.0.0.1',
      `--unsafely-treat-insecure-origin-as-secure=${SITE}`,
    ],
  });
  try {
    let [sw] = context.serviceWorkers();
    sw ??= await context.waitForEvent('serviceworker');
    const extId = new URL(sw.url()).host;
    const site = await context.newPage();
    await site.goto(`${SITE}/`);
    await site.waitForFunction(() => window.__ready || window.__error);
    const err = await site.evaluate(() => window.__error);
    if (err) throw new Error(err);

    const popup = await context.newPage();
    await popup.setViewportSize({ width: 640, height: 580 });
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    const tabId = await popup.evaluate(async (url) => (await chrome.tabs.query({ url }))[0]?.id, `${SITE}/`);
    await popup.goto(`chrome-extension://${extId}/popup.html?tabId=${tabId}`);
    await popup.waitForSelector('[data-testid="cookie-list"] .row');

    const shots = [];
    const grab = async () => shots.push(`data:image/png;base64,${(await popup.screenshot()).toString('base64')}`);
    await grab();
    await popup.click('.row[data-name="auth_token"]');
    await grab();
    await popup.keyboard.press('Escape');
    await popup.click('[data-testid="tab-siteData"]');
    await popup.waitForSelector('[data-db="shop-db"]');
    await grab();
    await popup.click('[data-testid="open-clear-site"]');
    await grab();
    return shots;
  } finally {
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

const browser = await chromium.launch();
try {
  for (const [locale, tag] of [
    ['en-US', 'en'],
    ['zh-CN', 'zh_CN'],
    ['ja', 'ja'],
  ]) {
    const copy = COPY[tag === 'zh_CN' ? 'zh' : tag];
    const dir = join(out, tag);
    mkdirSync(dir, { recursive: true });
    const shots = await capture(locale);
    for (const [i, shot] of shots.entries()) {
      await render(browser, screenshotPage(copy, copy.shots[i], shot), 1280, 800, join(dir, `screenshot-${i + 1}.jpg`));
    }
    console.log(`  ✓ ${tag}: ${shots.length} screenshots`);
  }

  const en = COPY.en;
  await render(
    browser,
    frame({
      width: 440,
      height: 280,
      body: `<div style="font-family:${en.font};display:flex;align-items:center;gap:18px;padding:0 28px">
        <img class="pixel" src="${icon}" width="150" height="150">
        <div><div style="font-size:34px;font-weight:700">Keinepad</div>
        <div style="font-size:17px;line-height:1.4;margin-top:8px;opacity:.9">Cookie &amp; cache editor</div></div>
      </div>`,
    }),
    440,
    280,
    join(out, 'promo-small-440x280.jpg'),
  );
  await render(
    browser,
    frame({
      width: 1400,
      height: 560,
      body: `<div style="font-family:${en.font};display:flex;align-items:center;gap:56px;padding:0 120px">
        <img class="pixel" src="${icon}" width="360" height="360">
        <div><div style="font-size:84px;font-weight:700">Keinepad</div>
        <div style="font-size:34px;line-height:1.4;margin-top:16px;opacity:.9">${en.tagline}</div></div>
      </div>`,
    }),
    1400,
    560,
    join(out, 'promo-marquee-1400x560.jpg'),
  );
  console.log('  ✓ promo tiles');

  // Edge Add-ons asks for a separate 1:1 store logo (300x300 recommended); a transparent PNG is fine there.
  const logo = await browser.newPage({ viewport: { width: 300, height: 300 } });
  await logo.setContent(
    `<style>html,body{margin:0;background:transparent}img{width:300px;height:300px;display:block;image-rendering:pixelated}</style><img src="${icon}">`,
  );
  await logo.evaluate(() => document.images[0].decode());
  await logo.screenshot({ path: join(out, 'edge-logo-300x300.png'), omitBackground: true });
  await logo.close();
  console.log('  ✓ edge logo');
} finally {
  await browser.close();
  server.close();
}
console.log(`done — images in ${out}`);
