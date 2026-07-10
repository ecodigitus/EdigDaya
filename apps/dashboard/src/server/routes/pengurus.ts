/**
 * Pengurus (cooperative back-office) read endpoints. Every query is scoped to
 * the koperasi in the signed session. Money sums are cast to float8 (values are
 * well within JS safe-integer range) so JSON serialization is clean.
 */
import { route } from "../router";
import { json, err } from "../http";
import { db } from "../db";
import { shared, team } from "../tables";
import { koperasiScope } from "../scope";
import { pagination, searchText, likePattern, oneOf, optionalOneOf } from "../validate";

const PENGURUS = ["pengurus"] as const;

// GET /api/pengurus/overview — KPI cards.
route(
  "GET",
  "/api/pengurus/overview",
  async ({ session }) => {
    const kop = koperasiScope(session);
    const [anggota] = await db`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE status_keanggotaan = 'Approved')::int AS approved,
        count(*) FILTER (WHERE status_keanggotaan = 'Requested')::int AS requested,
        count(*) FILTER (WHERE jenis_kelamin = 'LAKI-LAKI')::int AS laki,
        count(*) FILTER (WHERE jenis_kelamin = 'PEREMPUAN')::int AS perempuan
      FROM ${db(shared("anggota_koperasi"))} WHERE koperasi_ref = ${kop}`;
    const [simpanan] = await db`
      SELECT
        COALESCE(sum(jumlah_simpanan) FILTER (WHERE status = 'PAID'), 0)::float8 AS paid,
        COALESCE(sum(jumlah_simpanan) FILTER (WHERE status = 'UNPAID'), 0)::float8 AS unpaid,
        count(*) FILTER (WHERE status = 'PAID')::int AS n_paid,
        count(*) FILTER (WHERE status = 'UNPAID')::int AS n_unpaid
      FROM ${db(shared("simpanan_anggota"))} WHERE koperasi_ref = ${kop}`;
    const [produk] = await db`
      SELECT count(*)::int AS total FROM ${db(shared("produk_koperasi"))} WHERE koperasi_ref = ${kop}`;
    const [transaksi] = await db`
      SELECT count(*)::int AS total, COALESCE(sum(total_pembayaran), 0)::float8 AS nilai
      FROM ${db(shared("transaksi_penjualan"))} WHERE koperasi_ref = ${kop}`;
    const [gerai] = await db`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE status_gerai = 'Aktif')::int AS aktif
      FROM ${db(shared("gerai_koperasi"))} WHERE koperasi_ref = ${kop}`;
    return json({ anggota, simpanan, produk, transaksi, gerai });
  },
  PENGURUS,
);

// GET /api/pengurus/trends — monthly series for charts.
route(
  "GET",
  "/api/pengurus/trends",
  async ({ session }) => {
    const kop = koperasiScope(session);
    const simpanan = await db`
      SELECT to_char(date_trunc('month', dibayar_pada), 'YYYY-MM') AS bulan,
             COALESCE(sum(jumlah_simpanan), 0)::float8 AS total, count(*)::int AS n
      FROM ${db(shared("simpanan_anggota"))}
      WHERE koperasi_ref = ${kop} AND status = 'PAID' AND dibayar_pada IS NOT NULL
      GROUP BY 1 ORDER BY 1`;
    const transaksi = await db`
      SELECT to_char(date_trunc('month', tanggal_dibuat), 'YYYY-MM') AS bulan,
             COALESCE(sum(total_pembayaran), 0)::float8 AS total, count(*)::int AS n
      FROM ${db(shared("transaksi_penjualan"))}
      WHERE koperasi_ref = ${kop} AND tanggal_dibuat IS NOT NULL
      GROUP BY 1 ORDER BY 1`;
    return json({ simpanan, transaksi });
  },
  PENGURUS,
);

