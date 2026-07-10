/**
 * Data ANGGOTA dummy untuk demo, dipetakan dari nomor WhatsApp.
 * Nomor yang tidak dikenal otomatis dapat profil "demo" — jadi juri/penguji
 * bisa langsung mencoba semua fitur tanpa perlu registrasi.
 *
 * PRODUKSI: ganti fungsi getMember() dengan query ke database anggota nyata
 * (mis. SIMKOPDES) berdasarkan nomor terverifikasi.
 */
import { makeCode, registerCode } from './referral';
import { dbEnabled, fetchAll, upsert } from './db';

/**
 * PERAN anggota (POV member di WhatsApp — papan tulis Hackathon poin 2 & 3).
 * Ditandai PER-NOMOR di bawah, jadi tiap nomor demo bisa diperagakan sebagai
 * peran berbeda ke juri.
 *   • 'produsen' → anggota yang punya usaha & menitip-jual lewat koperasi (poin 2)
 *   • 'anggota'  → anggota/konsumen biasa (poin 3)
 */
export type MemberRole = 'produsen' | 'anggota';

/** Satu produk yang dijual anggota produsen (data dummy demo). */
export type Produk = {
  nama: string;
  stok: number; // sisa stok (unit)
  terjual: number; // unit terjual periode berjalan
  hargaJual: number; // harga per unit
};

/** Data usaha milik anggota PRODUSEN (poin 2A). */
export type UsahaProdusen = {
  namaUsaha: string;
  produk: Produk[];
  kerugian: number; // nilai rugi/retur/susut periode berjalan
};

/** Modal & pengeluaran (poin 2B untuk produsen, 3A untuk anggota). */
export type Keuangan = {
  modal: number; // modal usaha (produsen) / simpanan sbg modal (anggota)
  pengeluaran: number; // total pengeluaran periode berjalan
};

export type Member = {
  nama: string;
  noAnggota: string;
  sejak: string;
  role: MemberRole; // penanda peran per-nomor (produsen vs anggota biasa)
  simpananPokok: number;
  simpananWajib: number;
  simpananSukarela: number;
  estimasiSHU: number;
  poin: number;
  lencana: string;
  skorKeterlibatan: number; // 0–100
  pinjaman: { sisa: number; angsuranPerBulan: number; tenorSisa: number } | null;
  kodeReferral: string; // kode untuk mengajak teman (program Gotong Royong)
  keuangan: Keuangan; // modal & pengeluaran
  usaha: UsahaProdusen | null; // data usaha — hanya untuk role 'produsen'
};

// Contoh anggota spesifik. Ganti nomor dengan nomor asli untuk demo personalisasi.
// (628... = format internasional tanpa tanda +, sesuai JID WhatsApp.)
const byPhone: Record<string, Member> = {
  // 🏪 PRODUSEN (poin 2) — punya usaha "Warung Keripik" + skor keterlibatan tinggi.
  '628123456789': {
    nama: 'Bu Sri Rahayu',
    noAnggota: 'KMP-2019-0043',
    sejak: 'Agustus 2019',
    role: 'produsen',
    simpananPokok: 100_000,
    simpananWajib: 3_300_000,
    simpananSukarela: 2_500_000,
    estimasiSHU: 540_000,
    poin: 3_180,
    lencana: 'Anggota Teladan 🥇',
    skorKeterlibatan: 92,
    pinjaman: null,
    kodeReferral: 'SRI2019',
    keuangan: { modal: 5_000_000, pengeluaran: 3_200_000 },
    usaha: {
      namaUsaha: 'Warung Keripik Bu Sri',
      produk: [
        { nama: 'Keripik Singkong', stok: 40, terjual: 120, hargaJual: 15_000 },
        { nama: 'Keripik Pisang', stok: 25, terjual: 85, hargaJual: 18_000 },
        { nama: 'Rempeyek Kacang', stok: 60, terjual: 60, hargaJual: 12_000 },
      ],
      kerugian: 150_000, // retur + susut
    },
  },
  // 🧺 ANGGOTA/konsumen biasa (poin 3) — tanpa data usaha (juga demo "anggota pasif").
  '628987654321': {
    nama: 'Pak Budi Santoso',
    noAnggota: 'KMP-2024-0311',
    sejak: 'Mei 2024',
    role: 'anggota',
    simpananPokok: 100_000,
    simpananWajib: 660_000,
    simpananSukarela: 0,
    estimasiSHU: 68_000,
    poin: 120,
    lencana: 'Anggota Baru 🥉',
    skorKeterlibatan: 31,
    pinjaman: null,
    kodeReferral: 'BUDI2024',
    keuangan: { modal: 760_000, pengeluaran: 450_000 }, // modal=simpanan, pengeluaran=belanja di koperasi
    usaha: null,
  },
};

