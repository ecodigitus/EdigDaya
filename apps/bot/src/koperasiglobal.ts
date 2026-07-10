/**
 * Menu 14 — KOPERASI GLOBAL (data nasional dari DB panitia hackathon).
 *
 * POV anggota: hanya menampilkan RINGKASAN TOTAL (FYI) — tidak menampilkan data
 * pribadi siapa pun. Data ditarik LIVE dari DB hackathon (SELECT count, read-only).
 */
import { hackathonDbEnabled, statistikGlobal } from './hackathondb';

/** Tampilkan statistik total koperasi nasional (anggota, pengurus, koperasi). */
export async function koperasiGlobalView(): Promise<string> {
  if (!hackathonDbEnabled) {
    return (
      `🌐 *Koperasi Global*\n\n` +
      `_Fitur ini butuh koneksi ke database nasional. Set *DB_** di .env dulu ya._`
    );
  }

  const s = await statistikGlobal();
  if (!s) {
    return `⚠️ Gagal mengambil data dari database nasional. Coba lagi sebentar ya. 🙏`;
  }

  return (
    `🌐 *Koperasi Global — Data Nasional*\n` +
    `_Ringkasan koperasi se-Indonesia (sumber: database nasional)._\n\n` +
    `👥 Total anggota koperasi\n   *${fmt(s.anggota)}*\n\n` +
    `🧑‍💼 Total pengurus koperasi\n   *${fmt(s.pengurus)}*\n\n` +
    `🏢 Total koperasi terdaftar\n   *${fmt(s.koperasi)}*\n\n` +
    `_Data read-only, langsung dari sumber nasional._`
  );
}

/** Format angka ala Indonesia (74269 → "74.269"). */
function fmt(n: number): string {
  return n.toLocaleString('id-ID');
}
