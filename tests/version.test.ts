import { describe, expect, it } from 'vitest';
import { compareVersions, parseVersion } from '../src/utils/version';

describe('parseVersion', () => {
  it('accepts tags and manifest versions', () => {
    expect(parseVersion('v0.2.0')).toEqual([0, 2, 0]);
    expect(parseVersion('1.2.3.4')).toEqual([1, 2, 3, 4]);
    expect(parseVersion(' 3 ')).toEqual([3]);
  });

  it('rejects pre-release and malformed versions', () => {
    expect(parseVersion('1.0.0-beta')).toBeUndefined();
    expect(parseVersion('1.2.3.4.5')).toBeUndefined();
    expect(parseVersion('latest')).toBeUndefined();
  });
});

describe('compareVersions', () => {
  it('compares numerically, not lexically', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1);
    expect(compareVersions('v0.1.0', '0.2.0')).toBe(-1);
  });

  it('treats missing parts as zero', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0.1', '1.0')).toBe(1);
  });

  it('throws on invalid input', () => {
    expect(() => compareVersions('nightly', '1.0')).toThrow();
  });
});