// Profil default untuk nomor tak dikenal — dibuat PRODUSEN agar penguji langsung
// melihat dashboard usaha (fitur unggulan poin 2). Ganti/toggle sesuai kebutuhan demo.
const demoMember: Member = {
  nama: 'Andi Wijaya',
  noAnggota: 'KMP-2021-0157',
  sejak: 'Maret 2021',
  role: 'produsen',
  simpananPokok: 100_000,
  simpananWajib: 2_640_000,
  simpananSukarela: 750_000,
  estimasiSHU: 312_000,
  poin: 1_240,
  lencana: 'Anggota Aktif 🥈',
  skorKeterlibatan: 78,
  pinjaman: { sisa: 3_500_000, angsuranPerBulan: 620_000, tenorSisa: 6 },
  kodeReferral: 'ANDI2021',
  keuangan: { modal: 4_000_000, pengeluaran: 2_100_000 },
  usaha: {
    namaUsaha: 'Kebun Sayur Pak Andi',
    produk: [
      { nama: 'Sawi Hijau', stok: 30, terjual: 95, hargaJual: 8_000 },
      { nama: 'Tomat', stok: 20, terjual: 70, hargaJual: 12_000 },
      { nama: 'Cabai Merah', stok: 15, terjual: 40, hargaJual: 35_000 },
    ],
    kerugian: 220_000, // sayur busuk/tak terjual
  },
};

// Daftarkan kode referral anggota preset ke program Gotong Royong (agar bisa dipakai & di-track).
for (const m of [...Object.values(byPhone), demoMember]) registerCode(m.kodeReferral, m.nama);

// Nomor + profil anggota yang teraktivasi selama sesi berjalan (demo; produksi: DB SIMKOPDES).
const registered: Record<string, Member> = {};

/** True jika nomor sudah jadi anggota AKTIF (terdaftar di byPhone atau sudah aktivasi). */
export function isMember(jid: string): boolean {
  const phone = jid.split('@')[0] ?? '';
  return byPhone[phone] !== undefined || registered[jid] !== undefined;
}

/** Tandai nomor sebagai anggota aktif + simpan profilnya (dipakai alur aktivasi). */
export function activateMember(jid: string, member: Member): void {
  registered[jid] = member;
  // Anggota baru pun langsung bisa mengajak teman -> daftarkan kode referral-nya.
  registerCode(member.kodeReferral, member.nama);
  persistMember(member, jid.split('@')[0] ?? ''); // write-through ke Supabase (dengan phone)
}

// ---------------- Supabase: hydrate (seed) + write-through ----------------

/** DB row (snake_case) -> Member (camelCase). */
function rowToMember(r: Record<string, any>): Member {
  return {
    nama: r.nama,
    noAnggota: r.no_anggota,
    sejak: r.sejak ?? '',
    role: r.role === 'produsen' ? 'produsen' : 'anggota',
    simpananPokok: Number(r.simpanan_pokok ?? 0),
    simpananWajib: Number(r.simpanan_wajib ?? 0),
    simpananSukarela: Number(r.simpanan_sukarela ?? 0),
    estimasiSHU: Number(r.estimasi_shu ?? 0),
    poin: Number(r.poin ?? 0),
    lencana: r.lencana ?? '',
    skorKeterlibatan: Number(r.skor_keterlibatan ?? 0),
    pinjaman: r.pinjaman ?? null,
    kodeReferral: r.kode_referral ?? '',
    keuangan: r.keuangan ?? { modal: 0, pengeluaran: 0 },
    usaha: r.usaha ?? null,
  };
}

