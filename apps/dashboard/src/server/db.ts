/**
 * Single Bun.SQL connection pool for the app runtime.
 *
 * Uses the least-privilege team app account when configured (Fase B),
 * otherwise the read-only participant account. TLS is required by Cloud SQL.
 *
 * All queries MUST use tagged-template interpolation (parameterized) — never
 * build SQL by string concatenation. Table/column identifiers come from the
 * whitelists in `tables.ts`, never from user input.
 */
import { SQL } from "bun";
import { config } from "./config";

function makeUrl(username: string, password: string): string {
  const { host, port, database } = config.db;
  return `postgres://${encodeURIComponent(username)}:${encodeURIComponent(
    password,
  )}@${host}:${port}/${database}`;
}

const useAppAccount = config.appDb.username !== "" && config.appDb.password !== "";
const username = useAppAccount ? config.appDb.username : config.db.username;
const password = useAppAccount ? config.appDb.password : config.db.password;

/** Which DB identity the runtime is using — surfaced by /api/health. */
export const dbRole: "app" | "readonly" = useAppAccount ? "app" : "readonly";

export const db = new SQL({
  url: makeUrl(username, password),
  ssl: true,
  max: 10,
  idleTimeout: 30,
  connectionTimeout: 20,
});

export async function healthcheck() {
  const [row] = await db<{ user: string; database: string }[]>`
    SELECT current_user AS "user", current_database() AS "database"
  `;
  return { ...row, role: dbRole };
}
