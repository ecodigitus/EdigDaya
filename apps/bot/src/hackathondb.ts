/**
 * Adapter DB GLOBAL HACKATHON (Postgres panitia) — khusus BACA (read-only).
 *
 * Beda dari db.ts (Supabase, DB milik bot). Ini DB bersama panitia yang kita
 * SELECT untuk data koperasi nasional. Pakai Bun.SQL bawaan (tanpa dependency
 * tambahan). Koneksi LAZY: dibuat saat query pertama, jadi bot tetap start walau
 * DB tak terjangkau.
 *
 * KEAMANAN (OWASP):
 * - Kredensial 100% dari .env (config.hackathonDb), tak pernah di-hardcode (A05).
 * - HANYA query SELECT yang ditulis di sini (tak ada INSERT/UPDATE/DELETE) — tak
 *   ada operasi destruktif ke DB bersama.
 * - Nilai di-parameter-kan lewat tagged template Bun.SQL (anti SQL injection, A03).
 * - Kolom sensitif (mis. NIK) TIDAK ditarik/ditampilkan mentah oleh pemanggil.
 */
import { SQL } from 'bun';
import { config } from './config';
import { logger } from './logger';

/** True kalau semua kredensial DB hackathon terisi. Kalau false → semua query no-op. */
export const hackathonDbEnabled =
  config.hackathonDb.host.length > 0 &&
  config.hackathonDb.database.length > 0 &&
  config.hackathonDb.username.length > 0 &&
  config.hackathonDb.password.length > 0;

let client: SQL | null = null;

/** Ambil koneksi (lazy singleton). null bila DB nonaktif. */
function db(): SQL | null {
  if (!hackathonDbEnabled) return null;
  if (!client) {
    const { host, port, database, username, password } = config.hackathonDb;
    // encode user/pass agar karakter spesial (mis. '@', '*') aman di URL.
    const url =
      `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}` +
      `@${host}:${port}/${database}?sslmode=prefer`;
    client = new SQL(url, { max: 3, idleTimeout: 20, connectionTimeout: 12 });
  }
  return client;
}

/** Statistik ringkas koperasi nasional (hanya total — tanpa data pribadi). */
export type StatistikGlobal = {
  anggota: number;
  pengurus: number;
  koperasi: number;
};

/**
 * Ambil TOTAL anggota, pengurus, dan koperasi se-nasional dalam satu query
 * (read-only, hanya count — tak menarik data pribadi apa pun). Kembalikan null
 * bila DB nonaktif / error (tak melempar).
 */
export async function statistikGlobal(): Promise<StatistikGlobal | null> {
  const sql = db();
  if (!sql) return null;
  try {
    const r = (await sql`
      select
        (select count(*) from anggota_koperasi)  as anggota,
        (select count(*) from pengurus_koperasi) as pengurus,
        (select count(*) from profil_koperasi)   as koperasi
    `) as Array<{ anggota: string | number; pengurus: string | number; koperasi: string | number }>;
    const row = r[0];
    if (!row) return null;
    // count() Postgres kembali sebagai bigint (string) → normalisasi ke number.
    return {
      anggota: Number(row.anggota),
      pengurus: Number(row.pengurus),
      koperasi: Number(row.koperasi),
    };
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'hackathonDb statistikGlobal gagal');
    return null;
  }
}
