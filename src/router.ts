import { matchMenu } from './menu';
import { generateReply } from './ai';
import { getHistory, record, inAiMode, setAiMode } from './session';
import { getMember, isMember, type Member } from './members';
import { handleProspect } from './onboarding';
import { inActivation, startActivation, handleActivation, instantActivation } from './activation';
import { inPoForm, handlePoForm, startPoForm, handlePoUserReply, listUserPo } from './preorder';
import { dashboard, setViewRole } from './usaha';
import { inSetor, handleSetor, startSetor } from './simpanan';
import { handleNotifDemo } from './notifications';
import { handleCampaignReply, matchTrigger } from './campaigns';
import { config, aiEnabled, activeKeyEnv } from './config';
import { logger } from './logger';

// Kata kunci untuk MASUK mode ngobrol AI (berlaku untuk semua user).
const AI_ENTER = new Set([
  'ngobrol',
  'tanya',
  'tanya jawab',
  'asisten',
  'asisten koperasi',
  'chat',
  'ai',
  'ngobrol dengan asisten',
  'ngobrol dengan asisten koperasi',
]);

// Kata kunci untuk KELUAR dari mode ngobrol AI.
const AI_EXIT = new Set(['menu', 'keluar', 'selesai', 'stop', 'batal', 'exit', 'mulai', 'start']);

// Kata kunci untuk MASUK alur aktivasi akun (hanya untuk yang belum jadi anggota).
const ACTIVATION_ENTER = new Set([
  'aktivasi',
  'aktivasi akun',
  'aktivasi akun anggota koperasi',
  'daftar',
  'gabung',
  'registrasi',
]);

// Kata kunci untuk aktivasi FORM LENGKAP (12 langkah). Default opsi 4 = aktivasi kilat.
const ACTIVATION_MANUAL = new Set(['aktivasi manual', 'daftar manual', 'isi manual', 'form manual', 'aktivasi lengkap']);

// Kata kunci Pre-Order (khusus anggota).
const PO_ENTER = new Set(['pre-order', 'preorder', 'pre order', 'pesan barang', 'po baru', 'buat po']);
const PO_LIST = new Set(['po', 'po saya', 'pesanan saya', 'pesananku', 'pesanan']);

// Kata kunci Dashboard Usaha/Keuangan (POV member — papan tulis poin 2 & 3).
const DASHBOARD_ENTER = new Set([
  '9',
  'usaha',
  'dashboard',
  'dashboard usaha',
  'laporan usaha',
  'laporan',
  'keuangan',
  'keuangan saya',
  'modal',
  'pengeluaran',
  'stok',
  'penjualan',
]);
// Toggle demo "lihat sebagai" — biar 1 nomor bisa memperagakan 2 POV ke juri.
const VIEW_PRODUSEN = new Set(['mode produsen', 'lihat sebagai produsen', 'demo produsen', 'sebagai produsen']);
const VIEW_ANGGOTA = new Set(['mode anggota', 'lihat sebagai anggota', 'demo anggota', 'sebagai anggota', 'mode konsumen']);

// Kata kunci Setor Simpanan (khusus anggota) — pokok/wajib/sukarela lewat 1 engine.
const SETOR_ENTER = new Set(['setor', 'setor simpanan', 'bayar simpanan', 'nabung', 'menabung', 'setor tunai']);

/**
 * Otak hybrid: form aktivasi → mode ngobrol AI → kenali anggota → campaign
 * → menu rule-based → fallback AI. Selalu mengembalikan string balasan.
 */
