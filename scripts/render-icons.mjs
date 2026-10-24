// Renders public/icons/icon.svg to the PNG sizes referenced by manifest.json.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Playwright is expected to be available globally (it is not a project dependency).
const { chromium } = createRequire(import.meta.url)('playwright');

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
const svg = readFileSync(resolve(dir, 'icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
  );
  await page.screenshot({ path: resolve(dir, `icon-${size}.png`), omitBackground: true });
}
await browser.close();
console.log('icons rendered');
