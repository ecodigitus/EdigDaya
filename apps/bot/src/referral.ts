/**
 * Program referral "GOTONG ROYONG".
 *
 * Alur: pengajak berbagi *kode referral*-nya → teman aktivasi akun & memasukkan
 * kode itu → pengajak dapat *poin Gotong Royong* (untuk bonus SHU).
 *
 * Data in-memory (demo). PRODUKSI: poin & relasi referral idealnya dicatat di
 * SIMKOPDES; struktur di sini sengaja sederhana agar mudah ditukar ke API.
 */
type ReferralStat = { name: string; poin: number; ajakan: number };

// Poin Gotong Royong yang didapat pengajak per satu teman yang berhasil aktivasi.
export const POIN_PER_AJAKAN = 100;

const byCode = new Map<string, ReferralStat>();

function normalize(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** Bentuk kode referral dari nama depan + 4 digit terakhir nomor anggota. */
export function makeCode(nama: string, noAnggota: string): string {
  const first = (nama.trim().split(/\s+/)[0] ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  const digits = noAnggota.replace(/\D/g, '').slice(-4) || '0000';
  return `${first || 'KMP'}${digits}`;
}

/** Daftarkan kode referral seorang anggota (idempoten). */
export function registerCode(code: string, name: string): void {
  const key = normalize(code);
  if (!byCode.has(key)) byCode.set(key, { name, poin: 0, ajakan: 0 });
}

/** True jika kode referral dikenal/valid. */
export function isValidCode(code: string): boolean {
  return byCode.has(normalize(code));
}

/** Nama pemilik kode referral, atau null bila tak ditemukan. */
export function ownerName(code: string): string | null {
  return byCode.get(normalize(code))?.name ?? null;
}

/** Beri poin Gotong Royong ke pemilik kode (dipanggil saat teman berhasil aktivasi). */
export function creditReferral(code: string): { ok: boolean; name?: string; poin?: number; ajakan?: number } {
  const s = byCode.get(normalize(code));
  if (!s) return { ok: false };
  s.ajakan += 1;
  s.poin += POIN_PER_AJAKAN;
  return { ok: true, name: s.name, poin: s.poin, ajakan: s.ajakan };
}

/** Statistik Gotong Royong pemilik kode (untuk ditampilkan ke anggota). */
export function stats(code: string): { poin: number; ajakan: number } {
  const s = byCode.get(normalize(code));
  return { poin: s?.poin ?? 0, ajakan: s?.ajakan ?? 0 };
}
