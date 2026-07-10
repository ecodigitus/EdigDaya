/**
 * SETOR SIMPANAN — engine setoran bersama (pokok / wajib / sukarela).
 *
 * Dipakai 3 pintu, SATU sumber kebenaran saldo (DRY):
 *   • Aktivasi                → pelunasan simpanan POKOK (sekali, syarat anggota)
 *   • Menu 1 "Simpanan saya"  → setor WAJIB / SUKARELA (+ pokok bila belum lunas)
 *   • Campaign nudge          → bayar WAJIB bulan ini (1-aksi)
 *
 * Pembayaran DISIMULASI (MVP): bot keluarkan Virtual Account + nominal, user
 * balas "sudah bayar" → saldo di-kredit. TIDAK pernah meminta PIN/OTP/kartu di
 * chat (OWASP; riwayat WA rawan). Nominal ditentukan SERVER-SIDE (dari profil
 * koperasi), bukan dari input user. Konfirmasi idempoten (draft dihapus setelah
 * kredit, jadi tak bisa dobel-credit).
 *
 * PRODUKSI: ganti konfirmasi manual dengan webhook payment gateway → catat ke
 * ledger SIMKOPDES; saldo baru dikredit setelah pembayaran benar-benar diterima.
 */
import { koperasi } from './business';
import { rupiah } from './format';
import { persistMember, type Member } from './members';

export type JenisSimpanan = 'pokok' | 'wajib' | 'sukarela';

const LABEL: Record<JenisSimpanan, string> = {
  pokok: 'Simpanan Pokok',
  wajib: 'Simpanan Wajib',
  sukarela: 'Simpanan Sukarela',
};

const SUKARELA_MIN = 10_000;
const SUKARELA_MAX = 100_000_000;
const POIN_SETOR = 25;

type Draft = { step: 'pilih' | 'nominal' | 'bayar'; jenis?: JenisSimpanan; nominal?: number; va?: string };
const drafts = new Map<string, Draft>();

// Kata "keluar" dari alur setor — termasuk sapaan/mulai biar user gak kejebak.
const CANCEL = ['batal', 'keluar', 'menu', 'stop', 'cancel', 'mulai', 'start', 'halo', 'hai', 'hi', 'p'];
const CONFIRM = ['sudah bayar', 'sudah', 'bayar', 'konfirmasi', 'konfirm', 'ok', 'oke', 'selesai', 'ya', 'done', 'lunas'];

/** True jika simpanan pokok sudah lunas (≥ nominal pokok koperasi). */
export function pokokLunas(m: Member): boolean {
  return m.simpananPokok >= koperasi.simpanan.pokok;
}

/** Kredit saldo simpanan (ledger murni; poin/gamifikasi diurus pemanggil). */
export function creditSimpanan(m: Member, jenis: JenisSimpanan, nominal: number): void {
  if (jenis === 'pokok') m.simpananPokok += nominal;
  else if (jenis === 'wajib') m.simpananWajib += nominal;
  else m.simpananSukarela += nominal;
}

/** True jika user sedang di alur setor. */
export function inSetor(jid: string): boolean {
  return drafts.has(jid);
}

/** Batalkan alur setor yang sedang berjalan (mis. saat user ketik "mulai"). */
export function cancelSetor(jid: string): void {
  drafts.delete(jid);
}

/**
 * Mulai alur setor. Tanpa `jenis` → tampilkan pemilih; dengan `jenis` →
 * langsung ke instruksi bayar. Untuk SUKARELA, bila `nominal` valid diberikan
 * (mis. dari intent "setor sukarela 500rb") → langsung ke konfirmasi bayar;
 * kalau tidak → minta nominal dulu. Nominal wajib/pokok selalu server-side.
 */
export function startSetor(jid: string, m: Member, jenis?: JenisSimpanan, nominal?: number): string {
  if (!jenis) {
    drafts.set(jid, { step: 'pilih' });
    return chooser(m);
  }
  if (jenis === 'sukarela') {
    if (nominal != null && nominal >= SUKARELA_MIN && nominal <= SUKARELA_MAX) {
      return toBayar(jid, m, 'sukarela', nominal);
    }
    drafts.set(jid, { step: 'nominal', jenis });
    return askNominal();
  }
  if (jenis === 'pokok' && pokokLunas(m)) {
    return '✅ Simpanan pokok kamu sudah lunas kok. Ketik *menu* untuk kembali.';
  }
  const nom = jenis === 'pokok' ? koperasi.simpanan.pokok : koperasi.simpanan.wajib;
  return toBayar(jid, m, jenis, nom);
}

