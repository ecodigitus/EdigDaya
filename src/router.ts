import { matchMenu } from './menu';
import { generateReply } from './ai';
import { getHistory, record } from './session';
import { getMember, isMember } from './members';
import { handleProspect } from './onboarding';
import { handleCampaignReply, matchTrigger } from './campaigns';
import { config, aiEnabled } from './config';
import { logger } from './logger';

/**
 * Otak hybrid: kenali anggota → tangani campaign yang menunggu → trigger campaign
 * → menu rule-based → fallback AI. Selalu mengembalikan string balasan.
 */
export async function route(jid: string, text: string): Promise<string> {
  // Prospek (belum anggota) -> alur onboarding/hook (welcome, simulasi untung, gabung)
  if (!isMember(jid)) return handleProspect(jid, text);

  const member = getMember(jid);

  // 0) Balasan untuk campaign yang sedang menunggu (voting / nudge)
  const campaignReply = handleCampaignReply(jid, text, member);
  if (campaignReply !== null) return campaignReply;

  // 1) Trigger campaign dari anggota (mis. "voting", "nudge")
  const triggered = matchTrigger(jid, text, member);
  if (triggered !== null) return triggered;

  // 2) Menu rule-based — sebagian dipersonalisasi per anggota
  const canned = matchMenu(text, member);
  if (canned) {
    record(jid, text, canned, config.limits.historyTurns);
    return canned;
  }

  // 3) Kalau AI tidak aktif, arahkan ke menu / pengurus
  if (!aiEnabled) {
    return 'Untuk pertanyaan lain, ketik *menu* untuk pilihan, atau *pengurus* untuk terhubung dengan pengurus koperasi. 🙏';
  }

  // 4) Fallback ke AI (Claude) — sudah tahu konteks koperasi + data anggota
  try {
    const reply = await generateReply(getHistory(jid), text, member);
    record(jid, text, reply, config.limits.historyTurns);
    return reply;
  } catch (err) {
    logger.error({ err }, 'Gagal menghasilkan balasan AI');
    return 'Maaf, sistem kami lagi ada gangguan 🙏. Coba lagi sebentar, atau ketik *pengurus* untuk bantuan langsung.';
  }
}
