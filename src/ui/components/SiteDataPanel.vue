<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  deleteCache,
  deleteIndexedDB,
  inspectSiteData,
  unregisterServiceWorker,
  CACHE_URL_LIMIT,
  type CacheInfo,
  type IdbInfo,
  type ServiceWorkerInfo,
  type SiteDataSnapshot,
} from '../../services/pageStorage';
import { clearHttpCache } from '../../services/siteData';
import type { TargetTab } from '../../services/tab';
import { t } from '../../utils/i18n';
import { confirm, toast, toastError } from '../composables/feedback';
import Icon from './Icon.vue';

const props = defineProps<{ target: TargetTab; refreshToken: number }>();
const emit = defineEmits<{ count: [n: number] }>();

const snapshot = ref<SiteDataSnapshot | null>(null);
const error = ref('');
const loading = ref(false);
const expandedCache = ref<string | null>(null);

async function load() {
  loading.value = true;
  try {
    snapshot.value = await inspectSiteData(props.target.tabId);
    error.value = '';
  } catch (err) {
    snapshot.value = null;
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
    const s = snapshot.value;
    emit('count', s ? s.indexedDB.length + s.caches.length + s.serviceWorkers.length : 0);
  }
}

watch(() => [props.target.tabId, props.target.url, props.refreshToken], load, { immediate: true });

async function run(action: () => Promise<unknown>, message: string) {
  try {
    await action();
    toast(message);
  } catch (err) {
    toastError(err);
  }
  await load();
}

async function removeDb(db: IdbInfo) {
  const ok = await confirm({
    title: t('deleteDbTitle', db.name),
    message: t('irreversible'),
    confirmText: t('delete'),
    danger: true,
  });
  if (!ok) return;
  try {
    const result = await deleteIndexedDB(props.target.tabId, db.name);
    toast(result === 'blocked' ? t('dbBlocked') : t('dbDeleted', db.name), result === 'blocked' ? 'info' : 'success');
  } catch (err) {
    toastError(err);
  }
  await load();
}

async function removeAllDbs() {
  const dbs = snapshot.value?.indexedDB ?? [];
  if (!dbs.length) return;
  const ok = await confirm({
    title: t('deleteAllDbsTitle', [dbs.length]),
    message: t('irreversible'),
    confirmText: t('delete'),
    danger: true,
  });
  if (!ok) return;
  await run(() => Promise.all(dbs.map((d) => deleteIndexedDB(props.target.tabId, d.name))), t('dbsDeleted'));
}

async function removeCache(cache: CacheInfo) {
  const ok = await confirm({
    title: t('deleteCacheTitle', cache.name),
    confirmText: t('delete'),
    danger: true,
  });
  if (ok) await run(() => deleteCache(props.target.tabId, cache.name), t('cacheDeleted', cache.name));
}

async function removeAllCaches() {
  const list = snapshot.value?.caches ?? [];
  if (!list.length) return;
  const ok = await confirm({ title: t('deleteAllCachesTitle', [list.length]), confirmText: t('delete'), danger: true });
  if (ok) await run(() => Promise.all(list.map((c) => deleteCache(props.target.tabId, c.name))), t('cachesDeleted'));
}

function removeCacheEntry(cache: CacheInfo, url: string) {
  return run(() => deleteCache(props.target.tabId, cache.name, url), t('entryDeleted'));
}

async function unregister(sw: ServiceWorkerInfo) {
  const ok = await confirm({ title: t('unregisterSwTitle'), message: sw.scope, confirmText: t('unregister'), danger: true });
  if (ok) await run(() => unregisterServiceWorker(props.target.tabId, sw.scope), t('swUnregistered'));
}

async function clearCache() {
  await run(() => clearHttpCache(props.target.origin), t('httpCacheCleared'));
}

async function hardReload() {
  await chrome.tabs.reload(props.target.tabId, { bypassCache: true });
  toast(t('reloaded'));
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin === props.target.origin ? u.pathname + u.search : url;
  } catch {
    return url;
  }
}
</script>

