import { describe, expect, it } from 'vitest';
import { classifyUrl, domainMatches, pickSiteRoot, stripLeadingDot } from '../src/utils/domain';

describe('domain utils', () => {
  it('strips the leading dot', () => {
    expect(stripLeadingDot('.example.com')).toBe('example.com');
    expect(stripLeadingDot('example.com')).toBe('example.com');
  });

  it('domain-matches hosts and subdomains only', () => {
    expect(domainMatches('.example.com', 'a.example.com')).toBe(true);
    expect(domainMatches('example.com', 'example.com')).toBe(true);
    expect(domainMatches('example.com', 'badexample.com')).toBe(false);
    expect(domainMatches('a.example.com', 'example.com')).toBe(false);
  });

  it('picks the widest applicable cookie domain as site root', () => {
    expect(pickSiteRoot('a.b.example.co.uk', ['.example.co.uk', 'a.b.example.co.uk'])).toBe('example.co.uk');
    expect(pickSiteRoot('app.example.com', [])).toBe('app.example.com');
    // Unrelated domains never widen the root.
    expect(pickSiteRoot('app.example.com', ['.other.com', 'com'])).toBe('app.example.com');
  });

  it('classifies urls', () => {
    expect(classifyUrl('https://example.com/a')).toBe('ok');
    expect(classifyUrl('http://localhost:5173/')).toBe('ok');
    expect(classifyUrl('chrome://settings')).toBe('restricted');
    expect(classifyUrl('edge://newtab')).toBe('restricted');
    expect(classifyUrl('https://chromewebstore.google.com/detail/x')).toBe('restricted');
    expect(classifyUrl('https://chrome.google.com/webstore/detail/x')).toBe('restricted');
    expect(classifyUrl('file:///tmp/a.html')).toBe('file');
    expect(classifyUrl(undefined)).toBe('invalid');
    expect(classifyUrl('not a url')).toBe('invalid');
  });
});
