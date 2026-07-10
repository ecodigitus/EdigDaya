/**
 * Adapter Supabase — DB bersama bot + dashboard web.
 *
 * Pola: SEED + WRITE-THROUGH (bukan baca live tiap saat).
 *   • hydrate  : saat start, muat data DB ke Map/objek in-memory yang sudah ada
 *                → semua fungsi read (getMember, listUserPo, ...) tetap SINKRON.
 *   • upsert   : saat data berubah, tulis balik ke DB (dipanggil fire-and-forget
 *                dari pemanggil sinkron → nol ripple async ke seluruh kode).
 *
 * KEAMANAN (OWASP A05): pakai SERVICE_ROLE key (server-side, bypass RLS). Key ini
 * HANYA hidup di proses bot (.env), tak pernah dikirim ke frontend. Kalau env
 * kosong → dbEnabled=false, bot jalan pakai data dummy in-memory (fallback aman).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';
import { logger } from './logger';

/** True kalau kredensial Supabase terisi. Kalau false, semua operasi DB no-op. */
export const dbEnabled = config.supabase.url.length > 0 && config.supabase.serviceRoleKey.length > 0;

const client: SupabaseClient | null = dbEnabled
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }, // bot bukan sesi user
    })
  : null;

/** Ambil semua baris sebuah tabel. Kembalikan [] bila DB nonaktif / error (tak melempar). */
export async function fetchAll(table: string): Promise<Record<string, any>[]> {
  if (!client) return [];
  const { data, error } = await client.from(table).select('*');
  if (error) {
    logger.error({ err: error.message, table }, 'Supabase fetchAll gagal');
    return [];
  }
  return data ?? [];
}

/**
 * Sisipkan satu baris (append-only) dan kembalikan baris yang tersimpan
 * (berisi kolom auto seperti id & created_at). Kembalikan null bila DB nonaktif
 * atau error (tak melempar) — pemanggil boleh fallback ke data lokal.
 */
export async function insertRow(table: string, row: Record<string, unknown>): Promise<Record<string, any> | null> {
  if (!client) return null;
  const { data, error } = await client.from(table).insert(row).select().single();
  if (error) {
    logger.error({ err: error.message, table }, 'Supabase insertRow gagal');
    return null;
  }
  return data ?? null;
}

/**
 * Upsert satu baris. Dipanggil fire-and-forget (pemanggil tak perlu await) —
 * error hanya di-log, tak pernah menggagalkan alur bot. No-op bila DB nonaktif.
 */
export function upsert(table: string, row: Record<string, unknown>, onConflict: string): void {
  if (!client) return;
  void client
    .from(table)
    .upsert(row, { onConflict })
    .then(({ error }) => {
      if (error) logger.error({ err: error.message, table }, 'Supabase upsert gagal');
    });
}
