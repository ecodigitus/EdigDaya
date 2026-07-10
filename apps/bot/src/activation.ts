/**
 * Alur AKTIVASI AKUN ANGGOTA KOPERASI — form percakapan langkah-demi-langkah di
 * WhatsApp. Menggantikan "instant join": user harus aktivasi dulu sebelum bisa
 * memakai menu anggota.
 *
 * Keamanan (OWASP / UU PDP No.27/2022):
 * - TIDAK meminta password di chat (WA menyimpan riwayat). Password/finalisasi
 *   akun via portal SIMKOPDES nanti.
 * - Data form TIDAK di-log (tidak dicatat ke history AI maupun logger).
 * - Validasi input (NIK 16 digit, email, HP) — tolak input tak wajar.
 * - Persetujuan Domisili + UU PDP wajib dicentang sebelum submit.
 *
 * Backend disatukan lewat submitActivation() (dummy sekarang, SIMKOPDES nanti).
 */
import { activateMember, newMemberProfile } from './members';
import { koperasi } from './business';
import { rupiah } from './format';
import { submitActivation, type ActivationPayload } from './simkopdes';
import { listProvinsi, listKabupaten, listKecamatan, listDesa, listKoperasi } from './wilayah';
import { isValidCode, ownerName, creditReferral, POIN_PER_AJAKAN } from './referral';
import { ktpEnabled, type KtpData } from './ktp';

type Step =
  | 'mode'
  | 'ktp_review'
  | 'refopt'
  | 'refcode'
  | 'nama'
  | 'nik'
  | 'jk'
  | 'email'
  | 'hp'
  | 'prov'
  | 'kab'
  | 'kec'
  | 'desa'
  | 'kop'
  | 'domisili'
  | 'pdp'
  | 'confirm';

type Draft = {
  step: Step;
  referralCode?: string;
  namaLengkap?: string;
  nik?: string;
  jenisKelamin?: string;
  email?: string;
  nomorHp?: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  koperasi?: string;
  setujuDomisili?: boolean;
  setujuPdp?: boolean;
  ktp?: KtpData; // hasil scan KTP (untuk direview/dikoreksi sebelum lanjut)
};

const drafts = new Map<string, Draft>();

