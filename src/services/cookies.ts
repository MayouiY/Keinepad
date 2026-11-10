import {
  cookieKey,
  cookieSize,
  cookieUrl,
  identityChanged,
  toDraft,
  toSetDetails,
  type CookieDraft,
} from '../utils/cookie';
import { pickSiteRoot } from '../utils/domain';
import type { TargetTab } from './tab';

export interface SiteCookie extends chrome.cookies.Cookie {
  key: string;
  /** Whether the browser would attach this cookie to a request for the tab's URL. */
  sentToPage: boolean;
  /** Bytes of name + value, measured once so lists don't re-encode on every render. */
  size: number;
}

export interface SiteCookies {
  cookies: SiteCookie[];
  /** Widest domain considered part of the current site (see pickSiteRoot). */
  siteRoot: string;
  storeId?: string;
  /** Partition key of the top-level page, used as default for new partitioned cookies. */
  pagePartitionSite: string;
}

// A tab stays in the cookie store it was opened in, so the answers can be kept.
const storeIds = new Map<number, string>();
let preloadedStores: Promise<void> | undefined;

function rememberStores(stores: chrome.cookies.CookieStore[]): void {
  for (const store of stores) {
    for (const tabId of store.tabIds) storeIds.set(tabId, store.id);
  }
}

/**
 * Ask for the cookie stores before the tab is even known, so the answer is already there
 * when the first cookie query wants to leave.
 */
export function preloadCookieStores(): void {
  // A failure simply leaves the map empty; getStoreId() then asks again and reports it.
  preloadedStores = chrome.cookies.getAllCookieStores().then(rememberStores, () => undefined);
}

export async function getStoreId(tabId: number): Promise<string | undefined> {
  if (!storeIds.has(tabId)) {
    await preloadedStores;
    preloadedStores = undefined;
    // Not in the preloaded list: the tab was opened after it was fetched.
    if (!storeIds.has(tabId)) rememberStores(await chrome.cookies.getAllCookieStores());
  }
  return storeIds.get(tabId);
}

/** The exact schemeful site Chrome uses for CHIPS in this tab; undefined before Chrome 132. */
async function getPartitionSite(tabId: number): Promise<string | undefined> {
  try {
    const { partitionKey } = await chrome.cookies.getPartitionKey({ tabId, frameId: 0 });
    return partitionKey.topLevelSite || undefined;
  } catch {
    return undefined;
  }
}

async function getAllSafe(details: chrome.cookies.GetAllDetails): Promise<chrome.cookies.Cookie[]> {
  try {
    return await chrome.cookies.getAll(details);
  } catch (err) {
    // Browsers without partitioned cookie support reject the partitionKey field.
    if (details.partitionKey === undefined) throw err;
    const legacy = { ...details };
    delete legacy.partitionKey;
    return chrome.cookies.getAll(legacy);
  }
}

/**
 * Every call here is a round trip to the browser process, so independent ones are sent
 * together: two rounds (plus a store lookup the first time a tab is seen) instead of five.
 */
export async function loadSiteCookies(target: TargetTab): Promise<SiteCookies> {
  const partitionSite = getPartitionSite(target.tabId);
  // No `await` when the store is already known: the first query then leaves in the same turn,
  // ahead of the rendering that the caller's state change has queued.
  const storeId = storeIds.get(target.tabId) ?? (await getStoreId(target.tabId));
  const [unpartitionedSent, exactPartitionSite] = await Promise.all([
    getAllSafe({ url: target.url, storeId }),
    partitionSite,
  ]);
  const siteRoot = pickSiteRoot(target.host, unpartitionedSent.map((c) => c.domain));
  const pagePartitionSite = exactPartitionSite ?? `${target.protocol}//${siteRoot}`;
  const [partitionedSent, all] = await Promise.all([
    getAllSafe({ url: target.url, storeId, partitionKey: { topLevelSite: pagePartitionSite } }),
    // An empty partitionKey asks for cookies from every partition (Chrome 119+).
    getAllSafe({ domain: siteRoot, storeId, partitionKey: {} }),
  ]);
  const sentKeys = new Set([...unpartitionedSent, ...partitionedSent].map(cookieKey));

  const byKey = new Map<string, SiteCookie>();
  for (const c of [...all, ...partitionedSent]) {
    const key = cookieKey(c);
    if (!byKey.has(key)) byKey.set(key, { ...c, key, sentToPage: sentKeys.has(key), size: cookieSize(c) });
  }
  return { cookies: [...byKey.values()], siteRoot, storeId, pagePartitionSite };
}

export async function removeCookie(c: chrome.cookies.Cookie): Promise<void> {
  const details: chrome.cookies.CookieDetails = {
    url: cookieUrl(c),
    name: c.name,
    storeId: c.storeId,
  };
  if (c.partitionKey) details.partitionKey = c.partitionKey;
  await chrome.cookies.remove(details);
}

export async function removeCookies(list: chrome.cookies.Cookie[]): Promise<void> {
  await Promise.all(list.map(removeCookie));
}

async function setDraft(draft: CookieDraft, storeId?: string): Promise<chrome.cookies.Cookie> {
  const result = await chrome.cookies.set(toSetDetails(draft, storeId));
  if (!result) {
    throw new Error(chrome.runtime.lastError?.message || 'The browser rejected this cookie.');
  }
  return result;
}

/**
 * Create or update a cookie. Changing name/domain/path/partition changes the cookie's
 * identity, so the original is removed first and restored if the new one is rejected.
 */
export async function saveCookie(
  draft: CookieDraft,
  original: chrome.cookies.Cookie | undefined,
  storeId?: string,
): Promise<chrome.cookies.Cookie> {
  if (!original || !identityChanged(toDraft(original), draft)) return setDraft(draft, storeId);
  await removeCookie(original);
  try {
    return await setDraft(draft, storeId);
  } catch (err) {
    await setDraft(toDraft(original), original.storeId).catch(() => undefined);
    throw err;
  }
}

export async function importCookies(
  drafts: CookieDraft[],
  storeId?: string,
): Promise<{ ok: number; failed: { name: string; error: string }[] }> {
  const failed: { name: string; error: string }[] = [];
  let ok = 0;
  for (const d of drafts) {
    try {
      await setDraft(d, storeId);
      ok++;
    } catch (err) {
      failed.push({ name: d.name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { ok, failed };
}
