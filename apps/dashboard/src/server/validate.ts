/** Query-param validation & whitelisting helpers (OWASP A03/A04). */

export function clampInt(v: string | null, def: number, min: number, max: number): number {
  if (v == null || v.trim() === "") return def;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export type Pagination = { limit: number; offset: number; page: number };

export function pagination(url: URL, defLimit = 20, maxLimit = 100): Pagination {
  const limit = clampInt(url.searchParams.get("limit"), defLimit, 1, maxLimit);
  const page = clampInt(url.searchParams.get("page"), 1, 1, 100_000);
  return { limit, offset: (page - 1) * limit, page };
}

/** Return the value only if present in `allowed`, else `fallback`. */
export function oneOf<T extends string>(
  v: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return v != null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Optional whitelisted value: the value if allowed, else null (= no filter). */
export function optionalOneOf<T extends string>(
  v: string | null | undefined,
  allowed: readonly T[],
): T | null {
  return v != null && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** Trim + cap free-text search; returns null when empty. */
export function searchText(v: string | null | undefined, maxLen = 80): string | null {
  const s = (v ?? "").trim().slice(0, maxLen);
  return s === "" ? null : s;
}

/** Case-insensitive LIKE pattern with wildcards escaped. */
export function likePattern(s: string): string {
  return "%" + s.replace(/[\\%_]/g, "\\$&") + "%";
}
