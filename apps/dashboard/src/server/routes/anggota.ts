/**
 * Anggota (member self-service) read endpoints. Scoped to the member in the
 * signed session — a member can only ever see their own data.
 */
import { route } from "../router";
import { json, err } from "../http";
import { db } from "../db";
import { shared } from "../tables";
import { anggotaScope } from "../scope";
import { pagination, searchText, likePattern, optionalOneOf } from "../validate";

const ANGGOTA = ["anggota"] as const;

// GET /api/anggota/overview — home: profile + savings summary + recent history.
route(
  "GET",
  "/api/anggota/overview",
  async ({ session }) => {
    const { koperasi_ref, anggota_ref } = anggotaScope(session);
    const [profil] = await db`
      SELECT a.anggota_ref, a.nama, a.nik, a.status_keanggotaan, a.status_akun, a.pekerjaan,
             a.tanggal_terdaftar, k.nama_koperasi
      FROM ${db(shared("anggota_koperasi"))} a
      LEFT JOIN ${db(shared("profil_koperasi"))} k ON k.koperasi_ref = a.koperasi_ref
      WHERE a.anggota_ref = ${anggota_ref} AND a.koperasi_ref = ${koperasi_ref} LIMIT 1`;
    if (!profil) return err(404, "Anggota tidak ditemukan.");
    const [saldo] = await db`
      SELECT COALESCE(sum(jumlah_simpanan) FILTER (WHERE status = 'PAID'), 0)::float8 AS paid,
             COALESCE(sum(jumlah_simpanan) FILTER (WHERE status = 'UNPAID'), 0)::float8 AS unpaid,
             count(*) FILTER (WHERE status = 'UNPAID')::int AS n_unpaid
      FROM ${db(shared("simpanan_anggota"))}
      WHERE anggota_ref = ${anggota_ref} AND koperasi_ref = ${koperasi_ref}`;
    const byJenis = await db`
      SELECT split_part(periode_pembayaran, ' - ', 1) AS jenis,
             COALESCE(sum(jumlah_simpanan) FILTER (WHERE status = 'PAID'), 0)::float8 AS paid
      FROM ${db(shared("simpanan_anggota"))}
      WHERE anggota_ref = ${anggota_ref} AND koperasi_ref = ${koperasi_ref} GROUP BY 1 ORDER BY 1`;
    const riwayat = await db`
      SELECT periode_pembayaran, split_part(periode_pembayaran, ' - ', 1) AS jenis,
             jumlah_simpanan::float8 AS jumlah, status, dibayar_pada
      FROM ${db(shared("simpanan_anggota"))}
      WHERE anggota_ref = ${anggota_ref} AND koperasi_ref = ${koperasi_ref}
      ORDER BY dibayar_pada DESC NULLS LAST LIMIT 8`;
    return json({ profil, saldo, byJenis, riwayat });
  },
  ANGGOTA,
);

