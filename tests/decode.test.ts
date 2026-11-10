import { describe, expect, it } from 'vitest';
import { byteSize, clip, formatBytes, tryDecodeJwt, tryJsonPretty, tryUrlDecode } from '../src/utils/decode';

describe('decode helpers', () => {
  it('url-decodes only when it changes something', () => {
    expect(tryUrlDecode('a%20b')).toBe('a b');
    expect(tryUrlDecode('plain')).toBeNull();
    expect(tryUrlDecode('%E0%A4%A')).toBeNull();
  });

  it('pretty prints json', () => {
    expect(tryJsonPretty('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(tryJsonPretty('abc')).toBeNull();
  });

  it('decodes jwt', () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: '1', exp: 100 })}.sig`;
    const jwt = tryDecodeJwt(token);
    expect(jwt?.payload).toEqual({ sub: '1', exp: 100 });
    expect(jwt?.expiresAt).toBe(100000);
    expect(tryDecodeJwt('a.b.c')).toBeNull();
  });

  it('formats bytes', () => {
    expect(formatBytes(10)).toBe('10 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('measures utf-8 bytes', () => {
    expect(byteSize('')).toBe(0);
    expect(byteSize('abc')).toBe(3);
    expect(byteSize('中文')).toBe(6);
  });

  it('clips long values for list cells', () => {
    expect(clip('short')).toBe('short');
    expect(clip('x'.repeat(300))).toBe('x'.repeat(300));
    expect(clip('x'.repeat(301))).toBe(`${'x'.repeat(300)}…`);
    expect(clip('abcdef', 3)).toBe('abc…');
    // A cut never leaves half of a surrogate pair behind.
    expect(clip('ab😀cd', 3)).toBe('ab…');
    expect(clip('ab😀cd', 4)).toBe('ab😀…');
  });
});
