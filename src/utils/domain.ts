/** Strip the leading dot Chrome uses for domain (non host-only) cookies. */
export function stripLeadingDot(domain: string): string {
  return domain.startsWith('.') ? domain.slice(1) : domain;
}

/** Whether a cookie with `cookieDomain` would be sent to `host` (RFC 6265 domain-match). */
export function domainMatches(cookieDomain: string, host: string): boolean {
  const d = stripLeadingDot(cookieDomain).toLowerCase();
  const h = host.toLowerCase();
  return h === d || h.endsWith(`.${d}`);
}

/**
 * Pick the widest domain that still belongs to the current site, without needing the
 * public suffix list: browsers refuse cookies on public suffixes, so the shortest domain
 * among the cookies already applicable to `host` is a safe upper bound. Falls back to the
 * host itself when no parent-domain cookies exist.
 */
export function pickSiteRoot(host: string, applicableDomains: string[]): string {
  let root = host.toLowerCase();
  for (const raw of applicableDomains) {
    const d = stripLeadingDot(raw).toLowerCase();
    // A single-label parent (e.g. "com") can never legitimately hold cookies.
    if (!d.includes('.')) continue;
    if (domainMatches(d, host) && d.length < root.length) root = d;
  }
  return root;
}

const RESTRICTED_PROTOCOLS = [
  'chrome:',
  'chrome-extension:',
  'chrome-search:',
  'chrome-untrusted:',
  'devtools:',
  'edge:',
  'brave:',
  'opera:',
  'vivaldi:',
  'about:',
  'view-source:',
  'data:',
  'blob:',
  'javascript:',
];

const RESTRICTED_HOSTS = ['chromewebstore.google.com', 'microsoftedge.microsoft.com'];

export type UrlSupport = 'ok' | 'restricted' | 'file' | 'invalid';

/** Extensions cannot inject into browser pages or extension stores, and have no cookies on file://. */
export function classifyUrl(url: string | undefined): UrlSupport {
  if (!url) return 'invalid';
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'invalid';
  }
  if (u.protocol === 'file:') return 'file';
  if (RESTRICTED_PROTOCOLS.includes(u.protocol)) return 'restricted';
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'restricted';
  if (RESTRICTED_HOSTS.includes(u.hostname)) return 'restricted';
  if (u.hostname === 'chrome.google.com' && u.pathname.startsWith('/webstore')) return 'restricted';
  return 'ok';
}

