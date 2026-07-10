import { koperasi, mainMenu } from './business';
import { rupiah } from './format';
import { totalSimpanan, type Member } from './members';
import { stats } from './referral';
import { pokokLunas } from './simpanan';

/**
 * Router rule-based koperasi: cocokkan pesan dengan menu/kata kunci.
 * Sebagian jawaban dipersonalisasi pakai data anggota (m).
 * Return string balasan kalau cocok, atau null kalau harus dilempar ke AI.
 */
export function matchMenu(raw: string, m: Member): string | null {
  const t = raw.trim().toLowerCase();

  const greetings = ['menu', 'mulai', 'start', 'halo', 'hallo', 'hai', 'hi', 'p', 'assalamualaikum'];
  if (greetings.includes(t)) return mainMenu(m);

  // 1 — Informasi Saya (profil anggota + koperasi yang digabung)
  if (['1', 'informasi saya', 'informasi', 'saya', 'profil', 'profil saya', 'data saya', 'info saya'].includes(t)) {
    return informasiSaya(m);
  }

  // 2 — Simpanan saya  (funnel: Transaksi · transparansi)
  if (['2', 'simpanan', 'saldo', 'tabungan', 'simpanan saya'].includes(t)) {
    const belumPokok = !pokokLunas(m);
    return (
      `💰 *Simpanan ${m.nama}* (${m.noAnggota})\n\n` +
      `• Pokok: ${rupiah(m.simpananPokok)}${belumPokok ? ' _(belum lunas)_' : ' ✅'}\n` +
      `• Wajib: ${rupiah(m.simpananWajib)}\n` +
      `• Sukarela: ${rupiah(m.simpananSukarela)}\n` +
      `━━━━━━━━━━━━━━\n` +
      `*Total: ${rupiah(totalSimpanan(m))}*\n\n` +
      (belumPokok ? `⚠️ Simpanan pokok belum lunas.\n` : '') +
      `👉 Ketik *setor* untuk setor simpanan wajib/sukarela${belumPokok ? '/pokok' : ''}.\n` +
      `_Mau tarik simpanan? Ketik *pengurus*._`
    );
  }

  // 3 — Estimasi SHU  (funnel: Transaksi · transparansi)
  if (['3', 'shu', 'sisa hasil usaha', 'bagi hasil'].includes(t)) {
    return (
      `📈 *Estimasi SHU Berjalan (2026)*\n\n` +
      `${m.nama}, estimasi SHU-mu saat ini: *${rupiah(m.estimasiSHU)}*\n\n` +
      `_Dihitung dari besar simpanan & keaktifan transaksimu. Angka final ditetapkan & dibagikan saat e-RAT (${koperasi.eRat.tanggal})._`
    );
  }

  // 4 — Pinjaman  (funnel: Transaksi)
  if (['4', 'pinjaman', 'kredit', 'pinjam', 'utang'].includes(t)) {
    if (m.pinjaman) {
      return (
        `🏦 *Pinjaman aktif kamu*\n\n` +
        `• Sisa pokok: ${rupiah(m.pinjaman.sisa)}\n` +
        `• Angsuran: ${rupiah(m.pinjaman.angsuranPerBulan)}/bulan\n` +
        `• Sisa tenor: ${m.pinjaman.tenorSisa}x lagi\n\n` +
        `_Mau bayar angsuran atau ajukan tambahan? Ketik *pengurus*._`
      );
    }
    return (
      `🏦 *Info Pinjaman*\n\n` +
      `Kamu belum punya pinjaman aktif. 👍\n` +
      `Anggota aktif bisa mengajukan:\n` +
      `• Plafon s/d ${rupiah(koperasi.pinjaman.plafon)}\n` +
      `• Jasa ${koperasi.pinjaman.jasa}\n` +
      `• Tenor maks ${koperasi.pinjaman.tenorMaks} bulan\n\n` +
      `Ketik *pengurus* untuk mengajukan.`
    );
  }

  // 5 — e-RAT info (funnel: Bersuara). Kata "voting"/"vote" memicu surat suara di campaigns.ts
  if (['5', 'rat', 'e-rat', 'erat', 'rapat'].includes(t)) {
    return (
      `🗳️ *e-RAT (Rapat Anggota Tahunan)*\n\n` +
      `📅 Jadwal: ${koperasi.eRat.tanggal}\n` +
      `📋 Agenda: ${koperasi.eRat.agenda}\n` +
      `💻 Metode: ${koperasi.eRat.metode}\n\n` +
      `Kamu punya *1 hak suara*. 👉 Ketik *voting* untuk memberikan suaramu *sekarang*, langsung dari chat ini! 🔔`
    );
  }

  // 6 — Poin & misi  (funnel: Aktif · gamifikasi + skor keterlibatan)
  if (['6', 'poin', 'misi', 'lencana', 'skor', 'gamifikasi', 'reward'].includes(t)) {
    return (
      `🎯 *Keterlibatan ${m.nama}*\n\n` +
      `⭐ Poin: *${m.poin.toLocaleString('id-ID')}*\n` +
      `🏅 Lencana: ${m.lencana}\n` +
      `📊 Skor Keterlibatan: *${m.skorKeterlibatan}/100*\n\n` +
      `*Misi minggu ini:*\n` +
      `☐ Setor simpanan wajib → +50 poin\n` +
      `☐ Hadir kegiatan koperasi → +100 poin\n` +
      `☐ Ikut voting e-RAT → +150 poin\n\n` +
      `_Kumpulkan poin, tukar jadi benefit di kantor koperasi!_`
    );
  }

  // 7 — Hubungi pengurus (handoff manusia)
  if (['7', 'pengurus', 'admin', 'cs', 'manusia', 'human', 'operator', 'agen'].includes(t)) {
    return (
      `🙋 Baik, permintaanmu akan diteruskan ke *pengurus koperasi*.\n` +
      `Mohon tunggu di jam layanan: ${koperasi.jamLayanan}. Terima kasih! 🙏`
    );
  }

  // 8 — Ajak teman (referral / Gotong Royong)
  if (['8', 'referral', 'kode', 'kode referral', 'ajak', 'ajak teman', 'gotong royong'].includes(t)) {
    return referralView(m);
  }

  return null;
}

