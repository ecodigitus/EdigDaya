/** Tiny fetch wrapper: attaches the bearer token and normalizes errors. */

const TOKEN_KEY = "kop.token";

let authToken: string | null = null;
try {
  authToken = localStorage.getItem(TOKEN_KEY);
} catch {
  /* SSR / privacy mode */
}

export function getToken(): string | null {
  return authToken;
}

export function setToken(t: string | null): void {
  authToken = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Called on 401 so the app can bounce to the login screen. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body != null ? { "content-type": "application/json" } : {}),
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      onUnauthorized?.();
    }
    throw new ApiError(res.status, data?.error ?? `Permintaan gagal (${res.status}).`);
  }
  return data as T;
}
