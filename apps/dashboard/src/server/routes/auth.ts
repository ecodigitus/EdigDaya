/**
 * Auth routes.
 *
 * Fase A: bypass login — the client picks a role and a koperasi/anggota, and
 * we mint a signed session carrying the tenant scope. Even in bypass mode the
 * scope is validated against the DB and baked into the SIGNED token, so it
 * can't be tampered with (OWASP A01). Fase B replaces this with real
 * credential auth against the team `users` table.
 */
import { route } from "../router";
import { json, err, readJson } from "../http";
import { db } from "../db";
import { shared } from "../tables";
import { signSession, SESSION_TTL, type Session } from "../auth";
import { pagination, searchText, likePattern } from "../validate";

function expSec(): number {
  return Math.floor(Date.now() / 1000) + SESSION_TTL;
}

// POST /api/auth/login  { role: "pengurus", koperasi_ref } | { role: "anggota", anggota_ref }
route("POST", "/api/auth/login", async ({ req }) => {
  const body = await readJson<{ role?: string; koperasi_ref?: string; anggota_ref?: string }>(req);
  if (!body) return err(400, "Body permintaan tidak valid.");

  if (body.role === "pengurus") {
    const ref = String(body.koperasi_ref ?? "").trim();
    if (!ref) return err(400, "koperasi_ref wajib diisi.");
    const [k] = await db`
      SELECT koperasi_ref, nama_koperasi
      FROM ${db(shared("profil_koperasi"))} WHERE koperasi_ref = ${ref} LIMIT 1`;
    if (!k) return err(404, "Koperasi tidak ditemukan.");
    const session: Session = {
      sub: `bypass:${ref}`,
      role: "pengurus",
      koperasi_ref: ref,
      nama: k.nama_koperasi ?? ref,
      exp: expSec(),
    };
    return json({ token: await signSession(session), session });
  }

  if (body.role === "anggota") {
    const ref = String(body.anggota_ref ?? "").trim();
    if (!ref) return err(400, "anggota_ref wajib diisi.");
    const [a] = await db`
      SELECT anggota_ref, koperasi_ref, nama
      FROM ${db(shared("anggota_koperasi"))} WHERE anggota_ref = ${ref} LIMIT 1`;
    if (!a) return err(404, "Anggota tidak ditemukan.");
    if (!a.koperasi_ref) return err(409, "Anggota tidak terhubung ke koperasi.");
    const session: Session = {
      sub: `bypass:${ref}`,
      role: "anggota",
      koperasi_ref: a.koperasi_ref,
      anggota_ref: ref,
      nama: a.nama ?? ref,
      exp: expSec(),
    };
    return json({ token: await signSession(session), session });
  }

  return err(400, "Peran tidak valid.");
});

// GET /api/auth/me — echo the current session (null if not logged in).
route("GET", "/api/auth/me", async ({ session }) => json({ session }));

// GET /api/auth/koperasi?q= — searchable koperasi picker for the login screen.
route("GET", "/api/auth/koperasi", async ({ url }) => {
  const q = searchText(url.searchParams.get("q"));
  const { limit } = pagination(url, 20, 50);
  const where = q
    ? db`WHERE nama_koperasi ILIKE ${likePattern(q)} OR koperasi_ref ILIKE ${likePattern(q)}`
    : db``;
  const data = await db`
    SELECT koperasi_ref, nama_koperasi
    FROM ${db(shared("profil_koperasi"))} ${where}
    ORDER BY nama_koperasi ASC LIMIT ${limit}`;
  return json({ data });
});

// GET /api/auth/anggota?koperasi_ref=&q= — anggota picker within a koperasi (bypass login only).
route("GET", "/api/auth/anggota", async ({ url }) => {
  const koperasiRef = (url.searchParams.get("koperasi_ref") ?? "").trim();
  if (!koperasiRef) return err(400, "koperasi_ref wajib diisi.");
  const q = searchText(url.searchParams.get("q"));
  const { limit } = pagination(url, 20, 50);
  const where = q
    ? db`WHERE koperasi_ref = ${koperasiRef} AND (nama ILIKE ${likePattern(q)} OR anggota_ref ILIKE ${likePattern(q)})`
    : db`WHERE koperasi_ref = ${koperasiRef}`;
  const data = await db`
    SELECT anggota_ref, nama, status_keanggotaan
    FROM ${db(shared("anggota_koperasi"))} ${where}
    ORDER BY nama ASC LIMIT ${limit}`;
  return json({ data });
});
