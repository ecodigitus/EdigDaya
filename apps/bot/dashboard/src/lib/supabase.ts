import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase untuk frontend. HANYA pakai anon key (aman dipublikasikan,
 * dibatasi RLS). service_role key tidak boleh ada di sini.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // Bukan melempar error biar app tetap render & bisa kasih pesan ke user.
  console.warn('⚠️ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi di dashboard/.env');
}

export const supabase = createClient(url ?? '', anon ?? '');
export const supabaseReady = Boolean(url && anon);
