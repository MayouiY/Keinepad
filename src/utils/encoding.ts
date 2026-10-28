/**
 * Character encodings offered for overriding how a page is decoded. `name` is the WHATWG
 * canonical name, i.e. what `document.characterSet` reports and what the charset parameter
 * of the overriding Content-Type header carries.
 */
export type EncodingGroup =
  | 'unicode'
  | 'zhHans'
  | 'zhHant'
  | 'ja'
  | 'ko'
  | 'western'
  | 'central'
  | 'southEuropean'
  | 'nordic'
  | 'baltic'
  | 'celtic'
  | 'romanian'
  | 'cyrillic'
  | 'greek'
  | 'turkish'
  | 'hebrew'
  | 'arabic'
  | 'vietnamese'
  | 'thai';

export interface EncodingInfo {
  name: string;
  /** Shown instead of `name` when the encoding is better known under another label. */
  label?: string;
  group: EncodingGroup;
  /** Listed at the top level of the context menu; the rest go under "More encodings". */
  common?: boolean;
}

export const ENCODINGS: EncodingInfo[] = [
  { name: 'UTF-8', group: 'unicode', common: true },
  { name: 'UTF-16LE', group: 'unicode' },
  { name: 'UTF-16BE', group: 'unicode' },
  // WHATWG maps GB2312 to GBK, ISO-8859-1 to windows-1252 and ISO-8859-9 to windows-1254.
  { name: 'GBK', label: 'GBK / GB2312', group: 'zhHans', common: true },
  { name: 'gb18030', label: 'GB18030', group: 'zhHans', common: true },
  { name: 'Big5', group: 'zhHant', common: true },
  { name: 'Shift_JIS', group: 'ja', common: true },
  { name: 'EUC-JP', group: 'ja', common: true },
  { name: 'ISO-2022-JP', group: 'ja' },
  { name: 'EUC-KR', group: 'ko', common: true },
  { name: 'windows-1252', label: 'windows-1252 / ISO-8859-1', group: 'western', common: true },
  { name: 'ISO-8859-15', group: 'western' },
  { name: 'macintosh', label: 'Mac Roman', group: 'western' },
  { name: 'windows-1250', group: 'central' },
  { name: 'ISO-8859-2', group: 'central' },
  { name: 'ISO-8859-3', group: 'southEuropean' },
  { name: 'ISO-8859-10', group: 'nordic' },
  { name: 'windows-1257', group: 'baltic' },
  { name: 'ISO-8859-4', group: 'baltic' },
  { name: 'ISO-8859-13', group: 'baltic' },
  { name: 'ISO-8859-14', group: 'celtic' },
  { name: 'ISO-8859-16', group: 'romanian' },
  { name: 'windows-1251', group: 'cyrillic' },
  { name: 'KOI8-R', group: 'cyrillic' },
  { name: 'KOI8-U', group: 'cyrillic' },
  { name: 'ISO-8859-5', group: 'cyrillic' },
  { name: 'IBM866', group: 'cyrillic' },
  { name: 'windows-1253', group: 'greek' },
  { name: 'ISO-8859-7', group: 'greek' },
  { name: 'windows-1254', label: 'windows-1254 / ISO-8859-9', group: 'turkish' },
  { name: 'windows-1255', group: 'hebrew' },
  { name: 'ISO-8859-8', group: 'hebrew' },
  { name: 'windows-1256', group: 'arabic' },
  { name: 'ISO-8859-6', group: 'arabic' },
  { name: 'windows-1258', group: 'vietnamese' },
  { name: 'windows-874', label: 'windows-874 / TIS-620', group: 'thai' },
];

export function encodingLabel(enc: EncodingInfo): string {
  return enc.label ?? enc.name;
}

/** Look up an encoding by name, case-insensitively (header values and characterSet vary in case). */
export function findEncoding(name: string | null | undefined): EncodingInfo | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return ENCODINGS.find((e) => e.name.toLowerCase() === n);
}

/** Extract the charset parameter of a Content-Type value, e.g. `text/html; charset="gbk"` → `gbk`. */
export function charsetOf(contentType: string): string | undefined {
  const m = /;\s*charset\s*=\s*("?)([^";\s]+)\1/i.exec(contentType);
  return m?.[2];
}

/** Encodings in display order, bucketed by group (insertion order of ENCODINGS is kept). */
export function groupEncodings(list: EncodingInfo[] = ENCODINGS): [EncodingGroup, EncodingInfo[]][] {
  const groups = new Map<EncodingGroup, EncodingInfo[]>();
  for (const enc of list) {
    const bucket = groups.get(enc.group);
    if (bucket) bucket.push(enc);
    else groups.set(enc.group, [enc]);
  }
  return [...groups];
}
