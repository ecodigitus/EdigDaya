/**
 * Stateless session tokens: base64url(payload) + "." + base64url(HMAC-SHA256).
 * The tenant scope (koperasi_ref / anggota_ref) is baked into the SIGNED token,
 * so the client cannot tamper with it to reach another tenant (OWASP A01/A02).
 */
import { config } from "./config";

export type Role = "pengurus" | "anggota" | "anggota_wa";

export type Session = {
  sub: string; // subject: user id (Fase B) or "bypass:<ref>"
  role: Role;
  koperasi_ref: string; // tenant scope — required for pengurus/anggota; "" for pure-WA members
  anggota_ref?: string; // required for the anggota role
  no_anggota?: string; // required for the anggota_wa role (PK of edig_dev_members)
  nama?: string;
  exp: number; // epoch seconds
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function assertSecret(): string {
  if (!config.sessionSecret) {
    throw new Error("[auth] SESSION_SECRET belum diset di .env");
  }
  return config.sessionSecret;
}

let keyPromise: Promise<CryptoKey> | null = null;
function hmacKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    enc.encode(assertSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return keyPromise;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

export async function signSession(payload: Session): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token: string): Promise<Session | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig) as BufferSource, enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const payload = JSON.parse(dec.decode(fromB64url(body))) as Session;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Extract a Bearer token from the Authorization header. */
export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const [scheme, tok] = h.split(" ");
  return scheme?.toLowerCase() === "bearer" && tok ? tok : null;
}

/** Session lifetime, in seconds. */
export const SESSION_TTL = 8 * 60 * 60;
