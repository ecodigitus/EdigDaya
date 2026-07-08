/**
 * Data ANGGOTA dummy untuk demo, dipetakan dari nomor WhatsApp.
 * Nomor yang tidak dikenal otomatis dapat profil "demo" — jadi juri/penguji
 * bisa langsung mencoba semua fitur tanpa perlu registrasi.
 *
 * PRODUKSI: ganti fungsi getMember() dengan query ke database anggota nyata
 * (mis. SIMKOPDES) berdasarkan nomor terverifikasi.
 */
export type Member = {
  nama: string;
  noAnggota: string;
  sejak: string;
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  estimasiSHU: number;
  poin: number;
  lencana: string;
  skorKeterlibatan: number; // 0–100
  pinjaman: { sisa: number; angsuranPerBulan: number; tenorSisa: number } | null;
};

// Contoh anggota spesifik. Ganti nomor dengan nomor asli untuk demo personalisasi.
// (628... = format internasional tanpa tanda +, sesuai JID WhatsApp.)
const byPhone: Record<string, Member> = {
  // Anggota teladan — sangat aktif (buat pamer skor keterlibatan tinggi)
  '628123456789': {
    nama: 'Bu Sri Rahayu',
    noAnggota: 'KMP-2019-0043',
    sejak: 'Agustus 2019',
    simpananPokok: 100_000,
    simpananWajib: 3_300_000,
    simpananSukarela: 2_500_000,
    estimasiSHU: 540_000,
    poin: 3_180,
    lencana: 'Anggota Teladan 🥇',
    skorKeterlibatan: 92,
    pinjaman: null,
  },
  // Anggota pasif — buat mendemokan fitur "re-aktivasi anggota pasif"
  '628987654321': {
    nama: 'Pak Budi Santoso',
    noAnggota: 'KMP-2024-0311',
    sejak: 'Mei 2024',
    simpananPokok: 100_000,
    simpananWajib: 660_000,
    simpananSukarela: 0,
    estimasiSHU: 68_000,
    poin: 120,
    lencana: 'Anggota Baru 🥉',
    skorKeterlibatan: 31,
    pinjaman: null,
  },
};

// Profil default untuk nomor tak dikenal — biar demo langsung jalan.
const demoMember: Member = {
  nama: 'Andi Wijaya',
  noAnggota: 'KMP-2021-0157',
  sejak: 'Maret 2021',
  simpananPokok: 100_000,
  simpananWajib: 2_640_000,
  simpananSukarela: 750_000,
  estimasiSHU: 312_000,
  poin: 1_240,
  lencana: 'Anggota Aktif 🥈',
  skorKeterlibatan: 78,
  pinjaman: { sisa: 3_500_000, angsuranPerBulan: 620_000, tenorSisa: 6 },
};

// Nomor yang sudah "gabung" selama sesi berjalan (demo; produksi: simpan di DB).
const joined = new Set<string>();

/** True jika nomor sudah jadi anggota (terdaftar di byPhone atau baru gabung). */
export function isMember(jid: string): boolean {
  const phone = jid.split('@')[0] ?? '';
  return byPhone[phone] !== undefined || joined.has(jid);
}

/** Tandai nomor sebagai anggota (dipakai alur "gabung" dari onboarding). */
export function joinAsMember(jid: string): void {
  joined.add(jid);
}

/** Ambil data anggota dari nomor WhatsApp (JID). Fallback ke profil demo. */
export function getMember(jid: string): Member {
  const phone = jid.split('@')[0] ?? '';
  return byPhone[phone] ?? demoMember;
}

/** Total simpanan = pokok + wajib + sukarela. */
export function totalSimpanan(m: Member): number {
  return m.simpananPokok + m.simpananWajib + m.simpananSukarela;
}
