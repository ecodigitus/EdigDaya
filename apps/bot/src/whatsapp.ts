import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  DisconnectReason,
  type WASocket,
  type proto,
} from '@whiskeysockets/baileys';
import { existsSync } from 'node:fs';
import qrcode from 'qrcode-terminal';
import { config } from './config';
import { logger, waLogger, maskJid } from './logger';
import { allowed, setAiMode } from './session';
import { cancelActivation, startActivationFromKtp } from './activation';
import { extractKtp, ktpEnabled } from './ktp';
import { cancelPeriksa } from './periksaaktivasi';
import { cancelLaporan } from './laporan';
import { cancelPoForm, drainOutbox, handleAdminPo } from './preorder';
import { cancelSetor } from './simpanan';
import { route } from './router';
import { getMember, isMember } from './members';
import { startVoteFor, startNudgeFor } from './campaigns';
import { drainNotifs } from './notifications';
import { transcribeOggOpus, sttEnabled } from './voice';
import { welcomeCaption } from './welcome';

// Perintah yang memicu welcome card (logo + caption + pilihan).
const WELCOME_TRIGGERS = new Set(['mulai', 'start', '/start', '/mulai']);

// Socket aktif + penanda pump, agar push terjadwal bisa dikirim kapan saja.
let activeSock: WASocket | null = null;
let notifPumpStarted = false;

/**
 * Pump notifikasi proaktif: tiap beberapa detik, kuras antrean push terjadwal
 * (notifications.ts) lalu kirim via socket aktif — jadi pesan bisa datang SENDIRI
 * meski user tidak sedang chat. Dijalankan sekali (idempoten saat reconnect).
 */
function startNotifPump(): void {
  if (notifPumpStarted) return;
  notifPumpStarted = true;
  setInterval(async () => {
    if (!activeSock) return;
    for (const n of drainNotifs()) {
      try {
        await activeSock.sendMessage(n.jid, { text: n.text });
        logger.info({ jid: maskJid(n.jid) }, 'Push notification terkirim');
      } catch (err) {
        logger.warn({ err, jid: maskJid(n.jid) }, 'Gagal mengirim push notification');
      }
    }
  }, 3000).unref();
}

/** Ambil teks dari berbagai tipe pesan WhatsApp. */
function extractText(msg: proto.IWebMessageInfo): string {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

/** Boot koneksi WhatsApp, tampilkan QR, dan pasang handler pesan. */
export async function startBot(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(config.wa.authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: waLogger,
    markOnlineOnConnect: false,
    browser: ['WA CS Bot', 'Chrome', '1.0.0'],
  });

  activeSock = sock; // simpan referensi untuk pump push proaktif
  startNotifPump(); // mulai pengirim notifikasi terjadwal (sekali)

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('📱 Scan QR berikut di HP: WhatsApp > Perangkat Tertaut > Tautkan perangkat');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      logger.info('✅ Terhubung ke WhatsApp! Bot siap menerima pesan.');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
        ?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        logger.error('❌ Sesi logout dari HP. Hapus folder auth lalu jalankan ulang untuk scan QR baru.');
        return;
      }
      logger.warn({ statusCode }, '🔁 Koneksi terputus, mencoba menyambung ulang...');
      startBot().catch((e) => logger.error({ e }, 'Reconnect gagal'));
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        await handleMessage(sock, msg);
      } catch (err) {
        logger.error({ err }, 'Gagal memproses pesan masuk');
      }
    }
  });
}