<template>
  <div class="panel site-data">
    <p v-if="error" class="error-box">{{ t('pageAccessError') }} {{ error }}</p>

    <section class="card" data-testid="section-http-cache">
      <header class="card-header">
        <h3>{{ t('httpCache') }}</h3>
        <span class="spacer" />
        <button type="button" class="btn btn-ghost" @click="hardReload">{{ t('hardReload') }}</button>
        <button type="button" class="btn btn-danger-ghost" data-testid="clear-http-cache" @click="clearCache">
          {{ t('clear') }}
        </button>
      </header>
      <p class="muted small">{{ t('httpCacheHint') }}</p>
    </section>

    <template v-if="snapshot">
      <section class="card" data-testid="section-idb">
        <header class="card-header">
          <h3>IndexedDB <span class="count">{{ snapshot.indexedDB.length }}</span></h3>
          <span class="spacer" />
          <button type="button" class="btn btn-danger-ghost" :disabled="!snapshot.indexedDB.length" @click="removeAllDbs">
            {{ t('deleteAll') }}
          </button>
        </header>
        <p v-if="snapshot.errors.indexedDB" class="error-box">{{ snapshot.errors.indexedDB }}</p>
        <p v-else-if="!snapshot.indexedDB.length" class="empty small">{{ t('noDatabases') }}</p>
        <ul class="rows">
          <li v-for="db in snapshot.indexedDB" :key="db.name" class="row static" :data-db="db.name">
            <div class="row-main">
              <div class="row-title">
                <span class="name mono">{{ db.name }}</span>
                <span class="muted small">v{{ db.version }}</span>
              </div>
              <div class="row-meta">
                <span v-for="s in db.stores" :key="s.name" class="badge">
                  {{ s.name }} · {{ s.count < 0 ? '?' : t('records', [s.count]) }}
                </span>
                <span v-if="!db.stores.length" class="muted">{{ t('noObjectStores') }}</span>
              </div>
            </div>
            <div class="row-actions">
              <button type="button" class="icon-btn danger" :title="t('delete')" @click="removeDb(db)"><Icon name="trash" /></button>
            </div>
          </li>
        </ul>
      </section>

      <section class="card" data-testid="section-caches">
        <header class="card-header">
          <h3>Cache Storage <span class="count">{{ snapshot.caches.length }}</span></h3>
          <span class="spacer" />
          <button type="button" class="btn btn-danger-ghost" :disabled="!snapshot.caches.length" @click="removeAllCaches">
            {{ t('deleteAll') }}
          </button>
        </header>
        <p v-if="snapshot.errors.caches" class="error-box">{{ snapshot.errors.caches }}</p>
        <p v-else-if="!snapshot.caches.length" class="empty small">{{ t('noCaches') }}</p>
        <ul class="rows">
          <li v-for="cache in snapshot.caches" :key="cache.name" class="row static column" :data-cache="cache.name">
            <div class="row-line">
              <button
                type="button"
                class="disclosure"
                :aria-expanded="expandedCache === cache.name"
                @click="expandedCache = expandedCache === cache.name ? null : cache.name"
              >
                <Icon :name="expandedCache === cache.name ? 'chevronDown' : 'chevronRight'" :size="14" />
                <span class="name mono">{{ cache.name }}</span>
                <span class="muted small">{{ t('entries', [cache.count]) }}</span>
              </button>
              <span class="spacer" />
              <button type="button" class="icon-btn danger" :title="t('delete')" @click="removeCache(cache)"><Icon name="trash" /></button>
            </div>
            <ul v-if="expandedCache === cache.name" class="sub-rows">
              <li v-for="url in cache.urls" :key="url" class="sub-row">
                <span class="mono ellipsis" :title="url">{{ shortUrl(url) }}</span>
                <button type="button" class="icon-btn danger" :title="t('delete')" @click="removeCacheEntry(cache, url)">
                  <Icon name="trash" />
                </button>
              </li>
              <li v-if="cache.count > CACHE_URL_LIMIT" class="muted small">
                {{ t('moreEntries', [cache.count - CACHE_URL_LIMIT]) }}
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <section class="card" data-testid="section-sw">
        <header class="card-header">
          <h3>Service Workers <span class="count">{{ snapshot.serviceWorkers.length }}</span></h3>
        </header>
        <p v-if="snapshot.errors.serviceWorkers" class="error-box">{{ snapshot.errors.serviceWorkers }}</p>
        <p v-else-if="!snapshot.serviceWorkers.length" class="empty small">{{ t('noServiceWorkers') }}</p>
        <ul class="rows">
          <li v-for="sw in snapshot.serviceWorkers" :key="sw.scope" class="row static" :data-sw="sw.scope">
            <div class="row-main">
              <div class="row-title">
                <span class="name mono ellipsis" :title="sw.scope">{{ shortUrl(sw.scope) }}</span>
                <span class="badge" :class="{ 'badge-ok': sw.state === 'activated' }">{{ sw.state }}</span>
              </div>
              <div class="row-meta">
                <span class="mono ellipsis" :title="sw.scriptURL">{{ shortUrl(sw.scriptURL) }}</span>
              </div>
            </div>
            <div class="row-actions">
              <button type="button" class="btn btn-danger-ghost" @click="unregister(sw)">{{ t('unregister') }}</button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
