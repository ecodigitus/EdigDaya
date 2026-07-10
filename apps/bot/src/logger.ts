import pino from 'pino';
import { config } from './config';

/** Logger utama aplikasi. */
export const logger = pino({ level: config.logLevel });

/** Logger khusus Baileys (lebih pelit biar console bersih). */
export const waLogger = pino({ level: process.env.BAILEYS_LOG_LEVEL?.trim() || 'warn' });

/**
 * Samarkan nomor WhatsApp di log untuk melindungi PII (OWASP A09 - logging aman).
 * Contoh: "6281234567890@s.whatsapp.net" -> "62812****@s.whatsapp.net"
 */
export function maskJid(jid: string): string {
  const [num, domain = ''] = jid.split('@');
  if (!num || num.length <= 5) return `***@${domain}`;
  return `${num.slice(0, 5)}****@${domain}`;
}
