/**
 * Menu 13 — ANGGOTA JAGA ANGGOTA (watchdog transparansi).
 *
 * Konsep: anggota bisa melaporkan kejanggalan/dugaan penyelewengan. Laporan:
 *   1) disimpan APPEND-ONLY di Supabase `laporan_transparansi` — tak bisa
 *      dihapus/diubah admin (dijaga trigger DB) → anti-tutup-mulut.
 *   2) bisa dibaca SEMUA anggota kapan saja (ketik "daftar laporan") → transparan.
 *   3) disiarkan sebagai notifikasi ke semua anggota, tapi DI-THROTTLE (dijeda
 *      antar pesan) — bukan blast serentak — supaya nomor bot aman dari ban WA.
 *
 * Keamanan/etika (OWASP, UU PDP 27/2022, UU ITE):
 * - Opsi ANONIM: identitas pelapor tak disimpan (null) demi perlindungan pelapor.
 * - Status awal 'BELUM_DIVERIFIKASI' & ditampilkan jelas → kurangi risiko fitnah.
 * - Isi laporan tak di-log ke history AI/logger.
 */
import { insertRow, fetchAll, dbEnabled } from './db';
import { allMemberJids, type Member } from './members';
import { scheduleNotif } from './notifications';

type LaporStep = 'entry' | 'kategori' | 'isi' | 'anonim' | 'confirm';
type LaporDraft = {
  step: LaporStep;
  kategori?: string;
  isi?: string;
  anonim?: boolean;
};

const drafts = new Map<string, LaporDraft>();

const KATEGORI = ['Keuangan', 'Pelayanan', 'Dugaan penyelewengan', 'Lainnya'];
const MAX_ISI = 800;
const MAX_TAMPIL = 10; // batas laporan yang ditampilkan di daftar

// Throttle broadcast: jeda antar penerima agar tak terdeteksi spam oleh WA.
const NOTIF_BASE_DELAY = 2; // detik sebelum penerima pertama
const NOTIF_GAP = 5; // detik jeda antar penerima

/** True jika user sedang di alur menu/lapor transparansi. */
export function inLaporan(jid: string): boolean {
  return drafts.has(jid);
}

/** Batalkan alur laporan yang sedang berjalan. */
export function cancelLaporan(jid: string): void {
  drafts.delete(jid);
}

/** Buka menu 13 — sub-pilihan lihat / buat laporan. */
export function startLaporan(jid: string): string {
  drafts.set(jid, { step: 'entry' });
  return (
    `🛡️ *Anggota Jaga Anggota*\n` +
    `_Program transparansi & saling jaga._\n\n` +
    `Kamu bisa melaporkan kejanggalan (keuangan, pelayanan, dugaan penyelewengan). ` +
    `Laporan *tidak bisa dihapus/diubah* pengurus dan *bisa dibaca semua anggota* — jadi tak ada yang bisa ditutupi. ` +
    `Semua anggota juga otomatis dapat salinannya.\n\n` +
    `Mau apa? (balas angka)\n` +
    `1. 📋 Lihat daftar laporan\n` +
    `2. 📢 Buat laporan baru\n\n` +
    `_Ketik *batal* untuk berhenti._`
  );
}

