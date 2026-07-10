/**
 * Tiny API router with per-route RBAC. Registered routes may require one or
 * more roles; when required, the request must carry a valid signed session
 * whose role is allowed. Handlers derive tenant scope from `ctx.session`,
 * never from client-supplied query/body values.
 */
import { err, rateLimit, serverError } from "./http";
import { bearer, verifySession, type Role, type Session } from "./auth";

export type Ctx = {
  req: Request;
  url: URL;
  params: Record<string, string>;
  session: Session | null;
};

type Handler = (ctx: Ctx) => Response | Promise<Response>;
type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler; roles?: readonly Role[] };

/** Minimal shape of Bun's Server we use — avoids the generic type argument. */
type ServerLike = { requestIP(req: Request): { address: string } | null };

const table: Route[] = [];

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const parts = path.split("/").map((seg) => {
    if (seg.startsWith(":")) {
      keys.push(seg.slice(1));
      return "([^/]+)";
    }
    return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  return { pattern: new RegExp(`^${parts.join("/")}$`), keys };
}

/** Register a route. Pass `roles` to require login + one of those roles. */
export function route(method: string, path: string, handler: Handler, roles?: readonly Role[]): void {
  const { pattern, keys } = compile(path);
  table.push({ method, pattern, keys, handler, roles });
}

export async function handleApi(req: Request, server?: ServerLike): Promise<Response> {
  let ip = "unknown";
  try {
    ip = server?.requestIP(req)?.address ?? req.headers.get("x-forwarded-for") ?? "unknown";
  } catch {
    /* ignore */
  }
  if (!rateLimit(ip)) return err(429, "Terlalu banyak permintaan, coba lagi sebentar.");

  const url = new URL(req.url);
  for (const r of table) {
    if (r.method !== req.method) continue;
    const m = r.pattern.exec(url.pathname);
    if (!m) continue;

    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? "")));

    let session: Session | null = null;
    const tok = bearer(req);
    if (tok) session = await verifySession(tok);

    if (r.roles && r.roles.length > 0) {
      if (!session) return err(401, "Sesi tidak valid, silakan login ulang.");
      if (!r.roles.includes(session.role)) return err(403, "Akses ditolak untuk peran ini.");
    }

    try {
      return await r.handler({ req, url, params, session });
    } catch (e) {
      return serverError(`${req.method} ${url.pathname}`, e);
    }
  }
  return err(404, "Endpoint tidak ditemukan.");
}
