import { matchMenu } from './menu';
import { generateReply, matchModelSwitch } from './ai';
import { getHistory, record, inAiMode, setAiMode } from './session';
import { getMember, isMember, forgetMember, type Member } from './members';
import { handleProspect } from './onboarding';
import { inActivation, startActivation, startActivationMenu, handleActivation, cancelActivation } from './activation';
import { inPeriksa, startPeriksa, handlePeriksa, cancelPeriksa } from './periksaaktivasi';
import { inPoForm, handlePoForm, startPoForm, handlePoUserReply, listUserPo } from './preorder';
import { dashboard, setViewRole } from './usaha';
import { inSetor, handleSetor, startSetor } from './simpanan';
import { pengurusView } from './pengurus';
import { pengumumanView } from './pengumuman';
import { inLaporan, startLaporan, handleLaporan, listLaporan, cancelLaporan } from './laporan';
import { koperasiGlobalView } from './koperasiglobal';
import { handleIntent } from './intent';
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

// Kata kunci untuk aktivasi FORM LENGKAP (12 langkah). Default opsi 5 = aktivasi kilat.
const ACTIVATION_MANUAL = new Set(['aktivasi manual', 'daftar manual', 'isi manual', 'form manual', 'aktivasi lengkap']);

// Kata kunci Periksa Aktivasi (opsi 1) — untuk yang SUDAH terdaftar di sistem.
const PERIKSA_ENTER = new Set(['periksa aktivasi', 'cek aktivasi', 'periksa', 'sudah terdaftar', 'verifikasi']);

// Kata kunci Pre-Order (khusus anggota).
const PO_ENTER = new Set(['pre-order', 'preorder', 'pre order', 'pesan barang', 'po baru', 'buat po']);
const PO_LIST = new Set(['po', 'po saya', 'pesanan saya', 'pesananku', 'pesanan']);