const JK = ['Laki-laki', 'Perempuan'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DOMISILI_TEXT =
  'Dengan ini saya menyatakan berdomisili satu wilayah dengan Koperasi Desa/Kelurahan Merah Putih. ' +
  'Jika dalam kemudian hari ditemukan kekeliruan informasi, saya bertanggung jawab sesuai dengan peraturan perundangan yang berlaku.';
const PDP_TEXT =
  'Saya menyetujui pemrosesan data pribadi saya sesuai dengan ketentuan Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.';

/** True jika user sedang mengisi form aktivasi. */
export function inActivation(jid: string): boolean {
  return drafts.has(jid);
}

/** Batalkan form aktivasi yang sedang berjalan (mis. saat user ketik "mulai"). */
export function cancelActivation(jid: string): void {
  drafts.delete(jid);
}

/**
 * Sub-menu awal aktivasi (dipakai opsi 4 / kata kunci aktivasi): user memilih
 * mau aktivasi KILAT (demo, data contoh) atau ISI FORM lengkap 12 langkah.
 */
export function startActivationMenu(jid: string): string {
  drafts.set(jid, { step: 'mode' });
  return (
    `📋 *Aktivasi Akun Anggota Koperasi*\n` +
    `Ketik *batal* kapan saja untuk berhenti.\n\n` +
    `Mau aktivasi yang mana? (balas angka)\n` +
    `1. ⚡ *Aktivasi kilat* _(demo — langsung jadi, pakai data contoh)_\n` +
    `2. 📝 *Isi form lengkap* _(12 langkah, isi data sendiri)_` +
    (ktpEnabled ? `\n\n📷 _Atau langsung kirim *foto KTP*-mu — nama, NIK, & data pribadi kuisi otomatis._` : '')
  );
}

/**
 * Aktivasi via FOTO KTP (OCR): prefill nama/NIK/jenis kelamin dari hasil OCR,
 * lalu lanjutkan form dari langkah email (atau jenis kelamin bila tak terbaca).
 * Sisa data (email, HP, wilayah, koperasi, persetujuan) tetap diisi seperti biasa.
 */
// Urutan field KTP untuk ditampilkan & dikoreksi (nomor 1..N di review).
const KTP_FIELDS: { key: keyof KtpData; label: string }[] = [
  { key: 'nik', label: 'NIK' },
  { key: 'nama', label: 'Nama' },
  { key: 'tempatTglLahir', label: 'Tempat/Tgl Lahir' },
  { key: 'jenisKelamin', label: 'Jenis Kelamin' },
  { key: 'golDarah', label: 'Gol. Darah' },
  { key: 'alamat', label: 'Alamat' },
  { key: 'rtRw', label: 'RT/RW' },
  { key: 'kelDesa', label: 'Kel/Desa' },
  { key: 'kecamatan', label: 'Kecamatan' },
  { key: 'agama', label: 'Agama' },
  { key: 'statusPerkawinan', label: 'Status Perkawinan' },
  { key: 'pekerjaan', label: 'Pekerjaan' },
  { key: 'kewarganegaraan', label: 'Kewarganegaraan' },
  { key: 'berlakuHingga', label: 'Berlaku Hingga' },
];

/** Ringkasan hasil OCR KTP untuk direview/dikoreksi user. */
function ktpSummary(k: KtpData): string {
  const rows = KTP_FIELDS.map((f, i) => `*${i + 1}.* ${f.label}: ${k[f.key] ?? '-'}`).join('\n');
  return (
    `📷 *Hasil baca KTP* — cek dulu ya, OCR kadang salah 🙏\n\n` +
    `${rows}\n\n` +
    `✅ Kalau sudah *benar semua*, balas *ya*.\n` +
    `✏️ Ada yang salah? Ketik *nomor + nilai benar*, mis. *2 Mira Setiawan* atau *6 Jl. Mawar No.5*.\n` +
    `_Ketik *aktivasi manual* untuk isi ulang dari awal. Foto KTP tidak disimpan (UU PDP)._`
  );
}

/** Prompt untuk langkah lanjutan setelah review KTP. */
function promptFor(st: 'nama' | 'nik' | 'jk' | 'email'): string {
  if (st === 'nama') return step(1, 'Siapa *nama lengkap* kamu?');
  if (st === 'nik') return step(2, 'Nomor Induk Kependudukan (*NIK*)? _(16 digit angka)_');
  if (st === 'jk') return step(3, `Pilih *jenis kelamin* (balas angka):\n${renderChoices(JK)}`);
  return step(4, 'Lanjut — alamat *email* kamu?');
}

/** Mulai aktivasi via KTP: tampilkan hasil OCR untuk direview/dikoreksi dulu. */
export function startActivationFromKtp(jid: string, ktp: KtpData): string {
  drafts.set(jid, { step: 'ktp_review', ktp });
  return ktpSummary(ktp);
}

/** Mulai form aktivasi — mulai dari pilihan cara daftar (pribadi / referral). */
export function startActivation(jid: string): string {
  drafts.set(jid, { step: 'refopt' });
  return `📋 *Aktivasi Akun Anggota Koperasi*\n` + `Ketik *batal* kapan saja untuk berhenti.\n\n` + refoptPrompt();
}

/** Prompt pilihan cara daftar (pribadi / referral). */
function refoptPrompt(): string {
  return `Mau daftar gimana? (balas angka)\n` + `1. Daftar pribadi\n` + `2. Pakai kode referral _(diajak teman)_`;
}

/** Prompt awal Bagian 1 (dipakai setelah pilihan referral selesai). */
function bagian1Nama(): string {
  return `*Bagian 1 — Informasi Pribadi*\n` + step(1, 'Siapa *nama lengkap* kamu?');
}

/**
 * Aktivasi KILAT (demo): langsung teraktivasi pakai data contoh tanpa isi form.
 * Tetap lewat adapter submitActivation() (dummy/SIMKOPDES) supaya alur konsisten.
 */
export async function instantActivation(jid: string): Promise<string> {
  drafts.delete(jid); // jaga-jaga kalau ada draft form yang menggantung
  const dummy: ActivationPayload = {
    namaLengkap: 'Warga Demo',
    nik: '3201234567890001',
    jenisKelamin: 'Laki-laki',
    email: 'warga.demo@example.com',
    nomorHp: jid.split('@')[0] || '6280000000000',
    provinsi: 'Jawa Barat',
    kabupaten: 'Kabupaten Bogor',
    kecamatan: 'Cibinong',
    desa: 'Sukamaju',
    koperasi: 'Koperasi Merah Putih Desa Sukamaju',
    setujuDomisili: true,
    setujuPdp: true,
  };

  const res = await submitActivation(dummy);
  const noAnggota = (res.ok && res.noAnggota) || 'KMP-DEMO';
  const profile = newMemberProfile(dummy.namaLengkap, noAnggota, {
    nik: dummy.nik,
    jenisKelamin: dummy.jenisKelamin,
    email: dummy.email,
    nomorHp: dummy.nomorHp,
    provinsi: dummy.provinsi,
    kabupaten: dummy.kabupaten,
    kecamatan: dummy.kecamatan,
    desa: dummy.desa,
    koperasi: dummy.koperasi,
  });
  activateMember(jid, profile);

  return (
    `⚡ *Aktivasi kilat (demo) berhasil!*\n\n` +
    `Kamu aktif sebagai *${dummy.namaLengkap}* _(data contoh)_.\n` +
    `Nomor anggota: *${noAnggota}*\n` +
    `Kode referral kamu: *${profile.kodeReferral}*\n\n` +
    `📝 *Data yang dipakai _(contoh)_:*\n` +
    `• Nama: ${dummy.namaLengkap}\n` +
    `• NIK: ${maskNik(dummy.nik)}\n` +
    `• Jenis Kelamin: ${dummy.jenisKelamin}\n` +
    `• Email: ${dummy.email}\n` +
    `• No. HP: ${dummy.nomorHp}\n` +
    `• Wilayah: ${dummy.desa}, ${dummy.kecamatan}, ${dummy.kabupaten}, ${dummy.provinsi}\n` +
    `• Koperasi: ${dummy.koperasi}\n` +
    `• Pernyataan Domisili: ✅\n` +
    `• Persetujuan UU PDP: ✅\n\n` +
    `_Mau isi form lengkap beneran? Ketik *aktivasi manual*._\n\n` +
    `💳 Simpanan pokok *${rupiah(koperasi.simpanan.pokok)}* belum dibayar — ketik *setor* untuk bayar sekarang (bisa juga nanti lewat *menu → 1*).\n\n` +
    `Sekarang semua layanan kebuka. Ketik *menu* ya! 🙌`
  );
}

/** Proses satu input dari user sesuai langkah form yang sedang aktif. */
export async function handleActivation(jid: string, text: string): Promise<string> {
  const d = drafts.get(jid);
  if (!d) return startActivation(jid);

  const raw = text.trim();
  const low = raw.toLowerCase();
  if (low === 'batal' || low === 'keluar') {
    drafts.delete(jid);
    return '❌ Aktivasi dibatalkan. Ketik *mulai* untuk kembali ke halaman awal ya.';
  }

  switch (d.step) {
    case 'ktp_review': {
      const k: KtpData = d.ktp ?? {};
      if (['aktivasi manual', 'manual', 'isi manual', 'ulang'].includes(low)) {
        return startActivation(jid);
      }
      if (['ya', 'iya', 'benar', 'betul', 'ok', 'oke', 'lanjut', 'bener', 'sudah'].includes(low)) {
        d.namaLengkap = k.nama;
        d.nik = k.nik && /^\d{16}$/.test(k.nik) ? k.nik : undefined;
        d.jenisKelamin = k.jenisKelamin && JK.includes(k.jenisKelamin) ? k.jenisKelamin : undefined;
        const nextStep: 'nama' | 'nik' | 'jk' | 'email' = !d.namaLengkap
          ? 'nama'
          : !d.nik
            ? 'nik'
            : !d.jenisKelamin
              ? 'jk'
              : 'email';
        d.step = nextStep;
        return `👍 Sip, data KTP disimpan.\n\n` + promptFor(nextStep);
      }
      // Koreksi per-field: "N nilai" (mis. "2 Mira Setiawan").
      const mm = raw.match(/^(\d{1,2})\s+(.+)$/);
      if (mm) {
        const idx = Number(mm[1]) - 1;
        if (idx < 0 || idx >= KTP_FIELDS.length) return err('Nomor field nggak valid. Contoh: *2 Mira Setiawan*.');
        const field = KTP_FIELDS[idx]!;
        let val = mm[2]!.trim();
        if (field.key === 'nik') val = val.replace(/\D/g, '');
        if (field.key === 'jenisKelamin') {
          val = /perempuan|^p$/i.test(val) ? 'Perempuan' : /laki|^l$/i.test(val) ? 'Laki-laki' : val;
        }
        d.ktp = { ...k, [field.key]: val };
        return `✏️ *${field.label}* diperbarui → *${val}*\n\n` + ktpSummary(d.ktp);
      }
      return `Balas *ya* kalau data sudah benar, ketik *nomor + nilai* untuk koreksi (mis. *2 Mira Setiawan*), atau *aktivasi manual* untuk isi dari awal.`;
    }
    case 'mode': {
      const v = parseChoice(raw, ['Aktivasi kilat', 'Isi form lengkap']);
      if (!v) return err('Pilih *1* (aktivasi kilat) atau *2* (isi form lengkap).');
      if (v === 'Aktivasi kilat') return instantActivation(jid); // instantActivation menghapus draft
      d.step = 'refopt';
      return refoptPrompt();
    }
    case 'refopt': {
      const v = parseChoice(raw, ['Daftar pribadi', 'Pakai kode referral']);
      if (!v) return err('Pilih *1* (daftar pribadi) atau *2* (pakai kode referral).');
      if (v === 'Pakai kode referral') {
        d.step = 'refcode';
        return `🤝 Masukkan *kode referral* dari yang ngajak kamu _(mis. BUDI2024)_.\nKetik *lewati* kalau nggak punya.`;
      }
      d.step = 'nama';
      return bagian1Nama();
    }
    case 'refcode': {
      if (['lewati', 'skip', 'gapunya', 'ga punya', 'tidak', 'tdk'].includes(low)) {
        d.step = 'nama';
        return `Oke, lanjut tanpa kode referral ya.\n\n` + bagian1Nama();
      }
      if (!isValidCode(raw)) {
        return err('Kode referral nggak ketemu 🙈. Cek lagi, atau ketik *lewati* untuk daftar tanpa kode.');
      }
      d.referralCode = raw.trim().toUpperCase().replace(/\s+/g, '');
      d.step = 'nama';
      return `Mantap! Kamu diajak *${ownerName(d.referralCode)}* ✅\n\n` + bagian1Nama();
    }
    case 'nama': {
      if (raw.length < 2 || raw.length > 60) return err('Nama belum valid 🙈. Ketik *nama lengkap* kamu (2–60 karakter).');
      d.namaLengkap = raw;
      d.step = 'nik';
      return step(2, 'Nomor Induk Kependudukan (*NIK*)? _(16 digit angka)_');
    }
    case 'nik': {
      const nik = raw.replace(/\s/g, '');
      if (!/^\d{16}$/.test(nik)) return err('NIK harus *16 digit angka*. Coba ketik lagi ya.');
      d.nik = nik;
      d.step = 'jk';
      return step(3, `Pilih *jenis kelamin* (balas angka):\n${renderChoices(JK)}`);
    }
    case 'jk': {
      const v = parseChoice(raw, JK);
      if (!v) return err(`Pilih salah satu (balas angka):\n${renderChoices(JK)}`);
      d.jenisKelamin = v;
      d.step = 'email';
      return step(4, 'Alamat *email* kamu?');
    }
    case 'email': {
      if (!EMAIL_RE.test(raw)) return err('Email sepertinya belum benar 🙈. Contoh: *nama@email.com*');
      d.email = raw;
      d.step = 'hp';
      return step(5, '*Nomor HP* kamu? _(format 08… atau 62…)_\nAtau ketik *ya* untuk pakai nomor WhatsApp ini.');
    }
    case 'hp': {
      const hp = ['ya', 'iya', 'sama', 'ini'].includes(low) ? jidPhone(jid) : normalizeHp(raw);
      if (!hp) return err('Nomor HP belum valid. Ketik nomor kamu, mis. *081234567890*.');
      d.nomorHp = hp;
      d.step = 'prov';
      return (
        `*Bagian 2 — Informasi Koperasi*\n` + step(6, `Pilih *Provinsi* (balas angka):\n${renderChoices(listProvinsi())}`)
      );
    }
    case 'prov': {
      const items = listProvinsi();
      const v = parseChoice(raw, items);
      if (!v) return err(`Pilih *Provinsi* (balas angka):\n${renderChoices(items)}`);
      d.provinsi = v;
      d.step = 'kab';
      return step(7, `Pilih *Kabupaten/Kota* (balas angka):\n${renderChoices(listKabupaten(v))}`);
    }
    case 'kab': {
      const items = listKabupaten(d.provinsi!);
      const v = parseChoice(raw, items);
      if (!v) return err(`Pilih *Kabupaten/Kota* (balas angka):\n${renderChoices(items)}`);
      d.kabupaten = v;
      d.step = 'kec';
      return step(8, `Pilih *Kecamatan* (balas angka):\n${renderChoices(listKecamatan(d.provinsi!, v))}`);
    }
    case 'kec': {
      const items = listKecamatan(d.provinsi!, d.kabupaten!);
      const v = parseChoice(raw, items);
      if (!v) return err(`Pilih *Kecamatan* (balas angka):\n${renderChoices(items)}`);
      d.kecamatan = v;
      d.step = 'desa';
      return step(9, `Pilih *Desa/Kelurahan* (balas angka):\n${renderChoices(listDesa(d.provinsi!, d.kabupaten!, v))}`);
    }
    case 'desa': {
      const items = listDesa(d.provinsi!, d.kabupaten!, d.kecamatan!);
      const v = parseChoice(raw, items);
      if (!v) return err(`Pilih *Desa/Kelurahan* (balas angka):\n${renderChoices(items)}`);
      d.desa = v;
      d.step = 'kop';
      const kops = listKoperasi(d.provinsi!, d.kabupaten!, d.kecamatan!, v);
      return step(10, `Pilih *Koperasi* (balas angka):\n${renderChoices(kops)}`);
    }
    case 'kop': {
      const items = listKoperasi(d.provinsi!, d.kabupaten!, d.kecamatan!, d.desa!);
      const v = parseChoice(raw, items);
      if (!v) return err(`Pilih *Koperasi* (balas angka):\n${renderChoices(items)}`);
      d.koperasi = v;
      d.step = 'domisili';
      return (
        `*Bagian 3 — Pernyataan & Persetujuan*\n\n` +
        `📜 *Pernyataan Domisili*\n_"${DOMISILI_TEXT}"_\n\n` +
        `Ketik *setuju* untuk menyetujui, atau *batal* untuk berhenti.`
      );
    }
    case 'domisili': {
      if (!isAgree(low)) return `Untuk lanjut, ketik *setuju* pada Pernyataan Domisili, atau *batal* untuk berhenti.`;
      d.setujuDomisili = true;
      d.step = 'pdp';
      return (
        `📜 *Persetujuan Data Pribadi (UU PDP)*\n_"${PDP_TEXT}"_\n\n` +
        `Ketik *setuju* untuk menyetujui, atau *batal* untuk berhenti.`
      );
    }
    case 'pdp': {
      if (!isAgree(low)) return `Untuk lanjut, ketik *setuju* pada Persetujuan UU PDP, atau *batal* untuk berhenti.`;
      d.setujuPdp = true;
      d.step = 'confirm';
      return summary(d);
    }
    case 'confirm': {
      if (['ulang', 'ubah', 'edit'].includes(low)) {
        drafts.set(jid, { step: 'nama', referralCode: d.referralCode });
        return `Oke, kita isi ulang dari awal ya.\n\n` + bagian1Nama();
      }
      if (!['ya', 'kirim', 'ok', 'oke', 'submit', 'benar', 'betul', 'setuju'].includes(low)) {
        return `Ketik *kirim* untuk mengirim data, *ulang* untuk isi dari awal, atau *batal* untuk berhenti.`;
      }
      return finish(jid, d);
    }
  }
}

/** Kirim data ke backend (dummy/SIMKOPDES), aktivasi anggota bila sukses. */
async function finish(jid: string, d: Draft): Promise<string> {
  const payload: ActivationPayload = {
    namaLengkap: d.namaLengkap!,
    nik: d.nik!,
    jenisKelamin: d.jenisKelamin!,
    email: d.email!,
    nomorHp: d.nomorHp!,
    provinsi: d.provinsi!,
    kabupaten: d.kabupaten!,
    kecamatan: d.kecamatan!,
    desa: d.desa!,
    koperasi: d.koperasi!,
    setujuDomisili: d.setujuDomisili === true,
    setujuPdp: d.setujuPdp === true,
    referralCode: d.referralCode,
  };

  const res = await submitActivation(payload);
  if (!res.ok) {
    // Draft tetap di step 'confirm' supaya user bisa coba kirim ulang.
    return `⚠️ Maaf, gagal mengirim data ke sistem (${res.error ?? 'error'}). Ketik *kirim* untuk coba lagi, atau *batal*.`;
  }

  const noAnggota = res.noAnggota ?? 'KMP-BARU';
  const profile = newMemberProfile(d.namaLengkap!, noAnggota, {
    nik: d.nik,
    jenisKelamin: d.jenisKelamin,
    email: d.email,
    nomorHp: d.nomorHp,
    provinsi: d.provinsi,
    kabupaten: d.kabupaten,
    kecamatan: d.kecamatan,
    desa: d.desa,
    koperasi: d.koperasi,
    ktp: d.ktp
      ? {
          tempatTglLahir: d.ktp.tempatTglLahir,
          golDarah: d.ktp.golDarah,
          alamat: d.ktp.alamat,
          rtRw: d.ktp.rtRw,
          kelDesa: d.ktp.kelDesa,
          kecamatan: d.ktp.kecamatan,
          agama: d.ktp.agama,
          statusPerkawinan: d.ktp.statusPerkawinan,
          pekerjaan: d.ktp.pekerjaan,
          kewarganegaraan: d.ktp.kewarganegaraan,
          berlakuHingga: d.ktp.berlakuHingga,
        }
      : undefined,
  });
  activateMember(jid, profile);
  drafts.delete(jid);

  // Program Gotong Royong: kredit poin ke pengajak (bila pakai kode referral valid).
  let referralNote = '';
  if (d.referralCode) {
    const credit = creditReferral(d.referralCode);
    if (credit.ok) {
      referralNote = `\n🤝 Kamu diajak *${credit.name}* — beliau dapat *+${POIN_PER_AJAKAN} poin Gotong Royong* untuk bonus SHU. Makasih sudah gotong royong! 🙌\n`;
    }
  }

  return (
    `🎉 *Aktivasi berhasil!*\n\n` +
    `Selamat datang, *${d.namaLengkap}* 🌾\n` +
    `Nomor anggota: *${noAnggota}*\n` +
    `Koperasi: ${d.koperasi}\n` +
    referralNote +
    `\n🎁 *Kode referral kamu:* *${profile.kodeReferral}*\n` +
    `Ajak teman/tetangga daftar pakai kodemu buat kumpulin poin Gotong Royong! _(ketik *ajak*)_\n\n` +
    `💳 Langkah terakhir: bayar *simpanan pokok ${rupiah(koperasi.simpanan.pokok)}* (sekali) — ketik *setor* untuk bayar sekarang, atau nanti lewat *menu → 1*.\n\n` +
    `_(Data demo — nanti otomatis terhubung ke SIMKOPDES.)_\n\n` +
    `Sekarang kamu sudah bisa akses semua layanan. Ketik *menu* ya! 🙌`
  );
}

/** Ringkasan data sebelum submit (untuk dikonfirmasi user). */
function summary(d: Draft): string {
  return (
    `📝 *Cek data kamu:*\n\n` +
    `• Cara daftar: ${d.referralCode ? `referral (${d.referralCode})` : 'pribadi'}\n` +
    `• Nama: ${d.namaLengkap}\n` +
    `• NIK: ${maskNik(d.nik!)}\n` +
    `• Jenis Kelamin: ${d.jenisKelamin}\n` +
    `• Email: ${d.email}\n` +
    `• No. HP: ${d.nomorHp}\n` +
    `• Wilayah: ${d.desa}, ${d.kecamatan}, ${d.kabupaten}, ${d.provinsi}\n` +
    `• Koperasi: ${d.koperasi}\n` +
    `• Pernyataan Domisili: ✅\n` +
    `• Persetujuan UU PDP: ✅\n\n` +
    `Sudah benar? Ketik *kirim* untuk daftar, *ulang* untuk isi lagi, atau *batal*.`
  );
}

// ---- helper ----

function step(n: number, prompt: string): string {
  return `*Langkah ${n}/12* — ${prompt}`;
}

function err(msg: string): string {
  return `⚠️ ${msg}`;
}

function renderChoices(items: string[]): string {
  return items.map((it, i) => `${i + 1}. ${it}`).join('\n');
}

/** Terima input pilihan berupa nomor (1..n) atau nama persis (case-insensitive). */
function parseChoice(input: string, items: string[]): string | null {
  const t = input.trim();
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= items.length) return items[n - 1] ?? null;
  return items.find((it) => it.toLowerCase() === t.toLowerCase()) ?? null;
}

function isAgree(low: string): boolean {
  return ['setuju', 'ya', 'iya', 'y', 'oke', 'ok', 'sepakat', '1'].includes(low);
}

function jidPhone(jid: string): string {
  return jid.split('@')[0] ?? '';
}

/** Normalisasi nomor HP Indonesia ke format 62xxxx; null jika tak valid. */
function normalizeHp(raw: string): string | null {
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  if (!/^62\d{8,13}$/.test(digits)) return null;
  return digits;
}

/** Samarkan NIK di ringkasan (tampilkan 4 digit terakhir saja). */
function maskNik(nik: string): string {
  return `${'•'.repeat(Math.max(0, nik.length - 4))}${nik.slice(-4)}`;
}
