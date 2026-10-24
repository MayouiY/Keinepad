import { classifyUrl, type UrlSupport } from '../utils/domain';

export interface TargetTab {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  favIconUrl?: string;
  incognito: boolean;
  support: UrlSupport;
  /** Only meaningful when support === 'ok'. */
  origin: string;
  host: string;
  protocol: string;
}

/** Tab id passed explicitly via `?tabId=` (used by tests and deep links). */
export function tabIdFromQuery(): number | undefined {
  const raw = new URLSearchParams(location.search).get('tabId');
  const id = raw ? Number(raw) : NaN;
  return Number.isInteger(id) ? id : undefined;
}

export function describeTab(tab: chrome.tabs.Tab): TargetTab | undefined {
  if (tab.id === undefined || tab.id === chrome.tabs.TAB_ID_NONE) return undefined;
  // `pendingUrl` covers tabs that are still navigating to their first URL.
  const url = tab.url || tab.pendingUrl || '';
  const support = classifyUrl(url);
  let origin = '';
  let host = '';
  let protocol = '';
  if (support === 'ok') {
    const u = new URL(url);
    origin = u.origin;
    host = u.hostname;
    protocol = u.protocol;
  }
  return {
    tabId: tab.id,
    windowId: tab.windowId,
    url,
    title: tab.title ?? '',
    favIconUrl: tab.favIconUrl,
    incognito: tab.incognito,
    support,
    origin,
    host,
    protocol,
  };
}

export async function getTargetTab(): Promise<TargetTab | undefined> {
  const fixed = tabIdFromQuery();
  if (fixed !== undefined) {
    try {
      return describeTab(await chrome.tabs.get(fixed));
    } catch {
      return undefined;
    }
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? describeTab(tab) : undefined;
}
