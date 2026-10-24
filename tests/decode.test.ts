import { describe, expect, it } from 'vitest';
import { formatBytes, tryDecodeJwt, tryJsonPretty, tryUrlDecode } from '../src/utils/decode';

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
});
