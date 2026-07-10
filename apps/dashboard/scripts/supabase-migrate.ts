/**
 * Minimal additive migration on the team's own Supabase. NON-DESTRUCTIVE.
 * Reuses existing tables — `members` (= digital account + referral code) and
 * `pre_orders` — and only adds scoping columns so data can be filtered per
 * koperasi/anggota. No new tables, no drops. Safe to re-run.
 *
 * Marker for "onboarded digital via our platform" = members.koperasi_ref IS NOT NULL
 * (the pre-existing member rows have it null).
 *
 * Usage: bun run scripts/supabase-migrate.ts
 */
import { SQL } from "bun";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL belum ada di .env");
  process.exit(1);
}
const sql = new SQL({ url, ssl: true, max: 2, idleTimeout: 20, connectionTimeout: 20 });

async function step(label: string, run: () => Promise<unknown>) {
  await run();
  console.log("  ✅", label);
}

console.log("Migrasi aditif Supabase (reuse members + pre_orders)…");

// members = akun digital + referral. Tambah scoping koperasi + jejak aktivasi.
await step("members.koperasi_ref", () => sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS koperasi_ref text`);
await step("members.anggota_ref", () => sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS anggota_ref text`);
await step("members.diaktifkan_pada", () => sql`ALTER TABLE members ADD COLUMN IF NOT EXISTS diaktifkan_pada timestamptz`);
await step("idx members(koperasi_ref)", () => sql`CREATE INDEX IF NOT EXISTS idx_members_koperasi ON members(koperasi_ref)`);

// pre_orders = pre-order. Tambah scoping per koperasi/anggota.
await step("pre_orders.koperasi_ref", () => sql`ALTER TABLE pre_orders ADD COLUMN IF NOT EXISTS koperasi_ref text`);
await step("pre_orders.anggota_ref", () => sql`ALTER TABLE pre_orders ADD COLUMN IF NOT EXISTS anggota_ref text`);
await step("pre_orders.produk_sample_id", () => sql`ALTER TABLE pre_orders ADD COLUMN IF NOT EXISTS produk_sample_id text`);
await step("idx pre_orders(koperasi_ref)", () => sql`CREATE INDEX IF NOT EXISTS idx_preorders_koperasi ON pre_orders(koperasi_ref)`);

await sql.end();
console.log("✅ Migrasi selesai (aditif, tidak menyentuh data lama).");
