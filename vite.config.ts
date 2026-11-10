import { resolve } from 'node:path';
import { build, defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const root = __dirname;

/**
 * Bundles the service worker in a build of its own. In one Rollup graph with the pages, the
 * code both sides use would be split into a shared chunk: one more file the popup has to fetch
 * before it can render, and one more the worker has to load every time it wakes up.
 */
function backgroundBundle(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'keinepad:background',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      // The worker's sources are not part of the page graph; watch them so `npm run dev` rebuilds.
      this.addWatchFile(resolve(root, 'src'));
    },
    async closeBundle(error) {
      if (error) return;
      const { outDir, target, sourcemap, minify } = config.build;
      await build({
        root,
        configFile: false,
        mode: config.mode,
        publicDir: false,
        logLevel: 'warn',
        build: {
          outDir,
          emptyOutDir: false,
          target,
          sourcemap,
          minify,
          rollupOptions: {
            input: { background: resolve(root, 'src/background/index.ts') },
            // The service worker path is referenced from manifest.json, so it needs a stable name.
            output: { entryFileNames: 'background.js' },
          },
        },
      });
      config.logger.info(`${outDir}/background.js (service worker, bundled separately)`);
    },
  };
}

/**
 * Inlines the stylesheet into popup.html / sidepanel.html. The popup is only shown once its
 * document has loaded, and every extension file costs a round trip to the browser process, so
 * a separate CSS file is one more request the first paint has to wait for.
 */
function inlineCss(): Plugin {
  const text = (source: string | Uint8Array) => (typeof source === 'string' ? source : new TextDecoder().decode(source));
  return {
    name: 'keinepad:inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const inlined = new Set<string>();
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue;
        file.source = text(file.source).replace(/<link rel="stylesheet"[^>]*? href="\/([^"]+\.css)">/g, (tag, name: string) => {
          const css = bundle[name];
          if (css?.type !== 'asset') return tag;
          const source = text(css.source).trim();
          // Leave the file alone if its content could end the <style> element early.
          if (source.includes('</style')) return tag;
          inlined.add(name);
          return `<style>${source}</style>`;
        });
      }
      for (const name of inlined) delete bundle[name];
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [vue(), inlineCss(), backgroundBundle()],
  define: {
    // All components use <script setup>, so the Options API runtime can be dropped.
    __VUE_OPTIONS_API__: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome128',
    sourcemap: mode === 'development',
    minify: mode !== 'development',
    // Every supported browser preloads modules natively.
    modulePreload: { polyfill: false },
    rollupOptions: {
      // Both pages load the same entry (src/ui/main.ts), so each one needs a single script.
      input: {
        popup: resolve(root, 'popup.html'),
        sidepanel: resolve(root, 'sidepanel.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