/** Proses balasan saat user sedang di alur setor. Null bila tidak sedang setor. */
export function handleSetor(jid: string, m: Member, text: string): string | null {
  const d = drafts.get(jid);
  if (!d) return null;

  const raw = text.trim();
  const low = raw.toLowerCase();
  if (CANCEL.includes(low)) {
    drafts.delete(jid);
    return '❌ Setor dibatalkan. Ketik *menu* untuk kembali ya.';
  }

  switch (d.step) {
    case 'pilih': {
      if (['1', 'wajib'].includes(low)) return toBayar(jid, m, 'wajib', koperasi.simpanan.wajib);
      if (['2', 'sukarela'].includes(low)) {
        drafts.set(jid, { step: 'nominal', jenis: 'sukarela' });
        return askNominal();
      }
      if (['3', 'pokok'].includes(low)) {
        if (pokokLunas(m)) {
          drafts.delete(jid);
          return '✅ Simpanan pokok kamu sudah lunas kok. Ketik *menu* untuk kembali.';
        }
        return toBayar(jid, m, 'pokok', koperasi.simpanan.pokok);
      }
      return `Pilih *1* (Wajib), *2* (Sukarela)${pokokLunas(m) ? '' : ', atau *3* (Pokok)'}, atau ketik *batal*.`;
    }
    case 'nominal': {
      const nominal = parseRupiah(raw);
      if (nominal === null || nominal < SUKARELA_MIN) {
        return `⚠️ Nominal belum valid. Ketik angka min ${rupiah(SUKARELA_MIN)}, mis. *100rb*. _(atau *batal*)_`;
      }
      if (nominal > SUKARELA_MAX) return `⚠️ Nominal terlalu besar. Maksimal ${rupiah(SUKARELA_MAX)}.`;
      return toBayar(jid, m, 'sukarela', nominal);
    }
    case 'bayar': {
      if (!CONFIRM.includes(low)) {
        return `Kalau transfer sudah selesai, balas *sudah bayar* untuk konfirmasi.\n_Atau ketik *batal* / *menu* untuk keluar dari setor._`;
      }
      const jenis = d.jenis!;
      const nominal = d.nominal!;
      creditSimpanan(m, jenis, nominal); // kredit dulu, lalu hapus draft → idempoten
      m.poin += POIN_SETOR;
      persistMember(m); // write-through saldo & poin baru ke Supabase
      drafts.delete(jid);
      return receipt(m, jenis, nominal);
    }
  }
}

// ---------------- tampilan ----------------

function chooser(m: Member): string {
  const belumPokok = !pokokLunas(m);
  return (
    `💳 *Setor Simpanan*\n\n` +
    `Mau setor apa? (balas angka)\n` +
    `1. Wajib — ${rupiah(koperasi.simpanan.wajib)}/bulan\n` +
    `2. Sukarela — nominal bebas\n` +
    (belumPokok ? `3. Pokok — ${rupiah(koperasi.simpanan.pokok)} _(belum lunas)_\n` : '') +
    `\n_Ketik *batal* untuk berhenti._`
  );
}

function askNominal(): string {
  return (
    `💰 Mau setor sukarela berapa? Ketik nominalnya, mis. *100rb* atau *250000*.\n` +
    `_(min ${rupiah(SUKARELA_MIN)} · ketik *batal* untuk berhenti)_`
  );
}

function toBayar(jid: string, m: Member, jenis: JenisSimpanan, nominal: number): string {
  const va = makeVA(m);
  drafts.set(jid, { step: 'bayar', jenis, nominal, va });
  return (
    `🧾 *Instruksi Pembayaran — ${LABEL[jenis]}*\n\n` +
    `Nominal: *${rupiah(nominal)}*\n` +
    `No. Virtual Account: *${va}*\n` +
    `a.n. ${koperasi.name}\n\n` +
    `Transfer via m-banking/ATM ke VA di atas. Kalau sudah, balas *sudah bayar* untuk konfirmasi.\n` +
    `_(Demo: pembayaran disimulasikan — tak ada transaksi nyata. Jangan bagikan PIN/OTP ke siapa pun.)_`
  );
}

function receipt(m: Member, jenis: JenisSimpanan, nominal: number): string {
  const total = m.simpananPokok + m.simpananWajib + m.simpananSukarela;
  return (
    `✅ *Pembayaran terverifikasi (demo)!*\n\n` +
    `${LABEL[jenis]}: *+${rupiah(nominal)}*\n` +
    `⭐ +${POIN_SETOR} poin (total ${m.poin.toLocaleString('id-ID')})\n\n` +
    `Saldo simpanan sekarang:\n` +
    `• Pokok: ${rupiah(m.simpananPokok)}${pokokLunas(m) ? ' ✅' : ' _(belum lunas)_'}\n` +
    `• Wajib: ${rupiah(m.simpananWajib)}\n` +
    `• Sukarela: ${rupiah(m.simpananSukarela)}\n` +
    `━━━━━━━━━━━━━━\n` +
    `*Total: ${rupiah(total)}*\n\n` +
    `Makasih sudah setor! 🙌 Ketik *1* untuk lihat simpanan, atau *menu*.`
  );
}

// ---------------- helper ----------------

/** VA dummy deterministik dari nomor anggota (konsisten tiap demo). */
function makeVA(m: Member): string {
  const digits = m.noAnggota.replace(/\D/g, '').slice(-6).padStart(6, '0');
  return `8808 ${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/** Parse "100rb" / "100.000" / "Rp250000" / "1jt" → number; null bila gagal. */
function parseRupiah(raw: string): number | null {
  const t = raw.toLowerCase().replace(/rp|\s|\./g, '');
  const m = t.match(/^(\d+)(rb|ribu|k|jt|juta)?$/);
  if (!m) return null;
  let n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  if (m[2] === 'rb' || m[2] === 'ribu' || m[2] === 'k') n *= 1_000;
  else if (m[2] === 'jt' || m[2] === 'juta') n *= 1_000_000;
  return n;
}