// Kata kunci Dashboard Usaha/Keuangan (POV member — papan tulis poin 2 & 3).
const DASHBOARD_ENTER = new Set([
  '10',
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

// Kata kunci menu baru (khusus anggota). "pengurus" polos tetap = handoff (menu 7),
// jadi pengurus di sini pakai frasa spesifik.
const PENGURUS_ENTER = new Set(['12', 'daftar pengurus', 'susunan pengurus', 'pengurus lengkap']);
const PENGUMUMAN_ENTER = new Set(['13', 'pengumuman', 'pengumuman koperasi', 'kabar koperasi']);
const LAPORAN_LIST = new Set(['daftar laporan', 'lihat laporan', 'list laporan', 'riwayat laporan']);
// Catatan: "laporan" polos sengaja TIDAK dipakai di sini (sudah = dashboard usaha, menu 10).
const LAPORAN_ENTER = new Set(['14', 'anggota jaga anggota', 'jaga anggota', 'lapor', 'buat laporan']);

// Menu 15 — Koperasi Global (statistik nasional, read-only dari DB hackathon).
const KOPGLOBAL_ENTER = new Set([
  '15',
  'koperasi global',
  'data nasional',
  'koperasi nasional',
  'statistik koperasi',
  'total koperasi',
]);

// DEMO: reset status nomor → kembali jadi calon anggota (untuk ulang demo aktivasi ke juri).
const RESET = new Set(['reset', 'reset demo']);

/**
 * Otak hybrid: form aktivasi → mode ngobrol AI → kenali anggota → campaign
 * → menu rule-based → fallback AI. Selalu mengembalikan string balasan.
 */
export async function route(jid: string, text: string): Promise<string> {
  const t = text.trim().toLowerCase();

  // 0) DEMO: reset — kembalikan nomor ke status calon anggota (welcome muncul lagi).
  //    Dicek paling awal agar tetap jalan meski sedang di tengah alur (aktivasi/AI/dll).
  if (RESET.has(t)) {
    forgetMember(jid); // in-memory saja (non-destruktif; data Supabase tetap)
    cancelActivation(jid);
    cancelPeriksa(jid);
    cancelLaporan(jid);
    setAiMode(jid, false);
    return (
      `🔄 *Reset demo berhasil.* Nomor ini kembali jadi *calon anggota*.\n\n` +
      `Ketik *mulai* untuk lihat welcome & alur aktivasi dari awal. 🙌`
    );
  }

  // 0b) Command khusus (tanpa menu): ganti provider AI saat runtime.
  //     Dicek awal agar jalan kapan pun. Mis. "ganti model groq" / "pakai vertex".
  const modelSwitch = matchModelSwitch(text);
  if (modelSwitch !== null) return modelSwitch;

  const member = isMember(jid) ? getMember(jid) : null;

  // A) Sedang mengisi form aktivasi → lanjutkan langkah berikutnya
  if (inActivation(jid)) return handleActivation(jid, text);

  // A0) Sedang di alur Periksa Aktivasi → lanjutkan (minta NIK / Nomor Anggota)
  if (inPeriksa(jid)) return handlePeriksa(jid, text);

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

  // C) Masuk mode ngobrol AI — opsi 4 di kartu prospek, opsi 11 di menu anggota,
  //    atau kata kunci (semua user)
  if (AI_ENTER.has(t) || (t === '4' && member === null) || (t === '11' && member !== null)) {
    if (!aiEnabled) {
      return `🤖 Fitur ngobrol dengan asisten AI belum aktif. Set *${activeKeyEnv}* di .env untuk mengaktifkannya. Sementara, ketik *menu* untuk pilihan lain ya. 🙏`;
    }
    setAiMode(jid, true);
    return introChat(member);
  }

  // D0) Periksa Aktivasi (khusus non-anggota, opsi 1): untuk yang SUDAH terdaftar
  if (member === null && (t === '1' || PERIKSA_ENTER.has(t))) {
    return startPeriksa(jid);
  }

  // D) Aktivasi akun BARU (khusus non-anggota):
  //    - "aktivasi manual" dll → langsung ke form lengkap 12 langkah
  //    - opsi 5 / kata kunci    → sub-menu: pilih aktivasi KILAT atau ISI FORM
  if (member === null && ACTIVATION_MANUAL.has(t)) {
    return startActivation(jid);
  }
  if (member === null && (t === '5' || ACTIVATION_ENTER.has(t))) {
    return startActivationMenu(jid);
  }

  // E) Prospek (belum aktivasi) → alur onboarding (menu terkunci sampai aktivasi)
  if (member === null) return handleProspect(jid, text);

  // E0) Sedang di alur "Anggota Jaga Anggota" (menu 13) → lanjutkan langkahnya
  if (inLaporan(jid)) return handleLaporan(jid, member, text);

  // E2) Pre-Order (khusus anggota): buat PO, balas penawaran, atau lihat daftar
  if (t === '9' || PO_ENTER.has(t)) return startPoForm(jid, member.nama);
  const poReply = handlePoUserReply(jid, text);
  if (poReply !== null) return poReply;
  if (PO_LIST.has(t)) return listUserPo(jid);

  // E3) Dashboard Usaha/Keuangan (POV member — papan tulis poin 2 & 3).
  //     Toggle demo dulu, lalu tampilkan dashboard sesuai peran efektif nomor.
  if (VIEW_PRODUSEN.has(t)) return setViewRole(jid, 'produsen');
  if (VIEW_ANGGOTA.has(t)) return setViewRole(jid, 'anggota');
  if (DASHBOARD_ENTER.has(t)) return dashboard(jid, member);

  // E4) Menu baru: pengurus (11) / pengumuman (12) / anggota jaga anggota (13)
  if (PENGURUS_ENTER.has(t)) return pengurusView();
  if (PENGUMUMAN_ENTER.has(t)) return pengumumanView();
  if (LAPORAN_LIST.has(t)) return listLaporan();
  if (LAPORAN_ENTER.has(t)) return startLaporan(jid);
  if (KOPGLOBAL_ENTER.has(t)) return koperasiGlobalView();

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

  // I2) INTENT LAYER: pahami kalimat bebas (teks/voice) → jalankan aksi menu yang
  //     sesuai (mis. "mau setor sukarela 500rb" → langsung ke konfirmasi setor).
  //     Null bila tak ada aksi jelas → lanjut ke ngobrol AI biasa.
  const acted = await handleIntent(jid, member, text);
  if (acted !== null) return acted;

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
