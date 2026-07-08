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

// Penyedia AI aktif: 'groq' (default) atau 'anthropic'. Keduanya didukung;
// tinggal ganti AI_PROVIDER + isi API key yang sesuai di .env.
const aiProvider: 'groq' | 'anthropic' =
  process.env.AI_PROVIDER?.trim().toLowerCase() === 'anthropic' ? 'anthropic' : 'groq';

export const config = {
  ai: {
    provider: aiProvider,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY?.trim() ?? '',
    // Model di Groq (lihat https://console.groq.com/docs/models). Default: Llama 3.3 70B.
    model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
    maxTokens: num('GROQ_MAX_TOKENS', 1024),
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY?.trim() ?? '',
    model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-opus-4-8',
    maxTokens: num('ANTHROPIC_MAX_TOKENS', 1024),
  },
  simkopdes: {
    // Endpoint API pendaftaran SIMKOPDES. KOSONG = pakai adapter dummy (in-memory).
    apiUrl: process.env.SIMKOPDES_API_URL?.trim() ?? '',
    apiKey: process.env.SIMKOPDES_API_KEY?.trim() ?? '',
  },
  wa: {
    authDir: process.env.WA_AUTH_DIR?.trim() || 'auth',
    handleGroups: (process.env.WA_HANDLE_GROUPS ?? 'false').toLowerCase() === 'true',
    // Logo yang ditampilkan di welcome card (perintah "mulai"). Path relatif ke root project.
    logoPath: process.env.WA_LOGO_PATH?.trim() || 'assets/logo-kdmp.jpg',
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

/** AI aktif hanya kalau API key provider aktif tersedia; kalau tidak, bot jalan rule-based. */
export const aiEnabled =
  config.ai.provider === 'anthropic'
    ? config.anthropic.apiKey.length > 0
    : config.groq.apiKey.length > 0;

/** Nama model provider yang sedang aktif (untuk logging/diagnostik). */
export const activeModel =
  config.ai.provider === 'anthropic' ? config.anthropic.model : config.groq.model;

/** Nama env var API key yang perlu diisi untuk provider aktif (untuk pesan bantuan). */
export const activeKeyEnv = config.ai.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GROQ_API_KEY';
