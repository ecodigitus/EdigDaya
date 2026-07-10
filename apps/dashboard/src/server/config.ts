/**
 * Centralized, validated runtime configuration.
 * Import `config` from here — never read `process.env` elsewhere.
 * Bun loads `.env` automatically.
 */

function required(name: string): string {
  const v = process.env[name];
  if (v == null || v.trim() === "") {
    throw new Error(`[config] Missing required env var: ${name} (check .env)`);
  }
  return v;
}

function optional(name: string, fallback = ""): string {
  const v = process.env[name];
  return v == null || v.trim() === "" ? fallback : v;
}

/** Turn a raw team name into a safe SQL identifier prefix ("Tim A!" -> "tim_a_"). */
function toPrefix(raw: string): string {
  const clean = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return clean ? `${clean}_` : "";
}

const nodeEnv = optional("NODE_ENV", "development");
const teamName = optional("TEAM_NAME");

const adminUser = optional("ADMIN_DB_USERNAME");
const adminPass = optional("ADMIN_DB_PASSWORD");

export const config = {
  nodeEnv,
  isProd: nodeEnv === "production",
  port: Number(optional("PORT", "3000")),

  /** Read-only participant account for the shared hackathon dataset. */
  db: {
    host: required("DB_HOST"),
    port: Number(optional("DB_PORT", "5432")),
    database: required("DB_DATABASE"),
    username: required("DB_USERNAME"),
    password: required("DB_PASSWORD"),
  },

  /** Least-privilege app account (created in Fase B); runtime falls back to read-only. */
  appDb: {
    username: optional("APP_DB_USERNAME"),
    password: optional("APP_DB_PASSWORD"),
  },

  /** Privileged account — used ONLY by scripts/migrate.ts, never at runtime. */
  adminDb: {
    username: adminUser,
    password: adminPass,
    available: adminUser !== "" && adminPass !== "",
  },

  teamName,
  tablePrefix: toPrefix(teamName),

  /** HMAC secret for signing session tokens. */
  sessionSecret: optional("SESSION_SECRET"),

  /** Team-owned Supabase Postgres (writable) — referral / pre-order / digital onboarding. */
  supabaseDbUrl: optional("SUPABASE_DB_URL"),
};

export type Config = typeof config;