/** Proses satu pesan masuk: validasi -> rate limit -> route -> balas. */
async function handleMessage(sock: WASocket, msg: proto.IWebMessageInfo): Promise<void> {
  const key = msg.key;
  if (!key?.remoteJid) return;
  const jid = key.remoteJid;
  if (key.fromMe) return; // abaikan pesan sendiri
  if (jid === 'status@broadcast') return; // abaikan status

  const isGroup = jid.endsWith('@g.us');
  if (isGroup && !config.wa.handleGroups) return;

  let text = extractText(msg).trim();
  let viaVoice = false;

  // Voice note (PTT) → transkrip ke teks via GCP Speech-to-Text (inklusi desa:
  // anggota bisa "ngomong" alih-alih mengetik). OGG/Opus dikirim langsung.
  if (!text && msg.message?.audioMessage) {
    if (!sttEnabled) {
      await sock.sendMessage(jid, {
        text: '🎤 Maaf, fitur pesan suara belum aktif 🙏. Ketik pesan *teks* ya, atau ketik *mulai*.',
      });
      return;
    }
    try {
      const buf = (await downloadMediaMessage(
        msg as Parameters<typeof downloadMediaMessage>[0],
        'buffer',
        {},
        { logger: waLogger, reuploadRequest: sock.updateMediaMessage },
      )) as Buffer;
      const transcript = await transcribeOggOpus(buf);
      if (transcript) {
        text = transcript;
        viaVoice = true;
      }
    } catch (err) {
      logger.warn({ err, jid: maskJid(jid) }, 'Gagal memproses voice note');
    }
    if (!text) {
      await sock.sendMessage(jid, {
        text: '🎤 Maaf, suaranya kurang jelas 🙏. Coba ulangi, atau ketik pesannya ya.',
      });
      return;
    }
  }

  // Foto KTP (khusus CALON anggota) → OCR isi otomatis data pendaftaran.
  if (!text && msg.message?.imageMessage) {
    if (isMember(jid)) {
      await sock.sendMessage(jid, { text: 'Kirim pesan *teks* ya untuk perintah. Ketik *menu* untuk pilihan. 🙂' });
      return;
    }
    if (!ktpEnabled) {
      await sock.sendMessage(jid, { text: '📷 Fitur foto KTP belum aktif. Ketik *aktivasi* untuk daftar manual ya. 🙌' });
      return;
    }
    try {
      const buf = (await downloadMediaMessage(
        msg as Parameters<typeof downloadMediaMessage>[0],
        'buffer',
        {},
        { logger: waLogger, reuploadRequest: sock.updateMediaMessage },
      )) as Buffer;
      const ktp = await extractKtp(buf);
      // Cukup salah satu (nik ATAU nama) kebaca → mulai; sisanya diisi di form.
      if (ktp && (ktp.nik || ktp.nama)) {
        await sock.sendMessage(jid, { text: startActivationFromKtp(jid, ktp) });
        logger.info({ jid: maskJid(jid) }, 'Aktivasi via KTP dimulai');
        return;
      }
    } catch (err) {
      logger.warn({ err, jid: maskJid(jid) }, 'Gagal OCR KTP');
    }
    await sock.sendMessage(jid, {
      text: '📷 Maaf, KTP-nya kurang kebaca 🙏. Coba foto lebih jelas (terang & fokus, NIK kelihatan), atau ketik *aktivasi* untuk isi manual.',
    });
    return;
  }

  // Validasi input (OWASP: jangan proses input tak wajar)
  if (!text) {
    await sock.sendMessage(jid, { text: 'Halo! 👋 Kirim pesan *teks* ya. Ketik *mulai* untuk memulai. 🙌' });
    return;
  }
  if (text.length > config.limits.maxInboundChars) {
    await sock.sendMessage(jid, { text: 'Pesannya kepanjangan 😅. Boleh dipersingkat ya?' });
    return;
  }

  // Rate limit per user
  if (!allowed(jid, config.limits.rateMaxPerMin)) {
    logger.warn({ jid: maskJid(jid) }, 'Rate limit tercapai');
    await sock.sendMessage(jid, { text: 'Waduh, pesannya kecepetan 😅. Tunggu sebentar ya, lalu kirim lagi.' });
    return;
  }

  // Perintah admin (broadcast proaktif) — hanya nomor terdaftar (akses terbatas / OWASP A01)
  const senderPhone = jid.split('@')[0] ?? '';
  if (config.admin.numbers.includes(senderPhone)) {
    const adminReply = await handleAdminCommand(sock, text.trim());
    if (adminReply) {
      await sock.sendMessage(jid, { text: adminReply });
      await flushOutbox(sock); // kirim notifikasi PO ke user (mis. penawaran/finalisasi)
      logger.info({ jid: maskJid(jid) }, 'Perintah admin dieksekusi');
      return;
    }
  }

  logger.info({ jid: maskJid(jid) }, 'Pesan masuk');

  // Welcome card: "mulai"/"start" -> logo koperasi + caption + pilihan bernomor
  if (WELCOME_TRIGGERS.has(text.toLowerCase())) {
    setAiMode(jid, false); // reset: kalau lagi ngobrol AI, "mulai" mengembalikan ke menu awal
    cancelActivation(jid); // reset: batalkan form aktivasi yang sedang berjalan
    cancelPeriksa(jid); // reset: batalkan alur Periksa Aktivasi yang sedang berjalan
    cancelLaporan(jid); // reset: batalkan form laporan (menu 13) yang sedang berjalan
    cancelSetor(jid); // reset: batalkan alur setor simpanan yang sedang berjalan
    cancelPoForm(jid); // reset: batalkan form Pre-Order yang sedang berjalan
    await sendWelcomeCard(sock, jid);
    logger.info({ jid: maskJid(jid) }, 'Welcome card terkirim');
    return;
  }

  // Indikator "sedang mengetik" biar terasa natural
  try {
    await sock.sendPresenceUpdate('composing', jid);
  } catch {
    /* non-fatal */
  }

  const reply = await route(jid, text);

  try {
    await sock.sendPresenceUpdate('paused', jid);
  } catch {
    /* non-fatal */
  }

  // Kalau input lewat suara, echo hasil transkrip dulu biar user tahu yang bot dengar.
  const out = viaVoice ? `🎤 _"${text}"_\n\n${reply}` : reply;
  await sock.sendMessage(jid, { text: out });
  await flushOutbox(sock); // kirim notifikasi PO (mis. ke admin saat PO baru dibuat)
  logger.info({ jid: maskJid(jid) }, 'Balasan terkirim');
}

