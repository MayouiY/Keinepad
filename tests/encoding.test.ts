import { describe, expect, it } from 'vitest';
import { ENCODINGS, charsetOf, findEncoding, groupEncodings } from '../src/utils/encoding';

describe('encoding utils', () => {
  it('reads the charset parameter of a Content-Type value', () => {
    expect(charsetOf('text/html; charset=GBK')).toBe('GBK');
    expect(charsetOf('text/html;charset="shift_jis"')).toBe('shift_jis');
    expect(charsetOf('text/plain; format=flowed; Charset=utf-8')).toBe('utf-8');
    expect(charsetOf('text/html')).toBeUndefined();
  });

  it('finds encodings case-insensitively by canonical name', () => {
    expect(findEncoding('gbk')?.name).toBe('GBK');
    expect(findEncoding('GB18030')?.name).toBe('gb18030');
    expect(findEncoding(' Shift_JIS ')?.group).toBe('ja');
    expect(findEncoding('x-unknown')).toBeUndefined();
    expect(findEncoding(undefined)).toBeUndefined();
  });

  it('covers the common encodings without duplicates', () => {
    const names = ENCODINGS.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const n of ['utf-8', 'gbk', 'gb18030', 'big5', 'shift_jis', 'euc-jp', 'euc-kr', 'windows-1252', 'iso-8859-2', 'koi8-r']) {
      expect(names).toContain(n);
    }
  });

  it('groups encodings in list order', () => {
    const groups = groupEncodings();
    expect(groups[0][0]).toBe('unicode');
    expect(groups.find(([g]) => g === 'ja')?.[1].map((e) => e.name)).toEqual(['Shift_JIS', 'EUC-JP', 'ISO-2022-JP']);
    expect(groups.reduce((n, [, list]) => n + list.length, 0)).toBe(ENCODINGS.length);
  });
});