// GET /api/pengurus/anggota — member directory (filters: q, gender, status, sort).
route(
  "GET",
  "/api/pengurus/anggota",
  async ({ session, url }) => {
    const kop = koperasiScope(session);
    const q = searchText(url.searchParams.get("q"));
    const gender = optionalOneOf(url.searchParams.get("gender"), ["LAKI-LAKI", "PEREMPUAN"]);
    const status = optionalOneOf(url.searchParams.get("status"), ["Approved", "Requested"]);
    const sort = oneOf(url.searchParams.get("sort"), ["nama", "tanggal_terdaftar"], "nama");
    const { limit, offset, page } = pagination(url, 20, 100);
    const orderBy =
      sort === "tanggal_terdaftar" ? db`tanggal_terdaftar DESC NULLS LAST, nama ASC` : db`nama ASC`;
    const filters = () => db`
      WHERE koperasi_ref = ${kop}
        AND (${q}::text IS NULL OR nama ILIKE ${q ? likePattern(q) : null} OR nik ILIKE ${q ? likePattern(q) : null})
        AND (${gender}::text IS NULL OR jenis_kelamin = ${gender})
        AND (${status}::text IS NULL OR status_keanggotaan = ${status})`;
    const [count] = await db`
      SELECT count(*)::int AS total FROM ${db(shared("anggota_koperasi"))} ${filters()}`;
    const data = await db`
      SELECT anggota_ref, nama, nik, jenis_kelamin, status_keanggotaan, status_akun, pekerjaan,
             tanggal_terdaftar, kode_wilayah
      FROM ${db(shared("anggota_koperasi"))} ${filters()}
      ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
    return json({ data, page, limit, total: count.total });
  },
  PENGURUS,
);

// GET /api/pengurus/anggota/:ref — member detail + savings breakdown/history.
route(
  "GET",
  "/api/pengurus/anggota/:ref",
  async ({ session, params }) => {
    const kop = koperasiScope(session);
    const ref = params.ref;
    const [anggota] = await db`
      SELECT a.anggota_ref, a.nama, a.nik, a.jenis_kelamin, a.status_keanggotaan, a.status_akun,
             a.pekerjaan, a.tanggal_terdaftar, a.kode_wilayah,
             w.provinsi, w.kab_kota, w.kecamatan, w.desa_kelurahan
      FROM ${db(shared("anggota_koperasi"))} a
      LEFT JOIN ${db(shared("referensi_wilayah"))} w ON w.kode_wilayah = a.kode_wilayah
      WHERE a.anggota_ref = ${ref} AND a.koperasi_ref = ${kop} LIMIT 1`;
    if (!anggota) return err(404, "Anggota tidak ditemukan.");
    const byJenis = await db`
      SELECT split_part(periode_pembayaran, ' - ', 1) AS jenis,
        COALESCE(sum(jumlah_simpanan) FILTER (WHERE status = 'PAID'), 0)::float8 AS paid,
        COALESCE(sum(jumlah_simpanan) FILTER (WHERE status = 'UNPAID'), 0)::float8 AS unpaid
      FROM ${db(shared("simpanan_anggota"))}
      WHERE anggota_ref = ${ref} AND koperasi_ref = ${kop} GROUP BY 1 ORDER BY 1`;
    const riwayat = await db`
      SELECT periode_pembayaran, split_part(periode_pembayaran, ' - ', 1) AS jenis,
             jumlah_simpanan::float8 AS jumlah, status, dibayar_pada
      FROM ${db(shared("simpanan_anggota"))}
      WHERE anggota_ref = ${ref} AND koperasi_ref = ${kop}
      ORDER BY dibayar_pada DESC NULLS LAST LIMIT 50`;
    return json({ anggota, simpanan: { byJenis, riwayat } });
  },
  PENGURUS,
);

// GET /api/pengurus/anggota-digital — anggota berakun digital / daftar via WA bot (edig_dev_members).
// Baris hasil WA belum punya koperasi_ref (bot single-tenant) → sertakan juga yang NULL agar
// data uji WA ikut tampil. Aman untuk satu koperasi demo; tetap scoped ke koperasi sesi + NULL.
route(
  "GET",
  "/api/pengurus/anggota-digital",
  async ({ session, url }) => {
    const kop = koperasiScope(session);
    const q = searchText(url.searchParams.get("q"));
    const { limit, offset, page } = pagination(url, 20, 100);
    const filters = () => db`
      WHERE (koperasi_ref = ${kop} OR koperasi_ref IS NULL)
        AND (${q}::text IS NULL
             OR nama ILIKE ${q ? likePattern(q) : null}
             OR no_anggota ILIKE ${q ? likePattern(q) : null}
             OR phone ILIKE ${q ? likePattern(q) : null})`;
    const [count] = await db`
      SELECT count(*)::int AS total FROM ${db(team("members"))} ${filters()}`;
    const data = await db`
      SELECT no_anggota, nama, phone, role, kode_referral,
             coalesce(poin, 0)::int AS poin,
             coalesce(estimasi_shu, 0)::float8 AS estimasi_shu,
             (coalesce(simpanan_pokok, 0) + coalesce(simpanan_wajib, 0) + coalesce(simpanan_sukarela, 0))::float8 AS total_simpanan,
             diaktifkan_pada, updated_at
      FROM ${db(team("members"))} ${filters()}
      ORDER BY updated_at DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`;
    return json({ data, page, limit, total: count.total });
  },
  PENGURUS,
);

// GET /api/pengurus/simpanan/summary — savings by jenis.
route(
  "GET",
  "/api/pengurus/simpanan/summary",
  async ({ session }) => {
    const kop = koperasiScope(session);
    const byJenis = await db`
      SELECT split_part(periode_pembayaran, ' - ', 1) AS jenis,
        COALESCE(sum(jumlah_simpanan) FILTER (WHERE status = 'PAID'), 0)::float8 AS paid,
        COALESCE(sum(jumlah_simpanan) FILTER (WHERE status = 'UNPAID'), 0)::float8 AS unpaid,
        count(*) FILTER (WHERE status = 'PAID')::int AS n_paid,
        count(*) FILTER (WHERE status = 'UNPAID')::int AS n_unpaid
      FROM ${db(shared("simpanan_anggota"))} WHERE koperasi_ref = ${kop} GROUP BY 1 ORDER BY 1`;
    return json({ byJenis });
  },
  PENGURUS,
);

// GET /api/pengurus/simpanan — savings ledger (filters: status, jenis, q by member).
route(
  "GET",
  "/api/pengurus/simpanan",
  async ({ session, url }) => {
    const kop = koperasiScope(session);
    const status = optionalOneOf(url.searchParams.get("status"), ["PAID", "UNPAID"]);
    const jenis = optionalOneOf(url.searchParams.get("jenis"), [
      "Simpanan Pokok",
      "Simpanan Wajib",
      "Simpanan Sukarela",
    ]);
    const q = searchText(url.searchParams.get("q"));
    const { limit, offset, page } = pagination(url, 20, 100);
    const filters = () => db`
      WHERE s.koperasi_ref = ${kop}
        AND (${status}::text IS NULL OR s.status = ${status})
        AND (${jenis}::text IS NULL OR split_part(s.periode_pembayaran, ' - ', 1) = ${jenis})
        AND (${q}::text IS NULL OR a.nama ILIKE ${q ? likePattern(q) : null})`;
    const [count] = await db`
      SELECT count(*)::int AS total
      FROM ${db(shared("simpanan_anggota"))} s
      LEFT JOIN ${db(shared("anggota_koperasi"))} a ON a.anggota_ref = s.anggota_ref ${filters()}`;
    const data = await db`
      SELECT s.simpanan_ref, s.anggota_ref, a.nama AS anggota_nama, s.periode_pembayaran,
             split_part(s.periode_pembayaran, ' - ', 1) AS jenis,
             s.jumlah_simpanan::float8 AS jumlah, s.status, s.dibayar_pada
      FROM ${db(shared("simpanan_anggota"))} s
      LEFT JOIN ${db(shared("anggota_koperasi"))} a ON a.anggota_ref = s.anggota_ref ${filters()}
      ORDER BY s.dibayar_pada DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`;
    return json({ data, page, limit, total: count.total });
  },
  PENGURUS,
);

// GET /api/pengurus/produk — product catalog with stock + latest sell price.
route(
  "GET",
  "/api/pengurus/produk",
  async ({ session, url }) => {
    const kop = koperasiScope(session);
    const q = searchText(url.searchParams.get("q"));
    const { limit, offset, page } = pagination(url, 20, 100);
    const filters = () => db`
      WHERE pr.koperasi_ref = ${kop}
        AND (${q}::text IS NULL OR pr.nama_produk ILIKE ${q ? likePattern(q) : null} OR pr.kode_barcode ILIKE ${q ? likePattern(q) : null})`;
    const [count] = await db`
      SELECT count(*)::int AS total FROM ${db(shared("produk_koperasi"))} pr ${filters()}`;
    const data = await db`
      SELECT pr.produk_sample_id, pr.nama_produk, pr.unit, pr.kode_barcode,
             COALESCE(i.stok, 0)::float8 AS stok,
             (SELECT bm.harga_jual FROM ${db(shared("barang_masuk_produk"))} bm
                WHERE bm.produk_sample_id = pr.produk_sample_id
                ORDER BY bm.tanggal_masuk DESC NULLS LAST LIMIT 1)::float8 AS harga_jual
      FROM ${db(shared("produk_koperasi"))} pr
      LEFT JOIN ${db(shared("inventaris_produk"))} i ON i.produk_sample_id = pr.produk_sample_id ${filters()}
      ORDER BY pr.nama_produk ASC LIMIT ${limit} OFFSET ${offset}`;
    return json({ data, page, limit, total: count.total });
  },
  PENGURUS,
);

// GET /api/pengurus/transaksi — sales list with item counts.
route(
  "GET",
  "/api/pengurus/transaksi",
  async ({ session, url }) => {
    const kop = koperasiScope(session);
    const { limit, offset, page } = pagination(url, 20, 100);
    const [count] = await db`
      SELECT count(*)::int AS total FROM ${db(shared("transaksi_penjualan"))} WHERE koperasi_ref = ${kop}`;
    const data = await db`
      SELECT t.transaksi_sample_id, t.nama_pelanggan, t.tanggal_dibuat,
             t.total_pembayaran::float8 AS total_pembayaran, t.status_transaksi, t.metode_pembayaran,
             (SELECT count(*)::int FROM ${db(shared("barang_keluar_produk"))} bk
                WHERE bk.transaksi_sample_id = t.transaksi_sample_id) AS n_item
      FROM ${db(shared("transaksi_penjualan"))} t
      WHERE t.koperasi_ref = ${kop}
      ORDER BY t.tanggal_dibuat DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`;
    return json({ data, page, limit, total: count.total });
  },
  PENGURUS,
);

// GET /api/pengurus/gerai — outlets with type + facilities.
route(
  "GET",
  "/api/pengurus/gerai",
  async ({ session }) => {
    const kop = koperasiScope(session);
    const data = await db`
      SELECT g.gerai_ref, rg.nama_jenis_gerai, g.status_gerai, g.pengisi,
             g.akses_internet, g.akses_listrik, g.jenis_bangunan, g.sumber_air_bersih
      FROM ${db(shared("gerai_koperasi"))} g
      LEFT JOIN ${db(shared("referensi_gerai_koperasi"))} rg ON rg.jenis_gerai_ref = g.jenis_gerai_ref
      WHERE g.koperasi_ref = ${kop}
      ORDER BY g.status_gerai ASC, rg.nama_jenis_gerai ASC`;
    return json({ data });
  },
  PENGURUS,
);
