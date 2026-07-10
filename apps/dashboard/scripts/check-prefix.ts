/**
 * Verify whether per-team prefixed tables / schemas exist, or whether the
 * 27 business tables in `public` are shared & unprefixed (as first observed).
 * Read-only.  Usage: bun run scripts/check-prefix.ts
 */
import { SQL } from "bun";

const url = `postgres://${encodeURIComponent(process.env.DB_USERNAME!)}:${encodeURIComponent(
  process.env.DB_PASSWORD!,
)}@${process.env.DB_HOST}:${process.env.DB_PORT ?? "5432"}/${process.env.DB_DATABASE}`;
const sql = new SQL({ url, ssl: true, max: 2, idleTimeout: 15 });

const [sp] = await sql`SHOW search_path`;
console.log("search_path:", sp.search_path);

const schemas = await sql<{ schema_name: string }[]>`
  SELECT schema_name FROM information_schema.schemata
  WHERE schema_name NOT LIKE 'pg\\_%' AND schema_name <> 'information_schema'
  ORDER BY 1`;
console.log("\nNon-system schemas:", schemas.map((s) => s.schema_name).join(", "));

const all = await sql<{ table_schema: string; table_name: string; table_type: string }[]>`
  SELECT table_schema, table_name, table_type
  FROM information_schema.tables
  WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  ORDER BY table_schema, table_name`;
console.log(`\nAll visible tables/views (${all.length}):`);
const bySchema: Record<string, string[]> = {};
for (const t of all) (bySchema[t.table_schema] ??= []).push(`${t.table_name}${t.table_type === "VIEW" ? " (view)" : ""}`);
for (const [s, ts] of Object.entries(bySchema)) console.log(`  [${s}] ${ts.join(", ")}`);

// Any table name that looks like it embeds a team prefix before a known business table?
const prefixed = all.filter((t) => /_(anggota|profil|simpanan|transaksi|produk)_koperasi$/.test(t.table_name) && t.table_name !== `${t.table_name.replace(/^.*?_/, "")}`);
console.log(`\nTables ending in a known business suffix (possible prefixes):`);
const suffixes = ["anggota_koperasi", "profil_koperasi", "simpanan_anggota", "transaksi_penjualan"];
for (const suf of suffixes) {
  const hits = all.filter((t) => t.table_name.endsWith(suf)).map((t) => `${t.table_schema}.${t.table_name}`);
  console.log(`  *${suf}: ${hits.join(", ")}`);
}

// Grants across all schemas
const grants = await sql<{ table_schema: string; privilege_type: string; n: bigint }[]>`
  SELECT table_schema, privilege_type, COUNT(*)::int AS n
  FROM information_schema.role_table_grants
  WHERE grantee = current_user
  GROUP BY table_schema, privilege_type ORDER BY 1,2`;
console.log("\nGrants for current_user by schema:");
for (const g of grants) console.log(`  ${g.table_schema}: ${g.privilege_type} (${g.n})`);

await sql.end();
console.log("\n✅ Prefix check done.");
