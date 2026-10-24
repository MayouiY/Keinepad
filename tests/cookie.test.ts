import { describe, expect, it } from 'vitest';
import {
  cookieUrl,
  exportCookies,
  identityChanged,
  parseImport,
  toCookieHeader,
  toDraft,
  toSetDetails,
  validateDraft,
  type CookieDraft,
} from '../src/utils/cookie';

const base: CookieDraft = {
  name: 'sid',
  value: 'abc',
  domain: 'example.com',
  hostOnly: true,
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'lax',
  session: false,
  expirationDate: 2000000000,
};

describe('cookieUrl', () => {
  it('uses scheme by secure flag and drops leading dot', () => {
    expect(cookieUrl({ domain: '.example.com', path: '/a', secure: true })).toBe('https://example.com/a');
    expect(cookieUrl({ domain: 'localhost', secure: false })).toBe('http://localhost/');
  });
});

describe('toSetDetails', () => {
  it('omits domain for host-only cookies', () => {
    const d = toSetDetails(base, '0');
    expect(d.domain).toBeUndefined();
    expect(d.url).toBe('https://example.com/');
    expect(d.storeId).toBe('0');
    expect(d.expirationDate).toBe(2000000000);
  });

  it('passes domain for domain cookies', () => {
    const d = toSetDetails({ ...base, hostOnly: false, domain: '.example.com' });
    expect(d.domain).toBe('example.com');
    expect(d.url).toBe('https://example.com/');
  });

  it('omits expiration for session cookies', () => {
    expect(toSetDetails({ ...base, session: true }).expirationDate).toBeUndefined();
  });

  it('adds partition key', () => {
    const d = toSetDetails({ ...base, partitionTopLevelSite: 'https://top.com' });
    expect(d.partitionKey).toEqual({ topLevelSite: 'https://top.com' });
  });
});

describe('validateDraft', () => {
  it('accepts a valid draft', () => {
    expect(validateDraft(base)).toEqual([]);
  });

  it('requires secure for SameSite=None and partitioned cookies', () => {
    expect(validateDraft({ ...base, secure: false, sameSite: 'no_restriction' })).toContain(
      'errSameSiteNoneNeedsSecure',
    );
    expect(validateDraft({ ...base, secure: false, partitionTopLevelSite: 'https://a.com' })).toContain(
      'errPartitionedNeedsSecure',
    );
  });

  it('enforces cookie prefixes', () => {
    expect(validateDraft({ ...base, name: '__Host-x', hostOnly: false })).toContain('errHostPrefix');
    expect(validateDraft({ ...base, name: '__Host-x', path: '/a' })).toContain('errHostPrefix');
    expect(validateDraft({ ...base, name: '__Secure-x', secure: false })).toContain('errSecurePrefix');
  });

  it('rejects bad names, paths and missing expiry', () => {
    expect(validateDraft({ ...base, name: '' })).toContain('errNameRequired');
    expect(validateDraft({ ...base, name: 'a b' })).toContain('errNameInvalid');
    expect(validateDraft({ ...base, value: 'a;b' })).toContain('errValueInvalid');
    expect(validateDraft({ ...base, path: 'a' })).toContain('errPathInvalid');
    expect(validateDraft({ ...base, expirationDate: undefined })).toContain('errExpiryRequired');
  });
});

describe('toDraft / identityChanged', () => {
  it('maps chrome cookies', () => {
    const d = toDraft({
      name: 'a',
      value: '1',
      domain: '.example.com',
      hostOnly: false,
      path: '/',
      secure: false,
      httpOnly: false,
      sameSite: 'unspecified',
      session: true,
      storeId: '0',
    });
    expect(d.domain).toBe('example.com');
    expect(d.hostOnly).toBe(false);
    expect(d.session).toBe(true);
    expect(d.expirationDate).toBeUndefined();
  });

  it('detects identity changes', () => {
    expect(identityChanged(base, { ...base, value: 'x' })).toBe(false);
    expect(identityChanged(base, { ...base, name: 'x' })).toBe(true);
    expect(identityChanged(base, { ...base, path: '/x' })).toBe(true);
    expect(identityChanged(base, { ...base, hostOnly: false })).toBe(true);
  });
});

describe('import / export', () => {
  it('round-trips our export format', () => {
    const file = exportCookies([{ ...base, domain: 'example.com' }], 'https://example.com/');
    const parsed = parseImport(JSON.stringify(file));
    expect(parsed).toEqual([base]);
  });

  it('accepts chrome-style arrays', () => {
    const parsed = parseImport(
      JSON.stringify([{ name: 'a', value: 'b', domain: '.x.com', path: '/', sameSite: 'None', secure: true }]),
    );
    expect(parsed[0]).toMatchObject({ domain: 'x.com', hostOnly: false, sameSite: 'no_restriction', session: true });
  });

  it('rejects garbage', () => {
    expect(() => parseImport('{"a":1}')).toThrow();
    expect(() => parseImport('[{"value":1}]')).toThrow();
  });

  it('builds a Cookie header', () => {
    expect(toCookieHeader([{ name: 'a', value: '1' }, { name: 'b', value: '2' }])).toBe('a=1; b=2');
  });
});
