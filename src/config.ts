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

// Penyedia AI aktif: 'groq' (default), 'anthropic' (Claude), atau 'gemini' (GCP).
// Ganti AI_PROVIDER + isi API key yang sesuai di .env.
const aiProviderRaw = process.env.AI_PROVIDER?.trim().toLowerCase();
const aiProvider: 'groq' | 'anthropic' | 'gemini' | 'vertex' =
  aiProviderRaw === 'anthropic'
    ? 'anthropic'
    : aiProviderRaw === 'gemini'
      ? 'gemini'
      : aiProviderRaw === 'vertex'
        ? 'vertex'
        : 'groq';

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
  gemini: {
    // LLM Google (GCP). Pakai API key "Generative Language API" — bill ke project
    // GCP (memakai credit). KOSONG = provider gemini nonaktif.
    apiKey: process.env.GEMINI_API_KEY?.trim() ?? '',
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash',
    maxTokens: num('GEMINI_MAX_TOKENS', 1024),
  },
  vertex: {
    // Vertex AI (Gemini via SERVICE ACCOUNT) — pakai billing GCP standar → credit
    // $300 kepakai (beda dari Gemini API/AI Studio yg prepaid). KOSONG = nonaktif.
    keyFile: process.env.VERTEX_SA_KEY_FILE?.trim() ?? '', // path ke JSON service account (RAHASIA, gitignored)
    project: process.env.VERTEX_PROJECT_ID?.trim() ?? '', // opsional; default dari JSON (project_id)
    location: process.env.VERTEX_LOCATION?.trim() || 'us-central1',
    model: process.env.VERTEX_MODEL?.trim() || 'gemini-2.0-flash',
    maxTokens: num('VERTEX_MAX_TOKENS', 1024),
  },
  supabase: {
    // (Legacy) DB Supabase — masih dipakai dashboard web (belum dimigrasi).
    url: process.env.SUPABASE_URL?.trim() ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '',
  },
  cloudsql: {
    // DB BOT di Google Cloud SQL (PostgreSQL). Menggantikan Supabase untuk bot.
    // KOSONG = bot pakai data dummy in-memory (fallback aman). Password tak di-trim.
    host: process.env.CLOUDSQL_HOST?.trim() ?? '',
    port: num('CLOUDSQL_PORT', 5432),
    database: process.env.CLOUDSQL_DB?.trim() ?? '',
    username: process.env.CLOUDSQL_USER?.trim() ?? '',
    password: process.env.CLOUDSQL_PASSWORD ?? '',
    // Prefix nama tabel tim (mis. "edig_dev_"). Kosong = tanpa prefix.
    // HARUS sama dengan nama tabel di DB (lihat cloudsql/schema.sql).
    tablePrefix: process.env.DB_TABLE_PREFIX?.trim() ?? '',
  },
  simkopdes: {
    // Endpoint API pendaftaran SIMKOPDES. KOSONG = pakai adapter dummy (in-memory).
    apiUrl: process.env.SIMKOPDES_API_URL?.trim() ?? '',
    apiKey: process.env.SIMKOPDES_API_KEY?.trim() ?? '',
  },
  gcp: {
    // API key Google Cloud Speech-to-Text (untuk transkrip voice note WA).
    // KOSONG = fitur voice note nonaktif (bot minta pesan teks). Aktifkan: enable
    // "Cloud Speech-to-Text API" di GCP + buat API key (batasi ke Speech API saja).
    sttApiKey: process.env.GCP_STT_API_KEY?.trim() ?? '',
    // Bahasa transkrip utama (BCP-47). Default Indonesia.
    sttLang: process.env.GCP_STT_LANG?.trim() || 'id-ID',
    // API key Cloud Vision (OCR KTP saat pendaftaran). KOSONG = fitur KTP nonaktif.
    visionApiKey: process.env.GCP_VISION_API_KEY?.trim() ?? '',
  },
  hackathonDb: {
    // DB global panitia hackathon — dipakai HANYA untuk SELECT (read-only).
    // KOSONG = menu "Koperasi Global" nonaktif (fallback aman). Password TIDAK
    // di-trim (dihormati apa adanya). Tak pernah di-hardcode (OWASP A05).
    host: process.env.DB_HOST?.trim() ?? '',
    port: num('DB_PORT', 5432),
    database: process.env.DB_DATABASE?.trim() ?? '',
    username: process.env.DB_USERNAME?.trim() ?? '',
    password: process.env.DB_PASSWORD ?? '',
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
    : config.ai.provider === 'gemini'
      ? config.gemini.apiKey.length > 0
      : config.ai.provider === 'vertex'
        ? config.vertex.keyFile.length > 0
        : config.groq.apiKey.length > 0;

/** Nama model provider yang sedang aktif (untuk logging/diagnostik). */
export const activeModel =
  config.ai.provider === 'anthropic'
    ? config.anthropic.model
    : config.ai.provider === 'gemini'
      ? config.gemini.model
      : config.ai.provider === 'vertex'
        ? config.vertex.model
        : config.groq.model;

/** Nama env var yang perlu diisi untuk provider aktif (untuk pesan bantuan). */
export const activeKeyEnv =
  config.ai.provider === 'anthropic'
    ? 'ANTHROPIC_API_KEY'
    : config.ai.provider === 'gemini'
      ? 'GEMINI_API_KEY'
      : config.ai.provider === 'vertex'
        ? 'VERTEX_SA_KEY_FILE'
        : 'GROQ_API_KEY';
