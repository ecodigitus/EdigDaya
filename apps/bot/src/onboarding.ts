/**
 * Pengalaman CALON ANGGOTA (prospek) — menambal funnel Tahap 1 "Kenal".
 *
 * Menu anggota TERKUNCI sampai prospek menyelesaikan aktivasi akun (lihat
 * activation.ts, dipicu dari router). Di sini: penjelasan koperasi, simulasi
 * untung (opsional via kata kunci), dan pesan "belum aktivasi" untuk menu.
 */
import { koperasi } from './business';
import { rupiah } from './format';
import { prospectWelcome, startNudge } from './welcome';

// Konstanta ilustrasi (asumsi, bukan angka resmi) untuk pembanding "hemat".
const KOPERASI_RATE = 0.01; // 1%/bln — selaras koperasi.pinjaman.jasa
const PINJOL_RATE = 0.04; // ~4%/bln — asumsi ilustrasi pinjol
const LOAN_EXAMPLE = 5_000_000; // contoh nominal pinjaman
const LOAN_TENOR = 10; // bulan
const SHU_ESTIMATE_RATE = 0.1; // estimasi kasar SHU ~10% dari simpanan setahun

// Prospek yang sedang ditanya "nabung berapa/bulan" di simulator.
const simPending = new Set<string>();

/** Penjelasan singkat & renyah "apa itu koperasi". */
function explainer(): string {
  return (
    `📌 *Koperasi itu simpel:*\n\n` +
    `Sekumpulan orang patungan modal, lalu keuntungannya *dibagi balik* ke anggota (namanya SHU). ` +
    `Jadi kamu bukan cuma "nasabah" — kamu *pemilik*. 🤝\n\n` +
    `Manfaat nyata buat kamu:\n` +
    `• Nabung aman + dapat bagi hasil tahunan\n` +
    `• Pinjaman murah (${koperasi.pinjaman.jasa}) tanpa jerat pinjol\n` +
    `• Ikut nentuin arah lewat voting\n\n` +
    `👉 Ketik *untung* buat lihat simulasi angkanya, atau *gabung* buat mulai.`
  );
}

/** Balas link video kalau tersedia; kalau tidak, arahkan ke simulasi. */
function video(): string {
  if (koperasi.introVideoUrl) {
    return (
      `🎬 Tonton kenalan singkat koperasi kita:\n${koperasi.introVideoUrl}\n\n` +
      `Udah nonton? Ketik *untung* buat simulasi, atau *gabung* ya!`
    );
  }
  return `Videonya lagi disiapin 🙏. Sementara, ketik *untung* buat simulasi untung versi kamu, atau *gabung* buat mulai.`;
}

/** Parse nominal Rupiah dari teks bebas: "100rb", "100.000", "1jt", "500k". */
function parseRupiah(text: string): number | null {
  const t = text.toLowerCase().replace(/\s/g, '');
  const m = t.match(/[\d.,]+/);
  if (!m) return null;
  const val = Number(m[0].replace(/[.,]/g, ''));
  if (!Number.isFinite(val) || val <= 0) return null;
  if (/(jt|juta)/.test(t)) return Math.round(val * 1_000_000);
  if (/(rb|ribu|k)/.test(t)) return Math.round(val * 1_000);
  return Math.round(val);
}

