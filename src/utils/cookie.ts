import { stripLeadingDot } from './domain';

export type SameSite = 'no_restriction' | 'lax' | 'strict' | 'unspecified';

/** Editable representation of a cookie, decoupled from chrome.cookies.Cookie. */
export interface CookieDraft {
  name: string;
  value: string;
  /** Host for host-only cookies, otherwise the domain without leading dot. */
  domain: string;
  hostOnly: boolean;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: SameSite;
  session: boolean;
  /** Seconds since the UNIX epoch, ignored when `session` is true. */
  expirationDate?: number;
  /** Top-level site of a partitioned (CHIPS) cookie, e.g. "https://example.com". */
  partitionTopLevelSite?: string;
}

/** Minimal shape shared by chrome.cookies.Cookie and imported JSON. */
export interface CookieLike {
  name: string;
  value: string;
  domain: string;
  hostOnly?: boolean;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  session?: boolean;
  expirationDate?: number;
  storeId?: string;
  partitionKey?: { topLevelSite?: string; hasCrossSiteAncestor?: boolean };
}

const SAME_SITE_VALUES: SameSite[] = ['no_restriction', 'lax', 'strict', 'unspecified'];

function normalizeSameSite(value: string | undefined): SameSite {
  const v = (value ?? '').toLowerCase();
  if ((SAME_SITE_VALUES as string[]).includes(v)) return v as SameSite;
  if (v === 'none') return 'no_restriction';
  return 'unspecified';
}

export function cookieKey(c: CookieLike): string {
  return [c.storeId ?? '', c.name, c.domain, c.path ?? '/', c.partitionKey?.topLevelSite ?? ''].join('\u0000');
}

/** URL that chrome.cookies.set/remove accept for a cookie with the given attributes. */
export function cookieUrl(c: { domain: string; path?: string; secure?: boolean }): string {
  const host = stripLeadingDot(c.domain);
  const path = c.path && c.path.startsWith('/') ? c.path : '/';
  return `${c.secure ? 'https' : 'http'}://${host}${path}`;
}

export function toDraft(c: CookieLike): CookieDraft {
  const hostOnly = c.hostOnly ?? !c.domain.startsWith('.');
  const session = c.session ?? c.expirationDate === undefined;
  return {
    name: c.name,
    value: c.value,
    domain: stripLeadingDot(c.domain),
    hostOnly,
    path: c.path || '/',
    secure: !!c.secure,
    httpOnly: !!c.httpOnly,
    sameSite: normalizeSameSite(c.sameSite),
    session,
    expirationDate: session ? undefined : c.expirationDate,
    partitionTopLevelSite: c.partitionKey?.topLevelSite || undefined,
  };
}

export function emptyDraft(host: string, secure: boolean): CookieDraft {
  return {
    name: '',
    value: '',
    domain: host,
    hostOnly: true,
    path: '/',
    secure,
    httpOnly: false,
    sameSite: 'lax',
    session: false,
    expirationDate: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  };
}

/** Message keys (see _locales) describing why a draft cannot be saved. */
export type DraftError =
  | 'errNameRequired'
  | 'errNameInvalid'
  | 'errValueInvalid'
  | 'errDomainRequired'
  | 'errPathInvalid'
  | 'errSameSiteNoneNeedsSecure'
  | 'errPartitionedNeedsSecure'
  | 'errHostPrefix'
  | 'errSecurePrefix'
  | 'errExpiryRequired';

