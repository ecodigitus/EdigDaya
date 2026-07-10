/**
 * PUSH NOTIFICATION (proaktif) — engine outbox + penjadwal sederhana untuk DEMO.
 *
 * Tujuan: menunjukkan bot bisa MENGHAMPIRI anggota (bukan cuma menunggu di-chat).
 * Pesan dijadwalkan lalu dikirim oleh "pump" di whatsapp.ts — jadi datang SENDIRI
 * ke nomor tujuan tanpa user mengetik apa pun (mirip reminder terjadwal).
 *
 * Demo di 1 HP: user ketik `notif wajib` / `notif shu` / dst → ~5 detik kemudian
 * pesan push masuk. Beberapa push nyambung ke flow interaktif yang sudah ada:
 *   • notif wajib → nudge (balas *YA* → saldo wajib beneran nambah, lihat setor)
 *   • notif erat  → surat suara e-RAT (balas *angka* → suara tercatat)
 *
 * PRODUKSI: penjadwal (setTimeout) diganti CRON/scheduler yang memicu berdasarkan
 * tanggal jatuh tempo & skor keterlibatan; kirim via gateway resmi. Tetap hormati
 * consent/opt-out anggota (UU PDP) dan rate limit (anti-spam).
 */
import { koperasi } from './business';
import { rupiah } from './format';
import { startNudgeFor, startVoteFor } from './campaigns';
import type { Member } from './members';

type Notif = { jid: string; text: string };

const queue: Notif[] = [];
const DELAY_SECONDS = 5; // jeda demo biar terasa "datang sendiri"

/** Antre 1 notifikasi untuk dikirim pump (dipakai internal & modul lain). */
export function enqueueNotif(jid: string, text: string): void {
  queue.push({ jid, text });
}

/** Ambil & kosongkan antrean (dipanggil pump di whatsapp.ts). */
export function drainNotifs(): Notif[] {
  return queue.splice(0, queue.length);
}

/**
 * Jadwalkan notifikasi. `builder` boleh string statis, atau fungsi yang dievaluasi
 * SAAT dikirim (dipakai agar startNudgeFor/startVoteFor mendaftarkan state pending
 * tepat sebelum push keluar).
 */
export function scheduleNotif(jid: string, builder: string | (() => string), delaySeconds = DELAY_SECONDS): void {
  const timer = setTimeout(() => {
    const text = typeof builder === 'function' ? builder() : builder;
    enqueueNotif(jid, text);
  }, Math.max(0, delaySeconds) * 1000);
  // Jangan menahan proses tetap hidup hanya karena timer ini.
  (timer as { unref?: () => void }).unref?.();
}

// ---------------- template notifikasi (dummy) ----------------

function shuTemplate(m: Member): string {
  return (
    `🎉 *Kabar Gembira — SHU Cair!*\n\n` +
    `Halo ${m.nama} 👋\n` +
    `SHU tahun buku 2025 sudah dibagikan. Estimasi bagianmu: *${rupiah(m.estimasiSHU)}*.\n\n` +
    `Cek rincian: ketik *2*. Dana disalurkan sesuai pilihanmu saat e-RAT. 🌾`
  );
}

function pinjamanTemplate(m: Member): string {
  if (m.pinjaman) {
    return (
      `🔔 *Pengingat Angsuran Pinjaman*\n\n` +
      `Halo ${m.nama}, angsuran bulan ini *${rupiah(m.pinjaman.angsuranPerBulan)}* akan jatuh tempo. ` +
      `Sisa tenor ${m.pinjaman.tenorSisa}x lagi.\n\n` +
      `Bayar tepat waktu biar skor keterlibatanmu terjaga 👍. Detail: ketik *3*.`
    );
  }
  return (
    `ℹ️ *Info Pinjaman*\n\n` +
    `Halo ${m.nama}, kamu belum punya pinjaman aktif. Anggota aktif bisa mengajukan s/d ${rupiah(koperasi.pinjaman.plafon)}. ` +
    `Ketik *3* untuk info.`
  );
}

// ---------------- handler perintah demo ----------------

const MENU_TRIGGERS = new Set(['demo notif', 'notif', 'notifikasi', 'pengingat', 'push notif', 'demo notifikasi']);

function notifMenu(): string {
  return (
    `🔔 *Demo Push Notification*\n\n` +
    `Bot bisa *menghampiri* anggota, bukan cuma nunggu di-chat. Pilih yang mau dikirim ke nomor ini (~${DELAY_SECONDS} detik lagi, datang sendiri):\n\n` +
    `• *notif wajib* — pengingat simpanan wajib belum dibayar\n` +
    `• *notif shu* — info pencairan SHU tahunan\n` +
    `• *notif erat* — undangan e-RAT + surat suara digital\n` +
    `• *notif pinjaman* — pengingat jatuh tempo angsuran\n\n` +
    `_Ketik salah satu perintah di atas._`
  );
}

function ack(label: string): string {
  return (
    `⏳ Oke! *${label}* akan dikirim sebagai *push notification* ~${DELAY_SECONDS} detik lagi — ` +
    `tanpa kamu mengetik apa pun. Tunggu ya... 👀\n\n` +
    `_Ini simulasi scheduler. Di produksi dipicu otomatis (cron) berdasarkan tanggal jatuh tempo & skor keterlibatan._`
  );
}

/**
 * Tangani perintah demo notifikasi (khusus anggota). Return balasan bila cocok,
 * atau null agar diteruskan ke handler lain (menu/AI).
 */
export function handleNotifDemo(jid: string, m: Member, text: string): string | null {
  const t = text.trim().toLowerCase();
  if (MENU_TRIGGERS.has(t)) return notifMenu();

  if (t === 'notif wajib') {
    // Reuse nudge: set state pending + kirim teksnya sebagai push (balas YA → saldo nambah).
    scheduleNotif(jid, () => startNudgeFor(jid, m));
    return ack('Pengingat simpanan wajib');
  }
  if (t === 'notif shu') {
    scheduleNotif(jid, shuTemplate(m));
    return ack('Info pencairan SHU');
  }
  if (t === 'notif erat') {
    // Reuse voting: kirim surat suara sebagai push (balas angka → suara tercatat).
    scheduleNotif(jid, () => startVoteFor(jid));
    return ack('Undangan e-RAT + surat suara');
  }
  if (t === 'notif pinjaman') {
    scheduleNotif(jid, pinjamanTemplate(m));
    return ack('Pengingat jatuh tempo angsuran');
  }
  return null;
}
