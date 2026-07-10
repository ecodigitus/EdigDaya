/** Pick demo koperasi/anggota + validate joins. Read-only. */
import { SQL } from "bun";
const url = `postgres://${encodeURIComponent(process.env.DB_USERNAME!)}:${encodeURIComponent(
  process.env.DB_PASSWORD!,
)}@${process.env.DB_HOST}:${process.env.DB_PORT ?? "5432"}/${process.env.DB_DATABASE}`;
const sql = new SQL({ url, ssl: true, max: 3, idleTimeout: 40, connectionTimeout: 25 });

console.log("=== Koperasi terkaya data (GROUP BY, top 8) ===");
const rich = await sql`
  WITH a AS (SELECT koperasi_ref, count(*) n FROM anggota_koperasi GROUP BY 1),
       s AS (SELECT koperasi_ref, count(*) n FROM simpanan_anggota GROUP BY 1),
       pr AS (SELECT koperasi_ref, count(*) n FROM produk_koperasi GROUP BY 1),
       t AS (SELECT koperasi_ref, count(*) n FROM transaksi_penjualan GROUP BY 1),
       g AS (SELECT koperasi_ref, count(*) n FROM gerai_koperasi GROUP BY 1)
  SELECT p.koperasi_ref, p.nama_koperasi,
    COALESCE(a.n,0)::int anggota, COALESCE(s.n,0)::int simpanan, COALESCE(pr.n,0)::int produk,
    COALESCE(t.n,0)::int transaksi, COALESCE(g.n,0)::int gerai
  FROM profil_koperasi p
  LEFT JOIN a ON a.koperasi_ref=p.koperasi_ref
  LEFT JOIN s ON s.koperasi_ref=p.koperasi_ref
  LEFT JOIN pr ON pr.koperasi_ref=p.koperasi_ref
  LEFT JOIN t ON t.koperasi_ref=p.koperasi_ref
  LEFT JOIN g ON g.koperasi_ref=p.koperasi_ref
  ORDER BY transaksi DESC, produk DESC, simpanan DESC LIMIT 8`;
for (const r of rich)
  console.log(`  ${r.koperasi_ref} | ${r.nama_koperasi} | anggota=${r.anggota} simpanan=${r.simpanan} produk=${r.produk} trx=${r.transaksi} gerai=${r.gerai}`);

console.log("\n=== Jenis simpanan ===");
for (const r of await sql`
  SELECT split_part(periode_pembayaran, ' - ', 1) AS jenis, count(*)::int AS n,
         sum(jumlah_simpanan) FILTER (WHERE status='PAID')::bigint AS paid
  FROM simpanan_anggota GROUP BY 1 ORDER BY 2 DESC`)
  console.log(`  ${r.jenis}: n=${r.n} paid=${r.paid}`);

console.log("\n=== Match pengajuan_pembiayaan via NIK+koperasi ===");
const [pm] = await sql`
  SELECT count(*)::int total,
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM anggota_koperasi a WHERE a.nik=pp.nik AND a.koperasi_ref=pp.koperasi_ref))::int matched
  FROM pengajuan_pembiayaan pp`;
console.log(`  total=${pm.total} matched_by_nik=${pm.matched}`);

const topKop = rich[0].koperasi_ref;
console.log(`\n=== Sample anggota kaya simpanan (koperasi ${topKop}) ===`);
for (const r of await sql`
  SELECT a.anggota_ref, a.nama, a.nik,
    (SELECT count(*)::int FROM simpanan_anggota s WHERE s.anggota_ref=a.anggota_ref) AS n_simpanan
  FROM anggota_koperasi a WHERE a.koperasi_ref=${topKop}
  ORDER BY n_simpanan DESC LIMIT 5`)
  console.log(`  ${r.anggota_ref} | ${r.nama} | nik=${r.nik} | simpanan=${r.n_simpanan}`);

console.log(`\n=== Produk + stok + harga (koperasi ${topKop}) ===`);
for (const r of await sql`
  SELECT pr.nama_produk, pr.unit, i.stok,
    (SELECT bm.harga_jual FROM barang_masuk_produk bm WHERE bm.produk_sample_id=pr.produk_sample_id ORDER BY bm.tanggal_masuk DESC NULLS LAST LIMIT 1) AS harga_jual
  FROM produk_koperasi pr LEFT JOIN inventaris_produk i ON i.produk_sample_id=pr.produk_sample_id
  WHERE pr.koperasi_ref=${topKop} LIMIT 6`)
  console.log(`  ${r.nama_produk} | unit=${r.unit} | stok=${r.stok} | jual=${r.harga_jual}`);

await sql.end();
console.log("\n✅ done");
