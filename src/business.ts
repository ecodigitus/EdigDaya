/**
 * Profil KOPERASI (data dummy) — demo Hackathon Kemenkop 2026, Tema 3.
 * INI YANG KAMU EDIT untuk menyesuaikan ke koperasi nyata.
 * (Nama file 'business.ts' = profil organisasi; di sini organisasinya koperasi.)
 */
export const koperasi = {
  name: 'Koperasi Merah Putih Desa Sukamaju',
  tagline: 'Dari anggota, oleh anggota, untuk anggota 🌾',
  jenis: 'Koperasi Simpan Pinjam & Serba Usaha',
  jamLayanan: 'Senin–Jumat 08.00–16.00 WIB · Sabtu 08.00–12.00 WIB',
  alamat: 'Balai Desa Sukamaju, Kec. Cibinong, Kab. Bogor',
  mapsUrl: 'https://maps.google.com/?q=Balai+Desa+Sukamaju',
  telp: '+62 812-3456-7890',
  email: 'admin@kmp-sukamaju.example',
  website: 'https://kmp-sukamaju.example',
  // Social proof (dummy) untuk hook calon anggota
  stats: { anggota: 247, shuTahunLalu: 45_000_000, sejakTahun: 2015 },
  // Link video perkenalan opsional; kosong = fitur video nonaktif
  introVideoUrl: '',
  simpanan: {
    pokok: 100_000, // dibayar sekali saat mendaftar
    wajib: 55_000, // per bulan
  },
  pinjaman: {
    plafon: 10_000_000,
    jasa: '1% per bulan (menurun)',
    tenorMaks: 12, // bulan
  },
  eRat: {
    tanggal: '25 Januari 2026',
    agenda: 'Laporan pertanggungjawaban pengurus, pembagian SHU 2025, & pemilihan pengawas',
    metode: 'Hybrid — hadir di Balai Desa atau voting online lewat aplikasi',
  },
  faqs: [
    {
      q: 'Cara jadi anggota?',
      a: 'Isi formulir + foto KTP, bayar simpanan pokok Rp100.000 (sekali) dan simpanan wajib Rp55.000/bulan. Setelah aktif langsung dapat akses simpan-pinjam, SHU, dan hak suara.',
    },
    {
      q: 'Beda simpanan pokok, wajib, dan sukarela?',
      a: 'Pokok: sekali saat gabung (Rp100.000). Wajib: rutin tiap bulan (Rp55.000). Sukarela: menabung bebas kapan saja & bisa ditarik sesuai ketentuan.',
    },
    {
      q: 'Apa itu SHU?',
      a: 'Sisa Hasil Usaha — bagian keuntungan koperasi yang dibagikan ke anggota tiap tahun, dihitung dari besar simpanan & keaktifan bertransaksi. Dibagikan saat RAT.',
    },
    {
      q: 'Cara ajukan pinjaman?',
      a: 'Anggota aktif bisa mengajukan pinjaman s/d Rp10.000.000, jasa 1%/bulan menurun, tenor maksimal 12 bulan. Ketik "pengurus" untuk memulai pengajuan.',
    },
    {
      q: 'Apa itu RAT / e-RAT?',
      a: 'Rapat Anggota Tahunan — forum tertinggi koperasi untuk mengambil keputusan & membagi SHU. Dengan e-RAT, anggota bisa ikut voting online tanpa harus hadir fisik.',
    },
  ],
} as const;

/** Ringkasan konteks koperasi yang disuntik ke system prompt AI. */
export const koperasiContext = `Informasi koperasi:
- Nama: ${koperasi.name} (${koperasi.jenis})
- Semboyan: ${koperasi.tagline}
- Jam layanan kantor: ${koperasi.jamLayanan}
- Alamat: ${koperasi.alamat}
- Kontak: ${koperasi.telp} | ${koperasi.email} | ${koperasi.website}
- Simpanan: pokok Rp100.000 (sekali), wajib Rp55.000/bulan, sukarela bebas
- Pinjaman: plafon s/d Rp10.000.000, jasa ${koperasi.pinjaman.jasa}, tenor maks ${koperasi.pinjaman.tenorMaks} bulan
- e-RAT berikutnya: ${koperasi.eRat.tanggal} — ${koperasi.eRat.agenda} (${koperasi.eRat.metode})

FAQ:
${koperasi.faqs.map((f, i) => `${i + 1}. T: ${f.q}\n   J: ${f.a}`).join('\n')}`;

/** Menu utama (rule-based) — memetakan seluruh funnel keterlibatan koperasi. */
export function mainMenu(): string {
  return (
    `🌾 Selamat datang di *${koperasi.name}*\n` +
    `_Asisten Anggota — siap bantu kapan saja 🤝_\n\n` +
    `Ketik *angka* atau *kata kunci*:\n` +
    `1️⃣  Info & cara jadi anggota\n` +
    `2️⃣  Simpanan saya\n` +
    `3️⃣  Estimasi SHU saya\n` +
    `4️⃣  Pinjaman\n` +
    `5️⃣  e-RAT & voting\n` +
    `6️⃣  Poin & misi saya\n` +
    `7️⃣  Hubungi pengurus\n\n` +
    `Atau tanya bebas, mis. *"cara nambah simpanan?"* 😊`
  );
}
