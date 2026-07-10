/**
 * Adapter DB BOT — Google Cloud SQL (PostgreSQL) via Bun.SQL.
 * Menggantikan Supabase untuk sisi BOT (dashboard menyusul, masih Supabase).
 *
 * API (fetchAll/selectWhere/insertRow/upsert/unlinkPhone) DIPERTAHANKAN sama
 * seperti versi Supabase → modul lain (members, preorder, laporan) tak berubah.
 *
 * KEAMANAN (OWASP A03/A05):
 * - Kredensial 100% dari .env (config.cloudsql), tak pernah di-hardcode.
 * - Nilai selalu di-parameter-kan ($1,$2,...) → anti SQL injection. Nama tabel/
 *   kolom berasal dari kode (literal tepercaya), bukan input user, & di-quote.
 * - Koneksi LAZY: dibuat saat query pertama; bot tetap start walau DB tak dijangkau.
 *
 * Catatan: query INSERT/UPDATE ditulis eksplisit (sql.unsafe + placeholder) —
 * helper sql(object) Bun.SQL kurang andal dgn nama tabel dinamis. Nilai objek/
 * array di-encode manual sebagai jsonb (JSON.stringify + cast ::jsonb).
 */
import { SQL } from 'bun';
import { config } from './config';
import { logger } from './logger';

/** True kalau kredensial Cloud SQL terisi. Kalau false, semua operasi DB no-op. */
export const dbEnabled =
  config.cloudsql.host.length > 0 &&
  config.cloudsql.database.length > 0 &&
  config.cloudsql.username.length > 0 &&
  config.cloudsql.password.length > 0;

let client: SQL | null = null;

/** Koneksi lazy singleton ke Cloud SQL. null bila DB nonaktif. */
function db(): SQL | null {
  if (!dbEnabled) return null;
  if (!client) {
    const { host, port, database, username, password } = config.cloudsql;
    const url =
      `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}` +
      `@${host}:${port}/${database}?sslmode=prefer`;
    client = new SQL(url, { max: 5, idleTimeout: 20, connectionTimeout: 12 });
  }
  return client;
}

/** Nama tabel + prefix tim (mis. "edig_dev_members"), di-quote sebagai identifier. */
function tbl(name: string): string {
  return ident(config.cloudsql.tablePrefix + name);
}

/** Quote identifier Postgres (nama tabel/kolom dari kode, bukan input user). */
function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** True bila nilai perlu disimpan sebagai jsonb (objek/array non-null). */
function isJson(v: unknown): boolean {
  return v !== null && typeof v === 'object';
}

/** Encode nilai untuk parameter: objek/array → JSON string (buat kolom jsonb). */
function encode(v: unknown): unknown {
  return isJson(v) ? JSON.stringify(v) : v;
}

/** Placeholder $n dgn cast ::jsonb bila nilainya objek/array. */
function placeholders(vals: unknown[]): string {
  return vals.map((v, i) => (isJson(v) ? `$${i + 1}::jsonb` : `$${i + 1}`)).join(', ');
}

/** Ambil semua baris sebuah tabel. Kembalikan [] bila DB nonaktif / error (tak melempar). */
export async function fetchAll(table: string): Promise<Record<string, any>[]> {
  const sql = db();
  if (!sql) return [];
  try {
    return (await sql.unsafe(`select * from ${tbl(table)}`)) as Record<string, any>[];
  } catch (e) {
    logger.error({ err: (e as Error).message, table }, 'CloudSQL fetchAll gagal');
    return [];
  }
}

/**
 * Ambil baris yang cocok dengan SEMUA filter (eq). Kembalikan [] bila DB nonaktif
 * / error. Kunci filter berasal dari kode (tepercaya); nilai di-parameter-kan.
 */
export async function selectWhere(
  table: string,
  filters: Record<string, unknown>,
): Promise<Record<string, any>[]> {
  const sql = db();
  if (!sql) return [];
  try {
    const keys = Object.keys(filters);
    const where = keys.map((k, i) => `${ident(k)} = $${i + 1}`).join(' and ');
    const q = `select * from ${tbl(table)}` + (keys.length ? ` where ${where}` : '');
    return (await sql.unsafe(q, keys.map((k) => filters[k]))) as Record<string, any>[];
  } catch (e) {
    logger.error({ err: (e as Error).message, table }, 'CloudSQL selectWhere gagal');
    return [];
  }
}

/**
 * Sisipkan satu baris & kembalikan baris tersimpan (id/created_at). null bila
 * DB nonaktif / error (tak melempar).
 */
export async function insertRow(table: string, row: Record<string, unknown>): Promise<Record<string, any> | null> {
  const sql = db();
  if (!sql) return null;
  try {
    const keys = Object.keys(row);
    const params = keys.map((k) => encode(row[k]));
    const cols = keys.map((k) => ident(k)).join(', ');
    const q = `insert into ${tbl(table)} (${cols}) values (${placeholders(params)}) returning *`;
    const res = (await sql.unsafe(q, params)) as Record<string, any>[];
    return res[0] ?? null;
  } catch (e) {
    logger.error({ err: (e as Error).message, table }, 'CloudSQL insertRow gagal');
    return null;
  }
}

/**
 * Upsert satu baris (INSERT ... ON CONFLICT DO UPDATE SET col=excluded.col).
 * Fire-and-forget: error hanya di-log, tak menggagalkan alur bot. No-op bila DB nonaktif.
 */
export function upsert(table: string, row: Record<string, unknown>, onConflict: string): void {
  const sql = db();
  if (!sql) return;
  const keys = Object.keys(row);
  const params = keys.map((k) => encode(row[k]));
  const cols = keys.map((k) => ident(k)).join(', ');
  const updateCols = keys.filter((k) => k !== onConflict);
  const setClause = updateCols.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(', ');
  const q =
    `insert into ${tbl(table)} (${cols}) values (${placeholders(params)}) ` +
    `on conflict (${ident(onConflict)}) ` +
    (setClause ? `do update set ${setClause}` : 'do nothing');
  void sql.unsafe(q, params).then(
    () => {},
    (e: Error) => logger.error({ err: e.message, table }, 'CloudSQL upsert gagal'),
  );
}

/**
 * Lepaskan `phone` dari anggota LAIN (set null) — kolom phone UNIQUE, jadi saat
 * satu nomor WA mendaftar sebagai anggota baru (mis. demo ulang di HP sama) nomor
 * "dipindahkan" ke anggota baru tanpa bentrok. Non-destruktif (unlink saja).
 */
export async function unlinkPhone(phone: string, exceptNoAnggota: string): Promise<void> {
  const sql = db();
  if (!sql) return;
  try {
    await sql.unsafe(
      `update ${tbl('members')} set phone = null where phone = $1 and no_anggota <> $2`,
      [phone, exceptNoAnggota],
    );
  } catch (e) {
    logger.error({ err: (e as Error).message }, 'CloudSQL unlinkPhone gagal');
  }
}
