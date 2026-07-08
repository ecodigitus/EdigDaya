/**
 * Penyimpanan sesi per-user (in-memory).
 * - Riwayat percakapan (untuk konteks AI)
 * - Rate limiting sliding-window (anti-spam & hemat biaya AI)
 *
 * CATATAN PRODUKSI: ini in-memory, hilang saat restart & tidak share antar
 * instance. Untuk produksi, ganti ke Redis / database.
 */
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

type Session = {
  history: ChatMessage[];
  hits: number[]; // timestamp (ms) pesan masuk, untuk rate limit
  lastSeen: number;
};

const sessions = new Map<string, Session>();

function get(jid: string): Session {
  let s = sessions.get(jid);
  if (!s) {
    s = { history: [], hits: [], lastSeen: Date.now() };
    sessions.set(jid, s);
  }
  return s;
}

/** Ambil riwayat percakapan user (untuk dikirim sebagai konteks ke AI). */
export function getHistory(jid: string): ChatMessage[] {
  return get(jid).history;
}

/** Catat 1 giliran percakapan (pesan user + balasan bot), lalu pangkas. */
export function record(jid: string, user: string, assistant: string, maxTurns: number): void {
  const s = get(jid);
  s.history.push({ role: 'user', content: user }, { role: 'assistant', content: assistant });
  const max = Math.max(1, maxTurns) * 2;
  if (s.history.length > max) s.history = s.history.slice(-max);
  s.lastSeen = Date.now();
}

/** Rate limit: true jika masih diizinkan, false jika sudah melewati batas/menit. */
export function allowed(jid: string, maxPerMin: number): boolean {
  const s = get(jid);
  const now = Date.now();
  s.hits = s.hits.filter((t) => now - t < 60_000);
  s.lastSeen = now;
  if (s.hits.length >= maxPerMin) return false;
  s.hits.push(now);
  return true;
}

/** Buang sesi yang sudah tidak aktif melebihi TTL (mencegah memory bocor). */
export function cleanup(ttlMinutes: number): void {
  const now = Date.now();
  const ttl = ttlMinutes * 60_000;
  for (const [jid, s] of sessions) {
    if (now - s.lastSeen > ttl) sessions.delete(jid);
  }
}
