import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  type WASocket,
  type proto,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { config } from './config';
import { logger, waLogger, maskJid } from './logger';
import { allowed } from './session';
import { route } from './router';
import { getMember } from './members';
import { startVoteFor, startNudgeFor } from './campaigns';

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

  const text = extractText(msg).trim();

  // Validasi input (OWASP: jangan proses input tak wajar)
  if (!text) {
    await sock.sendMessage(jid, { text: 'Halo! Kirim pesan *teks* ya. Ketik *menu* untuk lihat pilihan. 🙂' });
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
    const adminReply = await handleAdminCommand(sock, text.trim().toLowerCase());
    if (adminReply) {
      await sock.sendMessage(jid, { text: adminReply });
      logger.info({ jid: maskJid(jid) }, 'Perintah admin dieksekusi');
      return;
    }
  }

  logger.info({ jid: maskJid(jid) }, 'Pesan masuk');

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

  await sock.sendMessage(jid, { text: reply });
  logger.info({ jid: maskJid(jid) }, 'Balasan terkirim');
}

/**
 * Perintah admin untuk mengirim campaign secara PROAKTIF (push) ke daftar
 * nomor tujuan. Ini "wow moment" fitur andalan: bot menghampiri anggota,
 * bukan menunggu. Return pesan balasan untuk admin, atau null bila bukan perintah.
 */
async function handleAdminCommand(sock: WASocket, cmd: string): Promise<string | null> {
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