/** Hasil simulasi untung — payoff hook (angka personal). */
function simResult(perMonth: number): string {
  const annualSavings = koperasi.simpanan.pokok + perMonth * 12;
  const estSHU = Math.round(annualSavings * SHU_ESTIMATE_RATE);
  const koperasiInterest = Math.round(LOAN_EXAMPLE * KOPERASI_RATE * LOAN_TENOR);
  const pinjolInterest = Math.round(LOAN_EXAMPLE * PINJOL_RATE * LOAN_TENOR);
  const saving = pinjolInterest - koperasiInterest;

  return (
    `📊 *Simulasi Untung Versi Kamu*\n_(nabung ${rupiah(perMonth)}/bulan)_\n\n` +
    `💰 Simpanan kamu dalam 1 tahun: *${rupiah(annualSavings)}*\n` +
    `💸 Estimasi SHU (bagi hasil): *± ${rupiah(estSHU)}/tahun*\n` +
    `   _estimasi kasar, tergantung kinerja koperasi_\n\n` +
    `🛡️ *Kalau butuh pinjaman ${rupiah(LOAN_EXAMPLE)} (${LOAN_TENOR} bln):*\n` +
    `   • Di koperasi (${Math.round(KOPERASI_RATE * 100)}%/bln): jasa ${rupiah(koperasiInterest)}\n` +
    `   • Di pinjol (asumsi ${Math.round(PINJOL_RATE * 100)}%/bln): ${rupiah(pinjolInterest)}\n` +
    `   ➜ *HEMAT ${rupiah(saving)}!* 🤯\n\n` +
    `Semua ini jadi milikmu sebagai anggota. Keren kan? 🎉\n` +
    `👉 Ketik *gabung* buat mulai (cuma 5 menit dari HP).`
  );
}

/**
 * Orkestrasi pengalaman prospek. Selalu balik string.
 * Begitu prospek "gabung", nomornya jadi anggota & pesan berikutnya masuk alur normal.
 */
export function handleProspect(jid: string, text: string): string {
  const raw = text.trim().toLowerCase();

  // 1) Sedang di simulator -> tunggu nominal (pakai input mentah, jangan dipetakan)
  if (simPending.has(jid)) {
    if (['batal', 'keluar', 'menu'].includes(raw)) {
      simPending.delete(jid);
      return prospectWelcome();
    }
    const amount = parseRupiah(raw);
    if (amount === null) {
      return `Hmm, belum kebaca angkanya 🙈. Ketik nominal nabung per bulan, mis. *100rb* atau *500000*. _(atau ketik *batal*)_`;
    }
    simPending.delete(jid);
    return simResult(amount);
  }

  // Pintasan angka dari welcome card (2 = penjelasan, 3 = Menu).
  // Opsi 1 (periksa aktivasi), 4 (ngobrol AI) & 5 (aktivasi) ditangani di router
  // sebelum sampai sini.
  const welcomeShortcut: Record<string, string> = { '2': 'apa itu koperasi', '3': 'menu' };
  const t = welcomeShortcut[raw] ?? raw;

  // 2) Menu TERKUNCI sampai user aktivasi akun dulu
  if (t === 'menu') {
    return (
      `🔒 Aduh, kamu belum aktivasi akun nih 😅\n\n` +
      `Daftar dulu yuk biar bisa akses semua layanan anggota (simpanan, SHU, pinjaman, voting, dll).\n` +
      `👉 Sudah terdaftar di koperasi? Ketik *periksa aktivasi*. Belum? Ketik *5* atau *aktivasi* buat daftar baru. 🙌`
    );
  }

  // 3) Mulai simulator (hook utama)
  if (['untung', 'hitung untungku', 'hitung untung', 'simulasi', 'simulasikan', 'hitung', 'cuan'].includes(t)) {
    simPending.add(jid);
    return (
      `💡 Yuk simulasi untungmu! Kira-kira kamu bisa *nabung berapa per bulan?*\n\n` +
      `Ketik nominalnya aja, mis. *100rb*, *250rb*, atau *500000*.`
    );
  }

  // 4) Penjelasan
  if (
    ['apa itu koperasi', 'apa itu', 'koperasi', 'belum ngerti koperasi', 'belum ngerti', 'gak ngerti', 'manfaat', 'benefit', 'info'].includes(t)
  ) {
    return explainer();
  }

  // 5) Video (opsional)
  if (['video', 'nonton'].includes(t)) {
    return video();
  }

  // 6) Default -> nudge singkat "ketik mulai" (biar user baru gak bingung, gak
  //    langsung dibanjiri seluruh kartu welcome). Kartu penuh muncul saat "mulai".
  return startNudge();
}
