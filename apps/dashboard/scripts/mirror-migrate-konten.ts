/** Additive: scope columns for content tables + inspect transparansi status constraint. */
import { SQL } from "bun";
const su = new SQL({
  url: `postgres://${encodeURIComponent(process.env.DB_USERNAME!)}:${encodeURIComponent(process.env.DB_PASSWORD!)}@${process.env.DB_HOST}:${process.env.DB_PORT ?? "5432"}/${process.env.DB_DATABASE}`,
  ssl: true, max: 2, idleTimeout: 20,
});
async function step(l: string, r: () => Promise<unknown>) { await r(); console.log("  ✅", l); }

await step("pengumuman.koperasi_ref", () => su`ALTER TABLE edig_dev_pengumuman ADD COLUMN IF NOT EXISTS koperasi_ref text`);
await step("transparansi.koperasi_ref", () => su`ALTER TABLE edig_dev_laporan_transparansi ADD COLUMN IF NOT EXISTS koperasi_ref text`);
await step("transparansi.anggota_ref", () => su`ALTER TABLE edig_dev_laporan_transparansi ADD COLUMN IF NOT EXISTS anggota_ref text`);
await step("idx pengumuman(koperasi_ref)", () => su`CREATE INDEX IF NOT EXISTS idx_edpengumuman_kop ON edig_dev_pengumuman(koperasi_ref)`);
await step("idx transparansi(koperasi_ref)", () => su`CREATE INDEX IF NOT EXISTS idx_edtransp_kop ON edig_dev_laporan_transparansi(koperasi_ref)`);

const chk = await su<{ def: string }[]>`
  SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
  WHERE conrelid='edig_dev_laporan_transparansi'::regclass AND contype='c'`;
console.log("transparansi status CHECK:", chk.map((c) => c.def).join(" | ") || "(none)");
const cats = await su<{ kategori: string }[]>`SELECT DISTINCT kategori FROM edig_dev_laporan_transparansi`;
console.log("kategori existing:", cats.map((c) => c.kategori).join(", ") || "(none)");
await su.end();
console.log("✅ done");
