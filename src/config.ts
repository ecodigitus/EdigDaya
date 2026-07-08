import 'dotenv/config';

/**
 * Konfigurasi terpusat. Semua nilai sensitif & bisa berubah diambil dari
 * environment variable (.env) — tidak ada secret yang di-hardcode (OWASP A05).
 */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Parse env berisi daftar dipisah koma (mis. nomor: "628xxx,628yyy"). */
function list(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY?.trim() ?? '',
    model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-opus-4-8',
    maxTokens: num('ANTHROPIC_MAX_TOKENS', 1024),
  },
  wa: {
    authDir: process.env.WA_AUTH_DIR?.trim() || 'auth',
    handleGroups: (process.env.WA_HANDLE_GROUPS ?? 'false').toLowerCase() === 'true',
  },
  admin: {
    // Nomor yang boleh memicu broadcast proaktif (format 62..., pisah koma).
    numbers: list('ADMIN_NUMBERS'),
    // Nomor tujuan broadcast demo (nomor asli yang kamu kontrol untuk uji "push").
    broadcastTargets: list('BROADCAST_TARGETS'),
  },
  limits: {
    maxInboundChars: num('MAX_INBOUND_CHARS', 2000),
    rateMaxPerMin: num('RATE_MAX_PER_MIN', 15),
    historyTurns: num('HISTORY_TURNS', 6),
    sessionTtlMinutes: num('SESSION_TTL_MINUTES', 60),
  },
  logLevel: process.env.LOG_LEVEL?.trim() || 'info',
} as const;

/** AI aktif hanya kalau API key tersedia; kalau tidak, bot jalan rule-based. */
export const aiEnabled = config.anthropic.apiKey.length > 0;