// Control characters and separators that the cookie grammar forbids.
const INVALID_NAME = /[\u0000-\u001f\u007f\s"(),/:;<=>?@[\\\]{}]/;
const INVALID_VALUE = /[\u0000-\u001f\u007f;]/;

export function validateDraft(d: CookieDraft): DraftError[] {
  const errors: DraftError[] = [];
  if (!d.name) errors.push('errNameRequired');
  else if (INVALID_NAME.test(d.name)) errors.push('errNameInvalid');
  if (INVALID_VALUE.test(d.value)) errors.push('errValueInvalid');
  if (!stripLeadingDot(d.domain.trim())) errors.push('errDomainRequired');
  if (!d.path.startsWith('/')) errors.push('errPathInvalid');
  if (d.sameSite === 'no_restriction' && !d.secure) errors.push('errSameSiteNoneNeedsSecure');
  if (d.partitionTopLevelSite && !d.secure) errors.push('errPartitionedNeedsSecure');
  if (d.name.startsWith('__Host-') && (!d.secure || !d.hostOnly || d.path !== '/')) {
    errors.push('errHostPrefix');
  }
  if (d.name.startsWith('__Secure-') && !d.secure) errors.push('errSecurePrefix');
  if (!d.session && !(typeof d.expirationDate === 'number' && Number.isFinite(d.expirationDate))) {
    errors.push('errExpiryRequired');
  }
  return errors;
}

export function toSetDetails(d: CookieDraft, storeId?: string): chrome.cookies.SetDetails {
  const domain = stripLeadingDot(d.domain.trim());
  const details: chrome.cookies.SetDetails = {
    url: cookieUrl({ domain, path: d.path, secure: d.secure }),
    name: d.name,
    value: d.value,
    path: d.path,
    secure: d.secure,
    httpOnly: d.httpOnly,
    sameSite: d.sameSite as chrome.cookies.SameSiteStatus,
  };
  // Omitting `domain` is how chrome.cookies creates a host-only cookie.
  if (!d.hostOnly) details.domain = domain;
  if (!d.session && d.expirationDate !== undefined) details.expirationDate = d.expirationDate;
  if (d.partitionTopLevelSite) details.partitionKey = { topLevelSite: d.partitionTopLevelSite };
  if (storeId) details.storeId = storeId;
  return details;
}

/** True when saving `draft` would create a different cookie than `original` (needs remove + set). */
export function identityChanged(original: CookieDraft, draft: CookieDraft): boolean {
  return (
    original.name !== draft.name ||
    stripLeadingDot(original.domain) !== stripLeadingDot(draft.domain.trim()) ||
    original.hostOnly !== draft.hostOnly ||
    original.path !== draft.path ||
    (original.partitionTopLevelSite ?? '') !== (draft.partitionTopLevelSite ?? '')
  );
}

export function cookieSize(c: { name: string; value: string }): number {
  return new TextEncoder().encode(c.name + c.value).length;
}

export function toCookieHeader(cookies: { name: string; value: string }[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

export interface ExportFile {
  format: 'keinepad-cookies';
  version: 1;
  url?: string;
  exportedAt: string;
  cookies: CookieDraft[];
}

export function exportCookies(cookies: CookieLike[], url?: string): ExportFile {
  return {
    format: 'keinepad-cookies',
    version: 1,
    url,
    exportedAt: new Date().toISOString(),
    cookies: cookies.map(toDraft),
  };
}

/**
 * Accepts our own export format as well as plain arrays of chrome.cookies-like objects
 * (the format used by most cookie editor extensions).
 */
export function parseImport(text: string): CookieDraft[] {
  const data: unknown = JSON.parse(text);
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { cookies?: unknown }).cookies)
      ? (data as { cookies: unknown[] }).cookies
      : null;
  if (!list) throw new Error('Unsupported format');
  return list.map((item, i) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid cookie at index ${i}`);
    const o = item as Record<string, unknown>;
    if (typeof o.name !== 'string' || typeof o.domain !== 'string') {
      throw new Error(`Invalid cookie at index ${i}`);
    }
    const like: CookieLike = {
      name: o.name,
      value: typeof o.value === 'string' ? o.value : String(o.value ?? ''),
      domain: o.domain,
      hostOnly: typeof o.hostOnly === 'boolean' ? o.hostOnly : undefined,
      path: typeof o.path === 'string' ? o.path : '/',
      secure: !!o.secure,
      httpOnly: !!o.httpOnly,
      sameSite: typeof o.sameSite === 'string' ? o.sameSite : undefined,
      session: typeof o.session === 'boolean' ? o.session : undefined,
      expirationDate: typeof o.expirationDate === 'number' ? o.expirationDate : undefined,
      partitionKey:
        typeof o.partitionTopLevelSite === 'string'
          ? { topLevelSite: o.partitionTopLevelSite }
          : o.partitionKey && typeof o.partitionKey === 'object'
            ? (o.partitionKey as CookieLike['partitionKey'])
            : undefined,
    };
    return toDraft(like);
  });
}
