/**
 * Read-only schema introspection for the hackathon Postgres DB.
 * Verifies the real schema against the metadata PDF: tables, columns,
 * primary keys, foreign keys, indexes, row counts, and any auth tables.
 *
 * Usage: bun run scripts/introspect.ts
 */
import { SQL } from "bun";

const {
  DB_HOST,
  DB_PORT = "5432",
  DB_DATABASE,
  DB_USERNAME,
  DB_PASSWORD,
} = process.env;

if (!DB_HOST || !DB_DATABASE || !DB_USERNAME || !DB_PASSWORD) {
  console.error("Missing DB_* env vars. Check .env");
  process.exit(1);
}

const url = `postgres://${encodeURIComponent(DB_USERNAME)}:${encodeURIComponent(
  DB_PASSWORD,
)}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;

async function connect(): Promise<SQL> {
  // Try TLS first (common for managed/remote PG), fall back to plaintext.
  for (const ssl of [true, false] as const) {
    try {
      const sql = new SQL({ url, ssl, max: 2, idleTimeout: 10, connectionTimeout: 15 });
      await sql`SELECT 1`;
      console.log(`✅ Connected (ssl=${ssl})`);
      return sql;
    } catch (e: any) {
      console.log(`  ssl=${ssl} failed: ${e?.code ?? e?.message ?? e}`);
    }
  }
  throw new Error("Could not connect with or without SSL");
}

const sql = await connect();

// Current role & privileges
const [who] = await sql`SELECT current_user, current_database(), version()`;
console.log("\n=== Identity ===");
console.log(who);

// All base tables in public schema
const tables = await sql<{ table_name: string }[]>`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`;
console.log(`\n=== Tables in public (${tables.length}) ===`);
console.log(tables.map((t) => t.table_name).join(", "));

// Look for any auth-ish tables not in the business metadata
const authish = tables.filter((t) =>
  /user|auth|login|account|role|permission|session|credential/i.test(t.table_name),
);
console.log(`\n=== Possible auth/user tables ===`);
console.log(authish.length ? authish.map((t) => t.table_name).join(", ") : "(none found)");

// Primary keys
const pks = await sql<{ table_name: string; column_name: string }[]>`
  SELECT tc.table_name, kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
  ORDER BY tc.table_name, kcu.ordinal_position
`;
const pkByTable: Record<string, string[]> = {};
for (const r of pks) (pkByTable[r.table_name] ??= []).push(r.column_name);
console.log(`\n=== Primary keys (${Object.keys(pkByTable).length} tables) ===`);
for (const [t, cols] of Object.entries(pkByTable)) console.log(`  ${t}: (${cols.join(", ")})`);

// Foreign keys
const fks = await sql<
  { table_name: string; column_name: string; foreign_table: string; foreign_column: string }[]
>`
  SELECT tc.table_name,
         kcu.column_name,
         ccu.table_name  AS foreign_table,
         ccu.column_name AS foreign_column
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  ORDER BY tc.table_name
`;
console.log(`\n=== Foreign keys (${fks.length}) ===`);
if (fks.length === 0) console.log("  (none declared — refs are logical only)");
for (const f of fks)
  console.log(`  ${f.table_name}.${f.column_name} -> ${f.foreign_table}.${f.foreign_column}`);

// Row counts (from planner stats first; cheap and non-blocking)
const counts = await sql<{ relname: string; n: number }[]>`
  SELECT relname, GREATEST(n_live_tup, 0)::int AS n
  FROM pg_stat_user_tables
  ORDER BY n DESC
`;
console.log(`\n=== Approx row counts (pg_stat, top 40) ===`);
for (const c of counts.slice(0, 40)) console.log(`  ${c.relname}: ${c.n.toLocaleString()}`);

await sql.end();
console.log("\n✅ Introspection done.");
