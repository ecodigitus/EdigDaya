/**
 * Menu 11 — DAFTAR PENGURUS koperasi (lengkap + detail).
 *
 * Read-only: data diambil LIVE dari Supabase tabel `pengurus` tiap dibuka
 * (live-fetch), jadi perubahan susunan pengurus langsung tercermin di WA.
 * Kalau DB nonaktif → tampilkan pesan ramah (fallback aman).
 */
import { fetchAll, dbEnabled } from './db';
import { koperasi } from './business';

type Pengurus = {
  urutan: number;
  nama: string;
  jabatan: string;
  no_hp: string | null;
  wilayah: string | null;
};

/** Tampilkan daftar pengurus, diurutkan berdasarkan kolom `urutan`. */
export async function pengurusView(): Promise<string> {
  if (!dbEnabled) {
    return `👥 *Daftar Pengurus*\n\n_Data pengurus belum tersambung ke database. Hubungi pengurus untuk info._`;
  }

  const rows = (await fetchAll('pengurus')) as Pengurus[];
  if (rows.length === 0) {
    return `👥 *Daftar Pengurus*\n\nBelum ada data pengurus. _Jalankan supabase/menu-baru.sql dulu._`;
  }

  const sorted = [...rows].sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0));
  const body = sorted
    .map((p) => {
      const hp = p.no_hp ? `\n   📞 ${p.no_hp}` : '';
      const wil = p.wilayah ? ` · ${p.wilayah}` : '';
      return `*${p.jabatan}*${wil}\n   ${p.nama}${hp}`;
    })
    .join('\n\n');

  return (
    `👥 *Daftar Pengurus — ${koperasi.name}*\n\n` +
    `${body}\n\n` +
    `_Butuh bantuan langsung? Ketik *pengurus* untuk terhubung._`
  );
}
