/**
 * Read-only data profiling: indexes, privileges, enum/status distributions,
 * date ranges, and geographic breakdown. Informs dashboard + query design.
 *
 * Usage: bun run scripts/profile.ts
 */
import { SQL } from "bun";

const url = `postgres://${encodeURIComponent(process.env.DB_USERNAME!)}:${encodeURIComponent(
  process.env.DB_PASSWORD!,
)}@${process.env.DB_HOST}:${process.env.DB_PORT ?? "5432"}/${process.env.DB_DATABASE}`;
const sql = new SQL({ url, ssl: true, max: 3, idleTimeout: 20 });

function hr(t: string) {
  console.log(`\n=== ${t} ===`);
}

// 1. Indexes
hr("Indexes");
const idx = await sql<{ tablename: string; indexname: string; indexdef: string }[]>`
  SELECT tablename, indexname, indexdef
  FROM pg_indexes WHERE schemaname = 'public'
  ORDER BY tablename, indexname
`;
if (!idx.length) console.log("  (NO indexes at all — every filter/join is a seq scan)");
for (const i of idx) console.log(`  ${i.tablename}.${i.indexname}: ${i.indexdef.replace(/^CREATE.*USING /, "")}`);

// 2. Privileges for current user
hr("Table privileges (current_user)");
const privs = await sql<{ table_name: string; privilege_type: string }[]>`
  SELECT table_name, privilege_type
  FROM information_schema.role_table_grants
  WHERE grantee = current_user AND table_schema = 'public'
  ORDER BY table_name, privilege_type
`;
const privByTable: Record<string, string[]> = {};
for (const p of privs) (privByTable[p.table_name] ??= []).push(p.privilege_type);
const uniquePrivSets = new Set(Object.values(privByTable).map((v) => v.sort().join(",")));
console.log(`  Distinct privilege sets: ${[...uniquePrivSets].join(" | ") || "(none)"}`);
console.log(`  Tables granted: ${Object.keys(privByTable).length}`);

// Can we create objects (own schema)?
try {
  const [c] = await sql`SELECT has_database_privilege(current_user, current_database(), 'CREATE') AS can_create`;
  console.log(`  CREATE on database: ${c.can_create}`);
} catch (e: any) {
  console.log(`  CREATE check failed: ${e?.message}`);
}

// 3. Helper: distribution of a column
async function dist(table: string, col: string, limit = 12) {
  try {
    const rows = await sql`
      SELECT ${sql(col)} AS v, COUNT(*)::int AS n
      FROM ${sql(table)}
      GROUP BY ${sql(col)} ORDER BY n DESC LIMIT ${limit}
    `;
    console.log(`  ${table}.${col}:`);
    for (const r of rows) console.log(`    ${JSON.stringify(r.v)} → ${r.n.toLocaleString()}`);
  } catch (e: any) {
    console.log(`  ${table}.${col}: ERROR ${e?.message}`);
  }
}

hr("Status / enum distributions");
await dist("profil_koperasi", "status_registrasi");
await dist("profil_koperasi", "bentuk_koperasi");
await dist("profil_koperasi", "kategori_usaha");
await dist("anggota_koperasi", "jenis_kelamin");
await dist("anggota_koperasi", "status_keanggotaan");
await dist("anggota_koperasi", "status_akun");
await dist("transaksi_penjualan", "status_transaksi");
await dist("transaksi_penjualan", "metode_pembayaran");
await dist("simpanan_anggota", "status");
await dist("simpanan_anggota", "periode_pembayaran");
await dist("gerai_koperasi", "status_gerai");
await dist("pengajuan_pembiayaan", "status_permohonan");
await dist("pengajuan_kemitraan", "status_permohonan");
await dist("rat_koperasi", "status_rat");

// 4. Date ranges (for time series)
hr("Date ranges");
async function range(table: string, col: string) {
  try {
    const [r] = await sql`SELECT MIN(${sql(col)}) AS lo, MAX(${sql(col)}) AS hi, COUNT(${sql(col)})::int AS n FROM ${sql(table)}`;
    console.log(`  ${table}.${col}: ${r.lo} .. ${r.hi} (${r.n.toLocaleString()} non-null)`);
  } catch (e: any) {
    console.log(`  ${table}.${col}: ERROR ${e?.message}`);
  }
}
await range("transaksi_penjualan", "tanggal_dibuat");
await range("simpanan_anggota", "dibayar_pada");
await range("anggota_koperasi", "tanggal_terdaftar");
await range("barang_masuk_produk", "tanggal_masuk");

// 5. Geographic breakdown
hr("Geography");
const [prov] = await sql`SELECT COUNT(DISTINCT provinsi)::int AS provinsi, COUNT(DISTINCT kab_kota)::int AS kab, COUNT(DISTINCT kecamatan)::int AS kec, COUNT(*)::int AS desa FROM referensi_wilayah`;
console.log(`  referensi_wilayah: ${prov.provinsi} provinsi, ${prov.kab} kab/kota, ${prov.kec} kecamatan, ${prov.desa} desa`);
const topProv = await sql`
  SELECT w.provinsi, COUNT(DISTINCT kw.koperasi_ref)::int AS koperasi
  FROM referensi_koperasi_wilayah kw
  JOIN referensi_wilayah w ON w.kode_wilayah = kw.kode_wilayah
  GROUP BY w.provinsi ORDER BY koperasi DESC LIMIT 15
`;
console.log("  Koperasi per provinsi (top 15):");
for (const p of topProv) console.log(`    ${p.provinsi}: ${p.koperasi.toLocaleString()}`);

// 6. Tenant key sanity — is koperasi_ref in profil unique & matching?
hr("Tenant key sanity");
const [t1] = await sql`SELECT COUNT(*)::int AS total, COUNT(DISTINCT koperasi_ref)::int AS distinct_ref FROM profil_koperasi`;
console.log(`  profil_koperasi: ${t1.total} rows, ${t1.distinct_ref} distinct koperasi_ref`);
const orphan = await sql`
  SELECT COUNT(*)::int AS n FROM anggota_koperasi a
  WHERE NOT EXISTS (SELECT 1 FROM profil_koperasi p WHERE p.koperasi_ref = a.koperasi_ref)
`;
console.log(`  anggota with no matching profil: ${orphan[0].n.toLocaleString()}`);

await sql.end();
console.log("\n✅ Profiling done.");
