/**
 * Pengalaman CALON ANGGOTA (prospek) — menambal funnel Tahap 1 "Kenal".
 *
 * Hook utama: SIMULASI UNTUNG interaktif — kasih ANGKA personal (simpanan setahun,
 * estimasi SHU, hemat vs pinjol). Jujur & konkret, bukan over-promise. Alur
 * rule-based penuh biar stabil saat demo. Ketik "gabung" -> jadi anggota.
 */
import { koperasi, mainMenu } from './business';
import { rupiah } from './format';
import { joinAsMember } from './members';

// Konstanta ilustrasi (asumsi, bukan angka resmi) untuk pembanding "hemat".
const KOPERASI_RATE = 0.01; // 1%/bln — selaras koperasi.pinjaman.jasa
const PINJOL_RATE = 0.04; // ~4%/bln — asumsi ilustrasi pinjol
const LOAN_EXAMPLE = 5_000_000; // contoh nominal pinjaman
const LOAN_TENOR = 10; // bulan
const SHU_ESTIMATE_RATE = 0.1; // estimasi kasar SHU ~10% dari simpanan setahun

// Prospek yang sedang ditanya "nabung berapa/bulan" di simulator.
const simPending = new Set<string>();

/** Sapaan pertama untuk prospek — benefit-led + social proof + CTA. */
export function welcomeProspect(): string {
  const s = koperasi.stats;
  return (
    `👋 Halo! Kenalin, *${koperasi.name}* 🌾\n\n` +
    `Bukan sekadar nabung — di sini uangmu *balik lagi* & *tumbuh bareng warga*:\n` +
    `💸 Dapat *SHU* (bagi hasil) tiap tahun\n` +
    `🛡️ Pinjaman bunga *cuma ${koperasi.pinjaman.jasa}* — jauh lebih murah dari pinjol\n` +
    `🤝 Punya *hak suara* — koperasi ini milik anggotanya\n\n` +
    `_Udah ${s.anggota} warga gabung. Tahun lalu SHU dibagikan total ${rupiah(s.shuTahunLalu)}._ 🎉\n\n` +
    `Penasaran kamu bisa dapat berapa? 👉 Ketik *untung* buat simulasi cepat, atau *gabung* buat langsung daftar.`
  );
}

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
  const t = text.trim().toLowerCase();

  // 1) Sedang di simulator -> tunggu nominal
  if (simPending.has(jid)) {
    if (['batal', 'keluar', 'menu'].includes(t)) {
      simPending.delete(jid);
      return welcomeProspect();
    }
    const amount = parseRupiah(t);
    if (amount === null) {
      return `Hmm, belum kebaca angkanya 🙈. Ketik nominal nabung per bulan, mis. *100rb* atau *500000*. _(atau ketik *batal*)_`;
    }
    simPending.delete(jid);
    return simResult(amount);
  }

  // 2) Gabung -> jadi anggota
  if (['gabung', 'daftar', 'ya', 'iya', 'mau', 'join'].includes(t)) {
    joinAsMember(jid);
    return (
      `🎉 *Selamat datang, anggota baru!*\n\n` +
      `Pendaftaranmu tercatat (demo). Di dunia nyata, pengurus verifikasi KTP & simpanan pokok dulu — ketik *pengurus* buat dibantu.\n\n` +
      `Sekarang kamu bisa akses semua layanan anggota 👇\n\n` +
      mainMenu()
    );
  }

  // 3) Mulai simulator (hook utama)
  if (['untung', 'simulasi', 'simulasikan', 'hitung', 'cuan'].includes(t)) {
    simPending.add(jid);
    return (
      `💡 Yuk simulasi untungmu! Kira-kira kamu bisa *nabung berapa per bulan?*\n\n` +
      `Ketik nominalnya aja, mis. *100rb*, *250rb*, atau *500000*.`
    );
  }

  // 4) Penjelasan
  if (['apa itu koperasi', 'apa itu', 'koperasi', 'manfaat', 'benefit', 'info'].includes(t)) {
    return explainer();
  }

  // 5) Video (opsional)
  if (['video', 'nonton'].includes(t)) {
    return video();
  }

  // 6) Default -> sapaan hook
  return welcomeProspect();
}
