import { RELEASE_SOURCE, UPDATE_CHECK_INTERVAL_MS } from '../config';
import { kvGet, kvSet } from '../utils/kv';
import { t } from '../utils/i18n';
import { compareVersions, parseVersion } from '../utils/version';

export interface ReleaseInfo {
  version: string;
  name: string;
  notes: string;
  pageUrl: string;
  downloadUrl: string;
  publishedAt: string;
}

export interface UpdateState {
  checkedAt: number;
  latest?: ReleaseInfo;
  error?: string;
}

const STATE_KEY = 'update.state';
const DISMISSED_KEY = 'update.dismissed';
const AUTO_CHECK_KEY = 'update.autoCheck';

/**
 * Chrome Web Store and Edge Add-ons inject `update_url` into the installed manifest, as does a
 * policy install with its own update server. Those builds are updated by the browser, so the
 * GitHub check only runs for unpacked / manually installed copies.
 */
export function selfUpdateEnabled(): boolean {
  return !('update_url' in chrome.runtime.getManifest());
}

export const currentVersion = (): string => chrome.runtime.getManifest().version;

export async function isAutoCheckOn(): Promise<boolean> {
  return (await kvGet<boolean>(AUTO_CHECK_KEY)) ?? true;
}

export async function setAutoCheck(on: boolean): Promise<void> {
  await kvSet(AUTO_CHECK_KEY, on);
}

export async function getUpdateState(): Promise<UpdateState | undefined> {
  return kvGet<UpdateState>(STATE_KEY);
}

/** The release newer than the running version, if the last check found one. */
export function newerRelease(state: UpdateState | undefined): ReleaseInfo | undefined {
  const latest = state?.latest;
  return latest && compareVersions(latest.version, currentVersion()) > 0 ? latest : undefined;
}

/** A newer release the user has not chosen to skip. */
export async function pendingUpdate(): Promise<ReleaseInfo | undefined> {
  if (!selfUpdateEnabled()) return undefined;
  const release = newerRelease(await getUpdateState());
  if (!release) return undefined;
  return (await kvGet<string>(DISMISSED_KEY)) === release.version ? undefined : release;
}

export async function dismissUpdate(version: string): Promise<void> {
  await kvSet(DISMISSED_KEY, version);
  await refreshBadge();
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  assets: { name: string; browser_download_url: string }[];
}

async function fetchLatestRelease(): Promise<ReleaseInfo> {
  // No credentials or identifiers are sent: this is an anonymous public API request.
  const res = await fetch(RELEASE_SOURCE.latestApi, {
    headers: { Accept: 'application/vnd.github+json' },
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as GitHubRelease;
  if (!parseVersion(data.tag_name)) throw new Error(`Unexpected tag ${data.tag_name}`);
  const asset = data.assets.find((a) => RELEASE_SOURCE.assetPattern.test(a.name));
  return {
    version: data.tag_name.replace(/^v/i, ''),
    name: data.name || data.tag_name,
    notes: data.body ?? '',
    pageUrl: data.html_url || RELEASE_SOURCE.releasesPage,
    downloadUrl: asset?.browser_download_url ?? data.html_url ?? RELEASE_SOURCE.releasesPage,
    publishedAt: data.published_at ?? '',
  };
}

/**
 * Check GitHub for a newer release. Automatic checks are skipped when turned off or when the
 * last check is recent; `force` is for an explicit "Check for updates".
 */
export async function checkForUpdate(force = false): Promise<UpdateState | undefined> {
  if (!selfUpdateEnabled()) return undefined;
  const previous = await getUpdateState();
  if (!force) {
    const due = !previous || Date.now() - previous.checkedAt >= UPDATE_CHECK_INTERVAL_MS;
    if (!due || !(await isAutoCheckOn())) {
      await refreshBadge();
      return previous;
    }
  }
  let state: UpdateState;
  try {
    state = { checkedAt: Date.now(), latest: await fetchLatestRelease() };
  } catch (err) {
    // Keep the last known release so a flaky network does not hide an available update.
    state = { checkedAt: Date.now(), latest: previous?.latest, error: String(err instanceof Error ? err.message : err) };
  }
  await kvSet(STATE_KEY, state);
  await refreshBadge();
  return state;
}

/** Mark the toolbar icon while an update is pending. */
export async function refreshBadge(): Promise<void> {
  const release = await pendingUpdate();
  await chrome.action.setBadgeText({ text: release ? 'NEW' : '' });
  await chrome.action.setTitle({
    title: release ? `${t('extName')}\n${t('updateAvailable', release.version)}` : t('extName'),
  });
  if (release) await chrome.action.setBadgeBackgroundColor({ color: '#3b6ef5' });
}

/** Unpacked installs can pick up files replaced on disk with a plain reload. */
export async function isUnpacked(): Promise<boolean> {
  try {
    return (await chrome.management.getSelf()).installType === 'development';
  } catch {
    return false;
  }
}