/** Kirim semua notifikasi proaktif yang diantre modul PO (ke user/admin lain). */
async function flushOutbox(sock: WASocket): Promise<void> {
  for (const n of drainOutbox()) {
    try {
      await sock.sendMessage(n.jid, { text: n.text });
    } catch (err) {
      logger.warn({ err, jid: maskJid(n.jid) }, 'Gagal mengirim notifikasi PO');
    }
  }
}

/**
 * Kirim welcome card: logo koperasi + caption sambutan berisi pilihan bernomor.
 * Caption disesuaikan status pengirim (prospek vs anggota). Kalau file logo
 * tidak ada, tetap kirim caption sebagai teks biasa (jangan sampai gagal/crash).
 */
async function sendWelcomeCard(sock: WASocket, jid: string): Promise<void> {
  const caption = welcomeCaption(jid);
  const logoPath = config.wa.logoPath;

  if (existsSync(logoPath)) {
    await sock.sendMessage(jid, { image: { url: logoPath }, caption });
  } else {
    logger.warn({ logoPath }, 'File logo tidak ditemukan — kirim caption tanpa gambar');
    await sock.sendMessage(jid, { text: caption });
  }
}

/**
 * Perintah admin untuk mengirim campaign secara PROAKTIF (push) ke daftar
 * nomor tujuan. Ini "wow moment" fitur andalan: bot menghampiri anggota,
 * bukan menunggu. Return pesan balasan untuk admin, atau null bila bukan perintah.
 */
async function handleAdminCommand(sock: WASocket, raw: string): Promise<string | null> {
  const cmd = raw.toLowerCase();

  // Command Pre-Order (po list/lihat/quote/alih/final/batal) — notifikasi user via outbox.
  if (cmd === 'po' || cmd.startsWith('po ')) return handleAdminPo(raw);

  const isVote = cmd === 'push voting' || cmd === 'broadcast voting';
  const isNudge = cmd === 'push nudge' || cmd === 'broadcast nudge';
  if (!isVote && !isNudge) return null;

  const targets = config.admin.broadcastTargets;
  if (targets.length === 0) {
    return 'Set *BROADCAST_TARGETS* di .env dulu (nomor tujuan demo, format 62..., pisah koma).';
  }

  let sent = 0;
  for (const num of targets) {
    const targetJid = `${num}@s.whatsapp.net`;
    const text = isVote ? startVoteFor(targetJid) : startNudgeFor(targetJid, getMember(targetJid));
    try {
      await sock.sendMessage(targetJid, { text });
      sent++;
    } catch (err) {
      logger.warn({ err, target: maskJid(targetJid) }, 'Gagal mengirim broadcast');
    }
  }

  const jenis = isVote ? 'Surat suara e-RAT' : 'Nudge re-aktivasi';
  return `📢 ${jenis} dikirim *proaktif* ke *${sent}* anggota. Mereka tinggal balas dari chat masing-masing. 🚀`;
}
