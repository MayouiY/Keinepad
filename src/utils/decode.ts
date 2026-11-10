/** Helpers for previewing opaque cookie / storage values. Each returns null when not applicable. */

export function tryUrlDecode(value: string): string | null {
  if (!/%[0-9a-f]{2}|\+/i.test(value)) return null;
  try {
    const decoded = decodeURIComponent(value.replace(/\+/g, ' '));
    return decoded === value ? null : decoded;
  } catch {
    return null;
  }
}

export function tryJsonPretty(value: string): string | null {
  const trimmed = value.trim();
  if (!/^[[{]/.test(trimmed)) return null;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
}

function base64UrlDecode(segment: string): string {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export interface DecodedJwt {
  header: unknown;
  payload: unknown;
  /** Expiry from the `exp` claim, in milliseconds since the epoch. */
  expiresAt?: number;
}

export function tryDecodeJwt(value: string): DecodedJwt | null {
  const token = value.trim().replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0].startsWith('eyJ')) return null;
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const exp = payload && typeof payload === 'object' ? (payload as { exp?: unknown }).exp : undefined;
    return { header, payload, expiresAt: typeof exp === 'number' ? exp * 1000 : undefined };
  } catch {
    return null;
  }
}

const encoder = new TextEncoder();

/** Size of `text` in UTF-8 bytes. */
export function byteSize(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Shorten a value for a one-line list cell or tooltip. Rows only ever show the beginning of a
 * value, but the browser would still shape (and keep in the DOM) all of it, which gets slow
 * with the multi-megabyte blobs some sites keep in storage.
 */
export function clip(text: string, max = 300): string {
  if (text.length <= max) return text;
  // Do not cut a surrogate pair (emoji and the like) in half.
  const end = (text.charCodeAt(max - 1) & 0xfc00) === 0xd800 ? max - 1 : max;
  return `${text.slice(0, end)}…`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