/** Menu 1 — Informasi Saya: data pribadi (pendaftaran) + keanggotaan + koperasi. */
function informasiSaya(m: Member): string {
  const peran = m.role === 'produsen' ? 'Produsen (punya usaha)' : 'Anggota / konsumen';
  const p = m.pendaftaran;

  // Bagian data pribadi hasil pendaftaran (kalau tersedia). NIK disamarkan (UU PDP).
  let dataPribadi = '';
  if (p) {
    const alamat = [p.desa, p.kecamatan, p.kabupaten, p.provinsi].filter(Boolean).join(', ');
    dataPribadi =
      `*— Data Pribadi —*\n` +
      (p.nik ? `• NIK: ${maskNik(p.nik)}\n` : '') +
      (p.jenisKelamin ? `• Jenis kelamin: ${p.jenisKelamin}\n` : '') +
      (p.email ? `• Email: ${p.email}\n` : '') +
      (p.nomorHp ? `• No. HP: ${p.nomorHp}\n` : '') +
      (alamat ? `• Wilayah: ${alamat}\n` : '') +
      `\n`;
  }

  const namaKoperasi = p?.koperasi || koperasi.name;

  return (
    `👤 *Informasi Saya*\n\n` +
    dataPribadi +
    `*— Data Keanggotaan —*\n` +
    `• Nama: *${m.nama}*\n` +
    `• No. Anggota: *${m.noAnggota}*\n` +
    `• Anggota sejak: ${m.sejak}\n` +
    `• Peran: ${peran}\n` +
    `• Status: *Aktif* ✅\n` +
    `• Lencana: ${m.lencana}\n` +
    `• Skor keterlibatan: ${m.skorKeterlibatan}/100\n` +
    `• Kode referral: *${m.kodeReferral}*\n\n` +
    `*— Ringkasan —*\n` +
    `• Total simpanan: *${rupiah(totalSimpanan(m))}*\n` +
    `• Estimasi SHU: *${rupiah(m.estimasiSHU)}*\n` +
    `• Poin: *${m.poin.toLocaleString('id-ID')}*\n\n` +
    `*— Koperasi yang Kamu Ikuti —*\n` +
    `🏢 *${namaKoperasi}*\n` +
    `• Jenis: ${koperasi.jenis}\n` +
    `• Alamat: ${koperasi.alamat}\n` +
    `• Jam layanan: ${koperasi.jamLayanan}\n` +
    `• Kontak: ${koperasi.telp} · ${koperasi.email}\n\n` +
    `_Detail simpanan (menu 2), SHU (3), atau ajak teman (8). Ketik *menu* untuk semua pilihan._`
  );
}

/** Samarkan NIK (tampilkan 4 digit terakhir saja) — UU PDP. */
function maskNik(nik: string): string {
  return `${'•'.repeat(Math.max(0, nik.length - 4))}${nik.slice(-4)}`;
}

/** Tampilan kode referral + statistik Gotong Royong milik anggota. */
function referralView(m: Member): string {
  const st = stats(m.kodeReferral);
  return (
    `🤝 *Ajak Teman — Program Gotong Royong*\n\n` +
    `Kode referral kamu: *${m.kodeReferral}*\n\n` +
    `Tiap teman yang aktivasi pakai kodemu, kamu dapat *poin Gotong Royong* buat nambah bonus SHU! 🎁\n\n` +
    `📊 Sudah ngajak: *${st.ajakan} orang*\n` +
    `⭐ Poin Gotong Royong: *${st.poin}*\n\n` +
    `Bagikan pesan ini ke teman/tetangga 👇\n` +
    `_"Yuk gabung ${koperasi.name}! Chat WA ini, ketik *mulai* lalu pilih *5 Aktivasi*, dan pakai kode referral aku: ${m.kodeReferral} 🙌"_`
  );
}
