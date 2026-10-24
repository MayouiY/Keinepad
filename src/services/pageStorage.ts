/**
 * Everything here runs inside the inspected page via chrome.scripting.executeScript.
 * Injected functions must be self-contained (no imports / closures) and are wrapped so
 * page-side exceptions come back as `{ error }` instead of a silent `undefined`.
 */

export type StorageKind = 'localStorage' | 'sessionStorage';

export interface StorageEntry {
  key: string;
  value: string;
}

export interface IdbStoreInfo {
  name: string;
  count: number;
}

export interface IdbInfo {
  name: string;
  version: number;
  stores: IdbStoreInfo[];
}

export interface CacheInfo {
  name: string;
  /** Request URLs, capped at CACHE_URL_LIMIT. */
  urls: string[];
  count: number;
}

export interface ServiceWorkerInfo {
  scope: string;
  scriptURL: string;
  state: string;
}

export interface SiteDataSnapshot {
  indexedDB: IdbInfo[];
  caches: CacheInfo[];
  serviceWorkers: ServiceWorkerInfo[];
  /** Per-section errors (e.g. storage access denied for sandboxed pages). */
  errors: Partial<Record<'indexedDB' | 'caches' | 'serviceWorkers', string>>;
}

type Wrapped<T> = { ok: true; data: T } | { ok: false; error: string };

async function inject<A extends unknown[], T>(
  tabId: number,
  func: (...args: A) => Promise<Wrapped<T>> | Wrapped<T>,
  args: A,
): Promise<T> {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  const wrapped = res?.result as Wrapped<T> | undefined;
  if (!wrapped) throw new Error('No result from page');
  if (!wrapped.ok) throw new Error(wrapped.error);
  return wrapped.data;
}

export function listStorage(tabId: number, kind: StorageKind): Promise<StorageEntry[]> {
  return inject(
    tabId,
    (k: StorageKind) => {
      try {
        const s = window[k];
        const out: { key: string; value: string }[] = [];
        for (let i = 0; i < s.length; i++) {
          const key = s.key(i);
          if (key !== null) out.push({ key, value: s.getItem(key) ?? '' });
        }
        return { ok: true as const, data: out };
      } catch (e) {
        return { ok: false as const, error: String(e) };
      }
    },
    [kind],
  );
}

export function setStorageItem(
  tabId: number,
  kind: StorageKind,
  key: string,
  value: string,
  oldKey?: string,
): Promise<null> {
  return inject(
    tabId,
    (k: StorageKind, key: string, value: string, oldKey: string | null) => {
      try {
        const s = window[k];
        s.setItem(key, value);
        if (oldKey !== null && oldKey !== key) s.removeItem(oldKey);
        return { ok: true as const, data: null };
      } catch (e) {
        return { ok: false as const, error: String(e) };
      }
    },
    // executeScript args must be JSON-serializable, so undefined becomes null.
    [kind, key, value, oldKey ?? null],
  );
}

export function removeStorageItems(tabId: number, kind: StorageKind, keys: string[]): Promise<null> {
  return inject(
    tabId,
    (k: StorageKind, keys: string[]) => {
      try {
        for (const key of keys) window[k].removeItem(key);
        return { ok: true as const, data: null };
      } catch (e) {
        return { ok: false as const, error: String(e) };
      }
    },
    [kind, keys],
  );
}

export function clearStorage(tabId: number, kind: StorageKind): Promise<null> {
  return inject(
    tabId,
    (k: StorageKind) => {
      try {
        window[k].clear();
        return { ok: true as const, data: null };
      } catch (e) {
        return { ok: false as const, error: String(e) };
      }
    },
    [kind],
  );
}

export const CACHE_URL_LIMIT = 500;

export function inspectSiteData(tabId: number): Promise<SiteDataSnapshot> {
  return inject(
    tabId,
    async (urlLimit: number) => {
      const snapshot: SiteDataSnapshot = { indexedDB: [], caches: [], serviceWorkers: [], errors: {} };
      const settle = <T>(p: Promise<T>, ms: number) =>
        Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

      try {
        const dbs = await indexedDB.databases();
        for (const { name, version } of dbs) {
          if (!name) continue;
          const info = { name, version: version ?? 0, stores: [] as { name: string; count: number }[] };
          try {
            // Opening without a version never triggers an upgrade on an existing database.
            const db = await settle(
              new Promise<IDBDatabase>((resolve, reject) => {
                const req = indexedDB.open(name);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
              }),
              3000,
            );
            try {
              const names = Array.from(db.objectStoreNames);
              if (names.length) {
                const tx = db.transaction(names, 'readonly');
                for (const storeName of names) {
                  const count = await new Promise<number>((resolve) => {
                    const req = tx.objectStore(storeName).count();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(-1);
                  });
                  info.stores.push({ name: storeName, count });
                }
              }
            } finally {
              // Keeping the connection open would block deleteDatabase / page upgrades.
              db.close();
            }
          } catch {
            /* show the database without store details */
          }
          snapshot.indexedDB.push(info);
        }
      } catch (e) {
        snapshot.errors.indexedDB = String(e);
      }

      try {
        for (const name of await caches.keys()) {
          const cache = await caches.open(name);
          const reqs = await cache.keys();
          snapshot.caches.push({
            name,
            count: reqs.length,
            urls: reqs.slice(0, urlLimit).map((r) => r.url),
          });
        }
      } catch (e) {
        snapshot.errors.caches = String(e);
      }

      try {
        if ('serviceWorker' in navigator) {
          for (const reg of await navigator.serviceWorker.getRegistrations()) {
            const worker = reg.active ?? reg.waiting ?? reg.installing;
            snapshot.serviceWorkers.push({
              scope: reg.scope,
              scriptURL: worker?.scriptURL ?? '',
              state: worker?.state ?? 'unknown',
            });
          }
        }
      } catch (e) {
        snapshot.errors.serviceWorkers = String(e);
      }

      return { ok: true as const, data: snapshot };
    },
    [CACHE_URL_LIMIT],
  );
}

/** Resolves to 'blocked' when open connections delay the deletion until the page closes them. */
export function deleteIndexedDB(tabId: number, name: string): Promise<'deleted' | 'blocked'> {
  return inject(
    tabId,
    (dbName: string) =>
      new Promise<{ ok: true; data: 'deleted' | 'blocked' } | { ok: false; error: string }>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve({ ok: true, data: 'deleted' });
        req.onerror = () => resolve({ ok: false, error: String(req.error) });
        req.onblocked = () => resolve({ ok: true, data: 'blocked' });
      }),
    [name],
  );
}

export function deleteCache(tabId: number, name: string, url?: string): Promise<boolean> {
  return inject(
    tabId,
    async (cacheName: string, entryUrl: string | null) => {
      try {
        const removed =
          entryUrl === null ? await caches.delete(cacheName) : await (await caches.open(cacheName)).delete(entryUrl);
        return { ok: true as const, data: removed };
      } catch (e) {
        return { ok: false as const, error: String(e) };
      }
    },
    [name, url ?? null],
  );
}

export function unregisterServiceWorker(tabId: number, scope: string): Promise<boolean> {
  return inject(
    tabId,
    async (swScope: string) => {
      try {
        const reg = await navigator.serviceWorker.getRegistration(swScope);
        return { ok: true as const, data: reg && reg.scope === swScope ? await reg.unregister() : false };
      } catch (e) {
        return { ok: false as const, error: String(e) };
      }
    },
    [scope],
  );
}
