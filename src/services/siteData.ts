import { removeCookies, type SiteCookie } from './cookies';
import { clearStorage } from './pageStorage';

export interface ClearOptions {
  cookies: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  cacheStorage: boolean;
  serviceWorkers: boolean;
  /** HTTP (disk/memory) cache. Chrome can only clear it, not enumerate it. */
  cache: boolean;
}

export const ALL_CLEAR_OPTIONS: ClearOptions = {
  cookies: true,
  localStorage: true,
  sessionStorage: true,
  indexedDB: true,
  cacheStorage: true,
  serviceWorkers: true,
  cache: true,
};

export async function clearHttpCache(origin: string): Promise<void> {
  await chrome.browsingData.remove({ origins: [origin] }, { cache: true });
}

/**
 * Clear the selected data for one origin. Cookies are removed individually (exactly the
 * ones the panel shows) instead of via browsingData, which would wipe the entire
 * registrable domain; sessionStorage is not covered by browsingData so it is cleared in-page.
 */
export async function clearSiteData(
  target: { tabId: number; origin: string },
  opts: ClearOptions,
  cookies: SiteCookie[],
): Promise<void> {
  const dataTypes: chrome.browsingData.DataTypeSet = {
    localStorage: opts.localStorage,
    indexedDB: opts.indexedDB,
    cacheStorage: opts.cacheStorage,
    serviceWorkers: opts.serviceWorkers,
    cache: opts.cache,
    fileSystems: opts.indexedDB,
    webSQL: opts.indexedDB,
  };
  const tasks: Promise<unknown>[] = [];
  if (Object.values(dataTypes).some(Boolean)) {
    tasks.push(chrome.browsingData.remove({ origins: [target.origin] }, dataTypes));
  }
  if (opts.cookies) tasks.push(removeCookies(cookies));
  if (opts.sessionStorage) tasks.push(clearStorage(target.tabId, 'sessionStorage'));
  await Promise.all(tasks);
}
