import {
  cookieKey,
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
}

export interface SiteCookies {
  cookies: SiteCookie[];
  /** Widest domain considered part of the current site (see pickSiteRoot). */
  siteRoot: string;
  storeId?: string;
  /** Partition key of the top-level page, used as default for new partitioned cookies. */
  pagePartitionSite: string;
}

export async function getStoreId(tabId: number): Promise<string | undefined> {
  const stores = await chrome.cookies.getAllCookieStores();
  return stores.find((s) => s.tabIds.includes(tabId))?.id;
}

async function getPagePartitionSite(target: TargetTab, fallbackRoot: string): Promise<string> {
  try {
    // Available from Chrome 132; gives the exact schemeful site Chrome uses for CHIPS.
    const { partitionKey } = await chrome.cookies.getPartitionKey({ tabId: target.tabId, frameId: 0 });
    if (partitionKey.topLevelSite) return partitionKey.topLevelSite;
  } catch {
    /* older browser */
  }
  return `${target.protocol}//${fallbackRoot}`;
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

export async function loadSiteCookies(target: TargetTab): Promise<SiteCookies> {
  const storeId = await getStoreId(target.tabId);
  const unpartitionedSent = await getAllSafe({ url: target.url, storeId });
  const siteRoot = pickSiteRoot(target.host, unpartitionedSent.map((c) => c.domain));
  const pagePartitionSite = await getPagePartitionSite(target, siteRoot);
  const partitionedSent = await getAllSafe({
    url: target.url,
    storeId,
    partitionKey: { topLevelSite: pagePartitionSite },
  });
  const sentKeys = new Set([...unpartitionedSent, ...partitionedSent].map(cookieKey));

  // An empty partitionKey asks for cookies from every partition (Chrome 119+).
  const all = await getAllSafe({ domain: siteRoot, storeId, partitionKey: {} });
  const byKey = new Map<string, SiteCookie>();
  for (const c of [...all, ...partitionedSent]) {
    const key = cookieKey(c);
    if (!byKey.has(key)) byKey.set(key, { ...c, key, sentToPage: sentKeys.has(key) });
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
