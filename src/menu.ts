import { koperasi, mainMenu } from './business';
import { rupiah } from './format';
import { totalSimpanan, type Member } from './members';

/**
 * Router rule-based koperasi: cocokkan pesan dengan menu/kata kunci.
 * Sebagian jawaban dipersonalisasi pakai data anggota (m).
 * Return string balasan kalau cocok, atau null kalau harus dilempar ke AI.
 */
export function matchMenu(raw: string, m: Member): string | null {
  const t = raw.trim().toLowerCase();

  const greetings = ['menu', 'mulai', 'start', 'halo', 'hallo', 'hai', 'hi', 'p', 'assalamualaikum'];
  if (greetings.includes(t)) return mainMenu();

  // 1 — Info & cara gabung  (funnel: Kenal → Gabung)
  if (['1', 'info', 'gabung', 'daftar', 'anggota', 'jadi anggota', 'cara daftar'].includes(t)) {
    return (
      `📝 *Cara jadi anggota ${koperasi.name}:*\n\n` +
      `1. Isi formulir pendaftaran + foto KTP\n` +
      `2. Bayar simpanan pokok ${rupiah(koperasi.simpanan.pokok)} (sekali)\n` +
      `3. Simpanan wajib ${rupiah(koperasi.simpanan.wajib)}/bulan\n\n` +
      `Setelah aktif kamu dapat: akses simpan-pinjam, bagi hasil SHU tahunan, dan hak suara di RAT. 🎉\n` +
      `Ketik *pengurus* untuk dibantu mendaftar.`
    );
  }

  // 2 — Simpanan saya  (funnel: Transaksi · transparansi)
  if (['2', 'simpanan', 'saldo', 'tabungan', 'simpanan saya'].includes(t)) {
    return (
      `💰 *Simpanan ${m.nama}* (${m.noAnggota})\n\n` +
      `• Pokok: ${rupiah(m.simpananPokok)}\n` +
      `• Wajib: ${rupiah(m.simpananWajib)}\n` +
      `• Sukarela: ${rupiah(m.simpananSukarela)}\n` +
      `━━━━━━━━━━━━━━\n` +
      `*Total: ${rupiah(totalSimpanan(m))}*\n\n` +
      `_Data per hari ini. Mau setor/tarik simpanan? Ketik *pengurus*._`
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

  return null;
}
