/**
 * Menu 12 — PENGUMUMAN koperasi.
 *
 * Read-only: live-fetch dari Supabase tabel `pengumuman` tiap dibuka, urut dari
 * yang terbaru. Pengurus posting lewat dashboard/SQL → anggota langsung lihat.
 */
import { fetchAll, dbEnabled } from './db';
import { koperasi } from './business';

type Pengumuman = {
  judul: string;
  isi: string;
  penting: boolean;
  penulis: string | null;
  created_at: string;
};

const MAX_TAMPIL = 5; // batasi biar pesan WA tak kepanjangan

/** Tanggal ISO → format Indonesia singkat (mis. "28 Feb 2026"). */
function tanggalId(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Tampilkan pengumuman terbaru (maksimal MAX_TAMPIL). */
export async function pengumumanView(): Promise<string> {
  if (!dbEnabled) {
    return `📢 *Pengumuman*\n\n_Belum tersambung ke database. Hubungi pengurus untuk info terbaru._`;
  }

  const rows = (await fetchAll('pengumuman')) as Pengumuman[];
  if (rows.length === 0) {
    return `📢 *Pengumuman*\n\nBelum ada pengumuman. _Jalankan supabase/menu-baru.sql dulu._`;
  }

  const sorted = [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const shown = sorted.slice(0, MAX_TAMPIL);

  const body = shown
    .map((p) => {
      const tag = p.penting ? '📌 ' : '';
      const tgl = tanggalId(p.created_at);
      const meta = [tgl, p.penulis].filter(Boolean).join(' · ');
      return `${tag}*${p.judul}*\n${p.isi}${meta ? `\n_${meta}_` : ''}`;
    })
    .join('\n\n━━━━━━━━━━━━━━\n\n');

  const sisa = sorted.length - shown.length;
  const footer = sisa > 0 ? `\n\n_+${sisa} pengumuman lama lainnya._` : '';

  return `📢 *Pengumuman — ${koperasi.name}*\n\n${body}${footer}`;
}
