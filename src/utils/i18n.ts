import type en from '../../public/_locales/en/messages.json';

export type MessageKey = keyof typeof en;

/** Translate via chrome.i18n; falls back to the key so missing strings are visible. */
export function t(key: MessageKey, substitutions?: string | (string | number)[]): string {
  const subs = Array.isArray(substitutions) ? substitutions.map(String) : substitutions;
  return chrome.i18n.getMessage(key, subs) || key;
}

export const uiLanguage = chrome.i18n.getUILanguage();

const dateTimeFormat = new Intl.DateTimeFormat(uiLanguage, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function formatDateTime(ms: number): string {
  return dateTimeFormat.format(new Date(ms));
}

const relativeFormat = new Intl.RelativeTimeFormat(uiLanguage, { numeric: 'auto' });

/** Short relative description such as "in 3 days" / "2 hours ago". */
export function formatRelative(ms: number): string {
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
