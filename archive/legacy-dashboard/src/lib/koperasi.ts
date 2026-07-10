/** Profil koperasi (dummy statis) — mirror src/business.ts di bot. */
export const koperasi = {
  name: 'Koperasi Merah Putih Desa Sukamaju',
  tagline: 'Dari anggota, oleh anggota, untuk anggota 🌾',
  jamLayanan: 'Senin–Jumat 08.00–16.00 WIB · Sabtu 08.00–12.00 WIB',
  alamat: 'Balai Desa Sukamaju, Kec. Cibinong, Kab. Bogor',
  telp: '+62 812-3456-7890',
  email: 'admin@kmp-sukamaju.example',
  simpananPokok: 100_000, // batas "lunas" simpanan pokok
  simpananWajib: 55_000,
  pinjaman: { plafon: 10_000_000, jasa: '1% per bulan (menurun)', tenorMaks: 12 },
  eRat: {
    tanggal: '25 Januari 2026',
    agenda: 'Laporan pertanggungjawaban pengurus, pembagian SHU 2025, & pemilihan pengawas',
    metode: 'Hybrid — hadir di Balai Desa atau voting online',
  },
};

/** Misi mingguan (mirror menu 5 di bot). */
export const misiMingguan = [
  'Setor simpanan wajib → +50 poin',
  'Hadir kegiatan koperasi → +100 poin',
  'Ikut voting e-RAT → +150 poin',
];
