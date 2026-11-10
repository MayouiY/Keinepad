import type en from '../../public/_locales/en/messages.json';

export type MessageKey = keyof typeof en;

/** Translate via chrome.i18n; falls back to the key so missing strings are visible. */
export function t(key: MessageKey, substitutions?: string | (string | number)[]): string {
  const subs = Array.isArray(substitutions) ? substitutions.map(String) : substitutions;
  return chrome.i18n.getMessage(key, subs) || key;
}

// The formatters are built on first use: the first one created in a fresh extension process
// takes around 10 ms while the browser loads its locale data, and this module is also loaded
// by the service worker, which never formats a date, and by the pages before they are shown.
let dateTimeFormat: Intl.DateTimeFormat | undefined;
let relativeFormat: Intl.RelativeTimeFormat | undefined;

export function formatDateTime(ms: number): string {
  dateTimeFormat ??= new Intl.DateTimeFormat(chrome.i18n.getUILanguage(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return dateTimeFormat.format(new Date(ms));
}

/** Short relative description such as "in 3 days" / "2 hours ago". */
export function formatRelative(ms: number): string {
  relativeFormat ??= new Intl.RelativeTimeFormat(chrome.i18n.getUILanguage(), { numeric: 'auto' });
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 3600e3],
    ['month', 30 * 24 * 3600e3],
    ['day', 24 * 3600e3],
    ['hour', 3600e3],
    ['minute', 60e3],
  ];
  for (const [unit, size] of units) {
    if (abs >= size) return relativeFormat.format(Math.round(diff / size), unit);
  }
  return relativeFormat.format(Math.round(diff / 1000), 'second');
}
