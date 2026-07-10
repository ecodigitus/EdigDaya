/**
 * HTTP helpers: security headers, JSON/error responses, and a simple
 * in-memory per-IP rate limiter. (OWASP A05/A04.)
 */
import { config } from "./config";

/** Security headers applied to every API response. */
export function securityHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cache-Control": "no-store",
  };
  if (config.isProd) {
    h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return h;
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/** Generic client error — never leak internal details. */
export function err(status: number, message: string, extra?: Record<string, unknown>): Response {
  return json({ error: message, ...extra }, { status });
}

/** Log a server-side error with context; return a generic 500. */
export function serverError(where: string, e: unknown): Response {
  console.error(`[error] ${where}:`, e);
  return err(500, "Terjadi kesalahan pada server.");
}

/** Parse a JSON body with a size guard. Returns null on error/oversize. */
export async function readJson<T = unknown>(req: Request, maxBytes = 16_384): Promise<T | null> {
  const len = req.headers.get("content-length");
  if (len && Number(len) > maxBytes) return null;
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ---- Rate limiter (fixed window per IP) ----
const WINDOW_MS = 60_000;
const MAX_REQ = 300;
const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  rec.count += 1;
  return rec.count <= MAX_REQ;
}
