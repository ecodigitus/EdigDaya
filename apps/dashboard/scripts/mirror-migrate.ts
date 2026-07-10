/**
 * Prepare the team-prefixed write tables in the Cloud SQL mirror.
 * Runs as SUPERUSER. Additive + grants only — NON-DESTRUCTIVE, safe to re-run.
 *  - Adds scoping columns to edig_dev_members / edig_dev_pre_orders.
 *  - Grants koperasi_app write ONLY on the edig_dev_* team tables (SELECT-only on the 27 hackathon tables).
 */
import { SQL } from "bun";
const su = new SQL({
  url: `postgres://${encodeURIComponent(process.env.DB_USERNAME!)}:${encodeURIComponent(process.env.DB_PASSWORD!)}@${process.env.DB_HOST}:${process.env.DB_PORT ?? "5432"}/${process.env.DB_DATABASE}`,
  ssl: true, max: 2, idleTimeout: 20, connectionTimeout: 20,
});
async function step(label: string, run: () => Promise<unknown>) {
  await run();
  console.log("  ✅", label);
}
console.log("Menyiapkan tabel tim di mirror", process.env.DB_DATABASE, "…");

await step("edig_dev_members.koperasi_ref", () => su`ALTER TABLE edig_dev_members ADD COLUMN IF NOT EXISTS koperasi_ref text`);
await step("edig_dev_members.anggota_ref", () => su`ALTER TABLE edig_dev_members ADD COLUMN IF NOT EXISTS anggota_ref text`);
await step("edig_dev_members.diaktifkan_pada", () => su`ALTER TABLE edig_dev_members ADD COLUMN IF NOT EXISTS diaktifkan_pada timestamptz`);
await step("idx edig_dev_members(koperasi_ref)", () => su`CREATE INDEX IF NOT EXISTS idx_edmembers_koperasi ON edig_dev_members(koperasi_ref)`);

await step("edig_dev_pre_orders.koperasi_ref", () => su`ALTER TABLE edig_dev_pre_orders ADD COLUMN IF NOT EXISTS koperasi_ref text`);
await step("edig_dev_pre_orders.anggota_ref", () => su`ALTER TABLE edig_dev_pre_orders ADD COLUMN IF NOT EXISTS anggota_ref text`);
await step("edig_dev_pre_orders.produk_sample_id", () => su`ALTER TABLE edig_dev_pre_orders ADD COLUMN IF NOT EXISTS produk_sample_id text`);
await step("idx edig_dev_pre_orders(koperasi_ref)", () => su`CREATE INDEX IF NOT EXISTS idx_edpreorders_koperasi ON edig_dev_pre_orders(koperasi_ref)`);

for (const t of ["edig_dev_members", "edig_dev_pre_orders", "edig_dev_pengumuman", "edig_dev_pengurus", "edig_dev_laporan_transparansi"]) {
  await step(`grant ${t}`, () => su`GRANT SELECT, INSERT, UPDATE, DELETE ON ${su(t)} TO koperasi_app`);
}
await step("grant sequences", () => su`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO koperasi_app`);

await su.end();
console.log("✅ Tabel tim siap untuk tulis via koperasi_app.");
