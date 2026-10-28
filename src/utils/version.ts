/** Parse "v1.2.3" / "1.2" into numeric parts; undefined when it is not a dotted number. */
export function parseVersion(input: string): number[] | undefined {
  const m = input.trim().replace(/^v/i, '').match(/^\d+(\.\d+){0,3}$/);
  return m ? m[0].split('.').map(Number) : undefined;
}

/** Compare dotted versions like Chrome does (missing parts count as 0). Returns -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) throw new Error(`Invalid version: ${!pa ? a : b}`);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}