// GET /api/anggota/simpanan — full savings summary + paginated ledger.
route(
  "GET",
  "/api/anggota/simpanan",
  async ({ session, url }) => {
    const { koperasi_ref, anggota_ref } = anggotaScope(session);
    const status = optionalOneOf(url.searchParams.get("status"), ["PAID", "UNPAID"]);
    const jenis = optionalOneOf(url.searchParams.get("jenis"), [
      "Simpanan Pokok",
      "Simpanan Wajib",
      "Simpanan Sukarela",
    ]);
    const { limit, offset, page } = pagination(url, 20, 100);
    const byJenis = await db`
      SELECT split_part(periode_pembayaran, ' - ', 1) AS jenis,
        COALESCE(sum(jumlah_simpanan) FILTER (WHERE status = 'PAID'), 0)::float8 AS paid,
        COALESCE(sum(jumlah_simpanan) FILTER (WHERE status = 'UNPAID'), 0)::float8 AS unpaid,
        count(*) FILTER (WHERE status = 'PAID')::int AS n_paid,
        count(*) FILTER (WHERE status = 'UNPAID')::int AS n_unpaid
      FROM ${db(shared("simpanan_anggota"))}
      WHERE anggota_ref = ${anggota_ref} AND koperasi_ref = ${koperasi_ref} GROUP BY 1 ORDER BY 1`;
    const filters = () => db`
      WHERE anggota_ref = ${anggota_ref} AND koperasi_ref = ${koperasi_ref}
        AND (${status}::text IS NULL OR status = ${status})
        AND (${jenis}::text IS NULL OR split_part(periode_pembayaran, ' - ', 1) = ${jenis})`;
    const [count] = await db`
      SELECT count(*)::int AS total FROM ${db(shared("simpanan_anggota"))} ${filters()}`;
    const data = await db`
      SELECT simpanan_ref, periode_pembayaran, split_part(periode_pembayaran, ' - ', 1) AS jenis,
             jumlah_simpanan::float8 AS jumlah, status, dibayar_pada, dibuat_pada
      FROM ${db(shared("simpanan_anggota"))} ${filters()}
      ORDER BY dibayar_pada DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`;
    return json({ byJenis, data, page, limit, total: count.total });
  },
  ANGGOTA,
);

// GET /api/anggota/profil — the member's own profile (KTP file path excluded).
route(
  "GET",
  "/api/anggota/profil",
  async ({ session }) => {
    const { koperasi_ref, anggota_ref } = anggotaScope(session);
    const [anggota] = await db`
      SELECT a.anggota_ref, a.nama, a.nik, a.jenis_kelamin, a.status_keanggotaan, a.status_akun,
             a.pekerjaan, a.tanggal_terdaftar, a.kode_wilayah,
             w.provinsi, w.kab_kota, w.kecamatan, w.desa_kelurahan,
             k.nama_koperasi, k.alamat_lengkap AS koperasi_alamat
      FROM ${db(shared("anggota_koperasi"))} a
      LEFT JOIN ${db(shared("referensi_wilayah"))} w ON w.kode_wilayah = a.kode_wilayah
      LEFT JOIN ${db(shared("profil_koperasi"))} k ON k.koperasi_ref = a.koperasi_ref
      WHERE a.anggota_ref = ${anggota_ref} AND a.koperasi_ref = ${koperasi_ref} LIMIT 1`;
    if (!anggota) return err(404, "Anggota tidak ditemukan.");
    return json({ anggota });
  },
  ANGGOTA,
);

// GET /api/anggota/produk — catalog of the member's koperasi.
route(
  "GET",
  "/api/anggota/produk",
  async ({ session, url }) => {
    const { koperasi_ref } = anggotaScope(session);
    const q = searchText(url.searchParams.get("q"));
    const { limit, offset, page } = pagination(url, 20, 100);
    const filters = () => db`
      WHERE pr.koperasi_ref = ${koperasi_ref}
        AND (${q}::text IS NULL OR pr.nama_produk ILIKE ${q ? likePattern(q) : null})`;
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
  ANGGOTA,
);

// GET /api/anggota/pengajuan — the member's financing applications (matched by NIK).
route(
  "GET",
  "/api/anggota/pengajuan",
  async ({ session }) => {
    const { koperasi_ref, anggota_ref } = anggotaScope(session);
    const [a] = await db`
      SELECT nik FROM ${db(shared("anggota_koperasi"))}
      WHERE anggota_ref = ${anggota_ref} AND koperasi_ref = ${koperasi_ref} LIMIT 1`;
    if (!a) return err(404, "Anggota tidak ditemukan.");
    if (!a.nik) return json({ data: [] });
    const data = await db`
      SELECT pengajuan_pembiayaan_ref, status_permohonan, nominal_permohonan::float8 AS nominal,
             tenor, tujuan_permohonan, dibuat_pada
      FROM ${db(shared("pengajuan_pembiayaan"))}
      WHERE koperasi_ref = ${koperasi_ref} AND nik = ${a.nik}
      ORDER BY dibuat_pada DESC NULLS LAST`;
    return json({ data });
  },
  ANGGOTA,
);
