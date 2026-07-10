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
import { sdb } from "../sdb";
import { shared, team } from "../tables";
import { signSession, SESSION_TTL, type Session } from "../auth";
import { pagination, searchText, likePattern } from "../validate";

function expSec(): number {
  return Math.floor(Date.now() / 1000) + SESSION_TTL;
}

// Koperasi default untuk anggota WA yang belum punya koperasi_ref (daftar via bot
// murni). Dipakai agar halaman konten koperasi (produk/pengumuman/dll) ada isinya.
const WA_DEFAULT_KOPERASI = "KOP-78408FE6FFA4";

// POST /api/auth/login  { role: "pengurus", koperasi_ref } | { role: "anggota", anggota_ref }
route("POST", "/api/auth/login", async ({ req }) => {
  const body = await readJson<{ role?: string; koperasi_ref?: string; anggota_ref?: string; no_anggota?: string }>(req);
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

  if (body.role === "anggota_wa") {
    const no = String(body.no_anggota ?? "").trim();
    if (!no) return err(400, "no_anggota wajib diisi.");
    // Validasi identitas ke edig_dev_members (tabel tim). Konsisten dgn model bypass
    // Fase A (tanpa kata sandi) — scope no_anggota di-bake ke token bertanda-tangan.
    const [m] = await sdb`
      SELECT no_anggota, nama, koperasi_ref FROM ${sdb(team("members"))} WHERE no_anggota = ${no} LIMIT 1`;
    if (!m) return err(404, "Anggota digital (WA) tidak ditemukan.");
    const session: Session = {
      sub: `wa:${no}`,
      role: "anggota_wa",
      // anggota_ref = no_anggota agar anggotaScope() lolos saat memakai ulang
      // halaman/endpoint anggota nasional (query ke tabel nasional cukup kosong
      // bila tak match — bukan error). koperasi_ref default bila belum ada.
      koperasi_ref: m.koperasi_ref || WA_DEFAULT_KOPERASI,
      anggota_ref: no,
      no_anggota: no,
      nama: m.nama ?? no,
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

// GET /api/auth/anggota-wa?q= — picker anggota digital (edig_dev_members) untuk login WA.
route("GET", "/api/auth/anggota-wa", async ({ url }) => {
  const q = searchText(url.searchParams.get("q"));
  const { limit } = pagination(url, 20, 50);
  const where = q
    ? sdb`WHERE nama ILIKE ${likePattern(q)} OR no_anggota ILIKE ${likePattern(q)} OR phone ILIKE ${likePattern(q)}`
    : sdb``;
  const data = await sdb`
    SELECT no_anggota, nama, phone
    FROM ${sdb(team("members"))} ${where}
    ORDER BY updated_at DESC NULLS LAST LIMIT ${limit}`;
  return json({ data });
});