/** Member -> DB row. `phone` opsional: sertakan hanya saat diketahui (mis. aktivasi). */
function memberToRow(m: Member, phone?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    no_anggota: m.noAnggota,
    nama: m.nama,
    sejak: m.sejak,
    role: m.role,
    simpanan_pokok: m.simpananPokok,
    simpanan_wajib: m.simpananWajib,
    simpanan_sukarela: m.simpananSukarela,
    estimasi_shu: m.estimasiSHU,
    poin: m.poin,
    lencana: m.lencana,
    skor_keterlibatan: m.skorKeterlibatan,
    kode_referral: m.kodeReferral,
    keuangan: m.keuangan,
    pinjaman: m.pinjaman,
    usaha: m.usaha,
    updated_at: new Date().toISOString(),
  };
  if (phone) row.phone = phone; // tak disertakan saat undefined -> tak menimpa phone di DB
  return row;
}

/** Muat anggota dari Supabase ke `byPhone` (dipanggil sekali saat start). */
export async function hydrateMembers(): Promise<number> {
  if (!dbEnabled) return 0;
  const rows = await fetchAll('members');
  for (const r of rows) {
    if (r.phone) byPhone[r.phone] = rowToMember(r); // timpa preset dgn nilai DB terkini
  }
  return rows.length;
}

/** Write-through profil anggota ke Supabase (fire-and-forget; no-op bila DB nonaktif). */
export function persistMember(m: Member, phone?: string): void {
  if (!dbEnabled) return;
  upsert('members', memberToRow(m, phone), 'no_anggota');
}

/**
 * DEMO: "lupakan" status anggota nomor ini (in-memory saja) → jadi calon anggota
 * lagi, sehingga welcome 4-pilihan & alur aktivasi bisa diperagakan ulang ke juri.
 * TIDAK menghapus data di Supabase (non-destruktif) dan tak menyentuh anggota seed.
 */
export function forgetMember(jid: string): boolean {
  const phone = jid.split('@')[0] ?? '';
  // Hapus dari KEDUA sumber pengenal anggota (in-memory):
  //  - registered : anggota yang aktivasi di sesi berjalan
  //  - byPhone    : anggota hasil hydrate dari Supabase (mis. sudah aktivasi lalu bot restart)
  const existed = registered[jid] !== undefined || byPhone[phone] !== undefined;
  delete registered[jid];
  delete byPhone[phone];
  return existed;
}

/** Bangun profil anggota BARU (saldo nol) dari data aktivasi. */
export function newMemberProfile(nama: string, noAnggota: string): Member {
  const sejak = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  return {
    nama,
    noAnggota,
    sejak,
    role: 'anggota', // anggota baru default konsumen biasa (poin 3); ubah ke 'produsen' bila punya usaha
    simpananPokok: 0,
    simpananWajib: 0,
    simpananSukarela: 0,
    estimasiSHU: 0,
    poin: 0,
    lencana: 'Anggota Baru 🥉',
    skorKeterlibatan: 0,
    pinjaman: null,
    kodeReferral: makeCode(nama, noAnggota),
    keuangan: { modal: 0, pengeluaran: 0 },
    usaha: null,
  };
}

/** Ambil data anggota dari nomor WhatsApp (JID). Fallback ke profil demo. */
export function getMember(jid: string): Member {
  const phone = jid.split('@')[0] ?? '';
  return byPhone[phone] ?? registered[jid] ?? demoMember;
}

/** Total simpanan = pokok + wajib + sukarela. */
export function totalSimpanan(m: Member): number {
  return m.simpananPokok + m.simpananWajib + m.simpananSukarela;
}

/**
 * Daftar JID semua anggota aktif (byPhone hasil seed/hydrate + registered sesi ini).
 * Dipakai broadcast (mis. notif laporan transparansi). `exclude` untuk melewati
 * satu JID (mis. pelapor sendiri). JID dinormalisasi & dedupe.
 */
export function allMemberJids(exclude?: string): string[] {
  const jids = new Set<string>();
  for (const phone of Object.keys(byPhone)) jids.add(`${phone}@s.whatsapp.net`);
  for (const jid of Object.keys(registered)) jids.add(jid);
  if (exclude) jids.delete(exclude);
  return [...jids];
}
