/** Read-only introspection of the Supabase Postgres (via SUPABASE_DB_URL). */
import { SQL } from "bun";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL belum ada di .env");
  process.exit(1);
}

let sql: SQL;
try {
  sql = new SQL({ url, ssl: true, max: 2, idleTimeout: 20, connectionTimeout: 20 });
  const [who] = await sql`SELECT current_user AS usr, current_database() AS db, version() AS v`;
  console.log("✅ Connected:", who.usr, "/", who.db);
  console.log("   ", String(who.v).split(",")[0]);
} catch (e: any) {
  console.error("❌ Gagal konek Supabase:", e?.code ?? "", e?.message ?? e);
  process.exit(1);
}

const tables = await sql<{ table_name: string }[]>`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name`;
console.log(`\n=== public tables (${tables.length}) ===`);

for (const t of tables) {
  const cols = await sql<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]>`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${t.table_name}
    ORDER BY ordinal_position`;
  let n = "?";
  try {
    const [c] = await sql`SELECT count(*)::int AS n FROM ${sql(t.table_name)}`;
    n = String(c.n);
  } catch {}
  console.log(`\n# ${t.table_name}  (rows=${n})`);
  for (const c of cols) {
    const def = c.column_default ? ` default ${String(c.column_default).slice(0, 30)}` : "";
    console.log(`   - ${c.column_name}: ${c.data_type}${c.is_nullable === "NO" ? " NOT NULL" : ""}${def}`);
  }
}

// PKs
const pks = await sql<{ table_name: string; column_name: string }[]>`
  SELECT tc.table_name, kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
  ORDER BY tc.table_name`;
console.log("\n=== primary keys ===");
for (const p of pks) console.log(`   ${p.table_name}.${p.column_name}`);

await sql.end();
console.log("\n✅ done");
