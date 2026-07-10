/** Verify mirror members/pre_orders schema matches what the app code expects. */
import { SQL } from "bun";
const su = new SQL({
  url: `postgres://${encodeURIComponent(process.env.DB_USERNAME!)}:${encodeURIComponent(process.env.DB_PASSWORD!)}@${process.env.DB_HOST}:${process.env.DB_PORT ?? "5432"}/${process.env.DB_DATABASE}`,
  ssl: true, max: 2, idleTimeout: 15,
});
for (const t of ["members", "pre_orders"]) {
  const cols = await su<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${t} ORDER BY ordinal_position`;
  console.log(`\n${t} cols:`, cols.map((c) => c.column_name).join(", "));
}
const chk = await su<{ def: string }[]>`
  SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
  WHERE conrelid='pre_orders'::regclass AND contype='c'`;
console.log("\npre_orders CHECK:", chk.map((c) => c.def).join(" | ") || "(none)");
const [m] = await su`SELECT count(*)::int total, count(*) FILTER (WHERE koperasi_ref IS NOT NULL)::int platform FROM members`;
console.log("members rows:", JSON.stringify(m));
const seqs = await su<{ sequence_name: string }[]>`SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'`;
console.log("sequences:", seqs.map((s) => s.sequence_name).join(", ") || "(none)");
await su.end();