/** Proses satu input pada alur laporan. `m` = pelapor (untuk identitas non-anonim). */
export async function handleLaporan(jid: string, m: Member, text: string): Promise<string> {
  const d = drafts.get(jid);
  if (!d) return startLaporan(jid);

  const raw = text.trim();
  const low = raw.toLowerCase();
  if (low === 'batal' || low === 'keluar') {
    drafts.delete(jid);
    return '❌ Oke, dibatalkan. Ketik *menu* untuk pilihan lain ya.';
  }

  switch (d.step) {
    case 'entry': {
      const v = parseChoice(raw, ['Lihat daftar laporan', 'Buat laporan baru']);
      if (!v) return err('Pilih *1* (lihat daftar) atau *2* (buat laporan).');
      if (v === 'Lihat daftar laporan') {
        drafts.delete(jid);
        return listLaporan();
      }
      d.step = 'kategori';
      return `📢 *Buat Laporan*\n\nPilih *kategori* (balas angka):\n${renderChoices(KATEGORI)}`;
    }
    case 'kategori': {
      const v = parseChoice(raw, KATEGORI);
      if (!v) return err(`Pilih kategori (balas angka):\n${renderChoices(KATEGORI)}`);
      d.kategori = v;
      d.step = 'isi';
      return `✍️ Tulis *isi laporan* kamu sejelas mungkin (maks ${MAX_ISI} karakter).\n_Sertakan apa, kapan, dan bukti bila ada._`;
    }
    case 'isi': {
      if (raw.length < 10) return err('Laporan terlalu singkat. Tulis lebih jelas ya (min 10 karakter).');
      if (raw.length > MAX_ISI) return err(`Laporan kepanjangan (maks ${MAX_ISI} karakter). Ringkas dulu ya.`);
      d.isi = raw;
      d.step = 'anonim';
      return (
        `🕵️ Mau lapor sebagai *anonim*?\n\n` +
        `1. Ya, sembunyikan identitasku _(nama tak disimpan/ditampilkan)_\n` +
        `2. Tidak, tampilkan namaku *(${m.nama})*`
      );
    }
    case 'anonim': {
      const v = parseChoice(raw, ['Ya anonim', 'Tidak pakai nama']);
      if (!v) return err('Pilih *1* (anonim) atau *2* (pakai nama).');
      d.anonim = v === 'Ya anonim';
      d.step = 'confirm';
      return ringkasan(d, m);
    }
    case 'confirm': {
      if (['ulang', 'ubah', 'edit'].includes(low)) {
        drafts.set(jid, { step: 'kategori' });
        return `Oke, ulang dari kategori ya.\n\nPilih *kategori* (balas angka):\n${renderChoices(KATEGORI)}`;
      }
      if (!['ya', 'kirim', 'ok', 'oke', 'submit', 'benar', 'betul'].includes(low)) {
        return `Ketik *kirim* untuk mengirim laporan, *ulang* untuk ubah, atau *batal*.`;
      }
      return kirim(jid, d, m);
    }
  }
}

/** Simpan laporan (append-only) + siarkan ke semua anggota (throttled). */
async function kirim(jid: string, d: LaporDraft, m: Member): Promise<string> {
  if (!dbEnabled) {
    return `⚠️ Fitur laporan butuh koneksi database. Set *SUPABASE_** di .env dulu ya. (Ketik *batal* untuk kembali.)`;
  }

  const phone = jid.split('@')[0] ?? '';
  const row = {
    kategori: d.kategori,
    isi: d.isi,
    anonim: d.anonim === true,
    pelapor_nama: d.anonim ? null : m.nama,
    pelapor_no: d.anonim ? null : phone, // anonim → tak disimpan (perlindungan pelapor / UU PDP)
    status: 'BELUM_DIVERIFIKASI',
  };

  const saved = await insertRow('laporan_transparansi', row);
  if (!saved) {
    // Draft tetap di 'confirm' agar bisa coba kirim ulang.
    return `⚠️ Maaf, gagal menyimpan laporan. Ketik *kirim* untuk coba lagi, atau *batal*.`;
  }
  drafts.delete(jid);

  // Siarkan ke semua anggota LAIN, di-throttle (jeda bertahap) agar aman dari ban WA.
  const pelapor = d.anonim ? 'Anonim' : m.nama;
  const broadcast = broadcastText(saved.id, d.kategori!, d.isi!, pelapor);
  const targets = allMemberJids(jid);
  targets.forEach((t, i) => scheduleNotif(t, broadcast, NOTIF_BASE_DELAY + i * NOTIF_GAP));

  return (
    `✅ *Laporan #${saved.id} terkirim!*\n\n` +
    `Kategori: ${d.kategori}\n` +
    `Pelapor: ${pelapor}\n` +
    `Status: Belum diverifikasi\n\n` +
    `🔒 Laporan ini *permanen* — tak bisa dihapus/diubah pengurus.\n` +
    `📡 Salinannya sedang dikirim ke *${targets.length} anggota* lain (bertahap).\n\n` +
    `Semua anggota bisa lihat lewat *daftar laporan*. Simpan chat ini sebagai bukti ya. 🙏`
  );
}