export async function route(jid: string, text: string): Promise<string> {
  const t = text.trim().toLowerCase();
  const member = isMember(jid) ? getMember(jid) : null;

  // A) Sedang mengisi form aktivasi → lanjutkan langkah berikutnya
  if (inActivation(jid)) return handleActivation(jid, text);

  // A2) Sedang mengisi form Pre-Order → lanjutkan langkah berikutnya
  if (inPoForm(jid)) return handlePoForm(jid, text);

  // A3) Sedang di alur setor simpanan → lanjutkan (pilih/nominal/konfirmasi)
  if (inSetor(jid) && member) {
    const r = handleSetor(jid, member, text);
    if (r !== null) return r;
  }

  // B) Sedang di mode "ngobrol dengan asisten AI" → teruskan ke AI, atau keluar
  if (inAiMode(jid)) {
    if (AI_EXIT.has(t)) {
      setAiMode(jid, false);
      return '👋 Oke, kita sudahi dulu ngobrolnya. Ketik *menu* untuk lihat pilihan lagi ya.';
    }
    return chatWithAssistant(jid, text, member);
  }

  // C) Masuk mode ngobrol AI — opsi 3 di kartu prospek, atau kata kunci (semua user)
  if (AI_ENTER.has(t) || (t === '3' && member === null)) {
    if (!aiEnabled) {
      return `🤖 Fitur ngobrol dengan asisten AI belum aktif. Set *${activeKeyEnv}* di .env untuk mengaktifkannya. Sementara, ketik *menu* untuk pilihan lain ya. 🙏`;
    }
    setAiMode(jid, true);
    return introChat(member);
  }

  // D) Aktivasi akun (khusus non-anggota):
  //    - "aktivasi manual" dll → form lengkap 12 langkah
  //    - opsi 4 / kata kunci    → aktivasi KILAT pakai data contoh (demo cepat)
  if (member === null && ACTIVATION_MANUAL.has(t)) {
    return startActivation(jid);
  }
  if (member === null && (t === '4' || ACTIVATION_ENTER.has(t))) {
    return instantActivation(jid);
  }

  // E) Prospek (belum aktivasi) → alur onboarding (menu terkunci sampai aktivasi)
  if (member === null) return handleProspect(jid, text);

  // E2) Pre-Order (khusus anggota): buat PO, balas penawaran, atau lihat daftar
  if (t === '8' || PO_ENTER.has(t)) return startPoForm(jid, member.nama);
  const poReply = handlePoUserReply(jid, text);
  if (poReply !== null) return poReply;
  if (PO_LIST.has(t)) return listUserPo(jid);

  // E3) Dashboard Usaha/Keuangan (POV member — papan tulis poin 2 & 3).
  //     Toggle demo dulu, lalu tampilkan dashboard sesuai peran efektif nomor.
  if (VIEW_PRODUSEN.has(t)) return setViewRole(jid, 'produsen');
  if (VIEW_ANGGOTA.has(t)) return setViewRole(jid, 'anggota');
  if (DASHBOARD_ENTER.has(t)) return dashboard(jid, member);

  // F) Balasan untuk campaign yang sedang menunggu (voting / nudge)
  const campaignReply = handleCampaignReply(jid, text, member);
  if (campaignReply !== null) return campaignReply;

  // G) Trigger campaign dari anggota (mis. "voting", "nudge")
  const triggered = matchTrigger(jid, text, member);
  if (triggered !== null) return triggered;

  // G2) Setor simpanan (wajib/sukarela/pokok) — pakai deposit engine bersama
  if (SETOR_ENTER.has(t)) return startSetor(jid, member);

  // G3) Demo push notification (self-push berjadwal — datang sendiri ~5 detik)
  const notif = handleNotifDemo(jid, member, text);
  if (notif !== null) return notif;

  // H) Menu rule-based — sebagian dipersonalisasi per anggota
  const canned = matchMenu(text, member);
  if (canned) {
    record(jid, text, canned, config.limits.historyTurns);
    return canned;
  }

  // I) Kalau AI tidak aktif, arahkan ke menu / pengurus
  if (!aiEnabled) {
    return 'Untuk pertanyaan lain, ketik *menu* untuk pilihan, atau *pengurus* untuk terhubung dengan pengurus koperasi. 🙏';
  }

  // J) Fallback ke AI — sudah tahu konteks koperasi + data anggota
  return chatWithAssistant(jid, text, member);
}

/** Panggil asisten AI (Groq/Claude), catat riwayat, tangani error dengan ramah. */
async function chatWithAssistant(jid: string, text: string, member: Member | null): Promise<string> {
  try {
    const reply = await generateReply(getHistory(jid), text, member);
    record(jid, text, reply, config.limits.historyTurns);
    return reply;
  } catch (err) {
    logger.error({ err }, 'Gagal menghasilkan balasan AI');
    return 'Maaf, asistennya lagi ada gangguan 🙏. Coba lagi sebentar, atau ketik *pengurus* untuk bantuan langsung.';
  }
}

/** Pesan pembuka saat user masuk mode ngobrol AI. */
function introChat(member: Member | null): string {
  const sapa = member ? `, ${member.nama.split(' ')[0]}` : '';
  return (
    `🤖 *Asisten Koperasi siap ngobrol!*\n\n` +
    `Hai${sapa} 👋 Tanya apa aja soal koperasi — simpanan, pinjaman, SHU, cara gabung, dan lainnya.\n\n` +
    `Contoh: _"apa itu SHU?"_, _"pinjaman bunganya berapa?"_, atau _"kenapa harus gabung koperasi?"_\n\n` +
    `_Ketik *menu* atau *keluar* kapan saja untuk berhenti ngobrol._`
  );
}
