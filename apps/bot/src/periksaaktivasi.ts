/**
 * PERIKSA AKTIVASI — untuk calon anggota yang SUDAH terdaftar di sistem koperasi
 * (di produksi: sinkron dari sistem pemerintah; di demo: data dummy di Supabase).
 *
 * Alur: minta *Nomor Anggota* → cocokkan ke DB. Bila cocok & belum diklaim nomor
 * lain → nomor WA ditautkan & langsung aktif (akses penuh), TANPA isi form.
 *
 * Keamanan (OWASP A01, UU PDP):
 * - Cukup Nomor Anggota — TIDAK meminta NIK (minimalisasi data pribadi).
 * - Tolak bila akun sudah tertaut nomor lain (cegah pengambilalihan).
 */
import { verifyExistingMember, totalSimpanan } from './members';
import { rupiah } from './format';

const pending = new Set<string>();

/** True jika user sedang di alur Periksa Aktivasi (menunggu input Nomor Anggota). */
export function inPeriksa(jid: string): boolean {
  return pending.has(jid);
}

/** Batalkan alur Periksa Aktivasi yang sedang berjalan. */
export function cancelPeriksa(jid: string): void {
  pending.delete(jid);
}

/** Mulai alur Periksa Aktivasi — minta Nomor Anggota. */
export function startPeriksa(jid: string): string {
  pending.add(jid);
  return (
    `🔎 *Periksa Aktivasi*\n` +
    `Buat kamu yang *sudah terdaftar* sebagai anggota koperasi. Aku cek datamu di sistem, ` +
    `kalau cocok akunmu langsung aktif — tanpa isi form lagi. 🙌\n` +
    `Ketik *batal* kapan saja untuk berhenti.\n\n` +
    `Masukkan *Nomor Anggota* kamu _(mis. KMP-2020-0088)_:`
  );
}

/** Proses input Nomor Anggota pada alur Periksa Aktivasi. */
export async function handlePeriksa(jid: string, text: string): Promise<string> {
  if (!pending.has(jid)) return startPeriksa(jid);

  const raw = text.trim();
  const low = raw.toLowerCase();
  if (low === 'batal' || low === 'keluar') {
    pending.delete(jid);
    return '❌ Oke, dibatalkan. Ketik *mulai* untuk kembali ke awal ya.';
  }

  const noAnggota = raw.toUpperCase().replace(/\s+/g, '');
  if (noAnggota.length < 4) return '⚠️ Nomor Anggota belum valid. Coba ketik lagi ya _(mis. KMP-2020-0088)_.';

  const res = await verifyExistingMember(jid, noAnggota);
  if (res.status !== 'notfound') pending.delete(jid); // notfound → biarkan coba lagi

  switch (res.status) {
    case 'dboff':
      pending.delete(jid);
      return `⚠️ Fitur ini butuh koneksi database. Set *SUPABASE_** di .env dulu ya.`;
    case 'notfound':
      return (
        `🙈 Nomor Anggota *${noAnggota}* tidak ditemukan di sistem koperasi.\n\n` +
        `Cek lagi nomornya ya. Kalau memang belum terdaftar, daftar baru yuk — ketik *aktivasi*. ` +
        `Atau ketik *batal* untuk berhenti. 🙌`
      );
    case 'claimed':
      return (
        `⚠️ Akun *${noAnggota}* sudah *terhubung ke nomor WhatsApp lain*.\n\n` +
        `Kalau ini benar-benar kamu, hubungi pengurus untuk verifikasi — ketik *pengurus*. 🙏`
      );
    case 'ok': {
      const m = res.member;
      return (
        `✅ *Aktivasi berhasil!*\n\n` +
        `Selamat datang kembali, *${m.nama}* 🌾\n` +
        `Nomor anggota: *${m.noAnggota}*\n` +
        `Status: *Anggota aktif*\n\n` +
        `📊 Ringkasan datamu:\n` +
        `• Total simpanan: *${rupiah(totalSimpanan(m))}*\n` +
        `• Estimasi SHU: *${rupiah(m.estimasiSHU)}*\n` +
        `• Poin: *${m.poin.toLocaleString('id-ID')}*\n\n` +
        `Semua layanan sekarang kebuka. Ketik *menu* ya! 🙌`
      );
    }
  }
}