/** Tampilkan daftar laporan terbaru (semua anggota boleh baca). */
export async function listLaporan(): Promise<string> {
  if (!dbEnabled) {
    return `🛡️ *Daftar Laporan*\n\n_Belum tersambung ke database._`;
  }
  const rows = (await fetchAll('laporan_transparansi')) as Array<{
    id: number;
    kategori: string;
    isi: string;
    anonim: boolean;
    pelapor_nama: string | null;
    status: string;
    created_at: string;
  }>;
  if (rows.length === 0) {
    return `🛡️ *Daftar Laporan*\n\nBelum ada laporan. Jadilah yang pertama menjaga transparansi — ketik *lapor*. 🙌`;
  }

  const sorted = [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const shown = sorted.slice(0, MAX_TAMPIL);
  const body = shown
    .map((r) => {
      const pelapor = r.anonim ? 'Anonim' : r.pelapor_nama || 'Anggota';
      return (
        `*#${r.id}* · ${r.kategori} · _${statusLabel(r.status)}_\n` +
        `"${potong(r.isi, 140)}"\n` +
        `— ${pelapor}, ${tanggalId(r.created_at)}`
      );
    })
    .join('\n\n━━━━━━━━━━━━━━\n\n');

  const sisa = sorted.length - shown.length;
  const footer = sisa > 0 ? `\n\n_+${sisa} laporan lama lainnya._` : '';
  return (
    `🛡️ *Daftar Laporan — Anggota Jaga Anggota*\n` +
    `_Total ${sorted.length} laporan. Permanen & tak bisa dihapus._\n\n` +
    `${body}${footer}\n\n` +
    `Mau lapor juga? Ketik *lapor*.`
  );
}

// ---------------- helper ----------------

function ringkasan(d: LaporDraft, m: Member): string {
  return (
    `📝 *Cek laporan kamu:*\n\n` +
    `• Kategori: ${d.kategori}\n` +
    `• Isi: "${d.isi}"\n` +
    `• Pelapor: ${d.anonim ? 'Anonim' : m.nama}\n\n` +
    `⚠️ Sekali dikirim, laporan *tak bisa dihapus/diubah* dan dikirim ke semua anggota.\n\n` +
    `Ketik *kirim* untuk mengirim, *ulang* untuk ubah, atau *batal*.`
  );
}

function broadcastText(id: number, kategori: string, isi: string, pelapor: string): string {
  return (
    `🛡️ *Laporan Baru — Anggota Jaga Anggota*\n\n` +
    `#${id} · Kategori: *${kategori}*\n` +
    `"${isi}"\n\n` +
    `Pelapor: ${pelapor}\n` +
    `Status: _Belum diverifikasi_\n\n` +
    `_Kamu menerima ini karena transparansi koperasi. Laporan permanen & tak bisa dihapus. ` +
    `Simpan sebagai bukti. Lihat semua: ketik *daftar laporan*._`
  );
}

function statusLabel(s: string): string {
  if (s === 'DITINDAKLANJUTI') return 'Ditindaklanjuti';
  if (s === 'SELESAI') return 'Selesai';
  return 'Belum diverifikasi';
}

function potong(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function tanggalId(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderChoices(items: string[]): string {
  return items.map((it, i) => `${i + 1}. ${it}`).join('\n');
}

function parseChoice(input: string, items: string[]): string | null {
  const t = input.trim();
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= items.length) return items[n - 1] ?? null;
  return items.find((it) => it.toLowerCase() === t.toLowerCase()) ?? null;
}

function err(msg: string): string {
  return `⚠️ ${msg}`;
}
