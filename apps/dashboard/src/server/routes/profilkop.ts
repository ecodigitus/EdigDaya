/**
 * Pengurus secondary screens — READ-ONLY from the hackathon dataset (in the mirror):
 * pengajuan (4 jenis), RAT, and koperasi profile (+ pengurus & karyawan lists).
 */
import { route } from "../router";
import { json, err } from "../http";
import { db } from "../db";
import { shared } from "../tables";
import { koperasiScope } from "../scope";
import { oneOf } from "../validate";

// GET /api/pengurus/pengajuan?jenis=pembiayaan|kemitraan|domain|rekening
route(
  "GET",
  "/api/pengurus/pengajuan",
  async ({ session, url }) => {
    const kop = koperasiScope(session);
    const jenis = oneOf(url.searchParams.get("jenis"), ["pembiayaan", "kemitraan", "domain", "rekening"], "pembiayaan");
    let data: unknown[] = [];
    let summary: unknown[] = [];
    if (jenis === "pembiayaan") {
      data = await db`SELECT pengajuan_pembiayaan_ref AS ref, penanggung_jawab, nik, nominal_permohonan::float8 AS nominal, tenor, tujuan_permohonan, status_permohonan AS status, dibuat_pada
        FROM ${db(shared("pengajuan_pembiayaan"))} WHERE koperasi_ref = ${kop} ORDER BY dibuat_pada DESC NULLS LAST LIMIT 200`;
      summary = await db`SELECT status_permohonan AS status, count(*)::int n FROM ${db(shared("pengajuan_pembiayaan"))} WHERE koperasi_ref = ${kop} GROUP BY 1 ORDER BY 2 DESC`;
    } else if (jenis === "kemitraan") {
      data = await db`SELECT pengajuan_kemitraan_ref AS ref, penanggung_jawab, bisnis_kemitraan, paket_kemitraan, tipe_kemitraan, status_permohonan AS status, dibuat_pada
        FROM ${db(shared("pengajuan_kemitraan"))} WHERE koperasi_ref = ${kop} ORDER BY dibuat_pada DESC NULLS LAST LIMIT 200`;
      summary = await db`SELECT status_permohonan AS status, count(*)::int n FROM ${db(shared("pengajuan_kemitraan"))} WHERE koperasi_ref = ${kop} GROUP BY 1 ORDER BY 2 DESC`;
    } else if (jenis === "domain") {
      data = await db`SELECT domain_ref AS ref, domain_koperasi, status_verifikasi, status_domain AS status, dibuat_pada
        FROM ${db(shared("pengajuan_domain"))} WHERE koperasi_ref = ${kop} ORDER BY dibuat_pada DESC NULLS LAST LIMIT 200`;
      summary = await db`SELECT status_domain AS status, count(*)::int n FROM ${db(shared("pengajuan_domain"))} WHERE koperasi_ref = ${kop} GROUP BY 1 ORDER BY 2 DESC`;
    } else {
      data = await db`SELECT pengajuan_rekening_ref AS ref, penanggung_jawab, kode_bank, nama_bank, status, dibuat_pada
        FROM ${db(shared("pengajuan_rekening_bank"))} WHERE koperasi_ref = ${kop} ORDER BY dibuat_pada DESC NULLS LAST LIMIT 200`;
      summary = await db`SELECT status, count(*)::int n FROM ${db(shared("pengajuan_rekening_bank"))} WHERE koperasi_ref = ${kop} GROUP BY 1 ORDER BY 2 DESC`;
    }
    return json({ jenis, data, summary });
  },
  ["pengurus"],
);

// GET /api/pengurus/rat
route(
  "GET",
  "/api/pengurus/rat",
  async ({ session }) => {
    const kop = koperasiScope(session);
    const data = await db`SELECT rat_sample_id AS ref, tahun_buku, urutan_rat, tanggal_rat, jumlah_peserta_rat, status_rat, tahap_rat, jenis_sektor_koperasi
      FROM ${db(shared("rat_koperasi"))} WHERE koperasi_ref = ${kop} ORDER BY tahun_buku DESC NULLS LAST LIMIT 100`;
    const summary = await db`SELECT status_rat AS status, count(*)::int n FROM ${db(shared("rat_koperasi"))} WHERE koperasi_ref = ${kop} GROUP BY 1 ORDER BY 2 DESC`;
    return json({ data, summary });
  },
  ["pengurus"],
);

// GET /api/pengurus/profil — koperasi profile + pengurus + karyawan + counts
route(
  "GET",
  "/api/pengurus/profil",
  async ({ session }) => {
    const kop = koperasiScope(session);
    const [profil] = await db`SELECT koperasi_ref, nama_koperasi, status_registrasi, bentuk_koperasi, kategori_usaha, nik_koperasi, alamat_lengkap, kode_pos, modal_awal, tentang_koperasi
      FROM ${db(shared("profil_koperasi"))} WHERE koperasi_ref = ${kop} LIMIT 1`;
    if (!profil) return err(404, "Profil koperasi tidak ditemukan.");
    const pengurus = await db`SELECT pengurus_ref, nama, jabatan, status, no_hp, jenis_kelamin, periode_mulai, periode_selesai
      FROM ${db(shared("pengurus_koperasi"))} WHERE koperasi_ref = ${kop} ORDER BY jabatan ASC LIMIT 100`;
    const karyawan = await db`SELECT karyawan_ref, nama, jabatan, nomor_hp_karyawan, jenis_kelamin, status_karyawan
      FROM ${db(shared("karyawan_koperasi"))} WHERE koperasi_ref = ${kop} ORDER BY nama ASC LIMIT 100`;
    const [counts] = await db`SELECT
      (SELECT count(*)::int FROM ${db(shared("aset_koperasi"))} WHERE koperasi_ref = ${kop}) AS aset,
      (SELECT count(*)::int FROM ${db(shared("modal_koperasi"))} WHERE koperasi_ref = ${kop}) AS modal,
      (SELECT count(*)::int FROM ${db(shared("dokumen_koperasi"))} WHERE koperasi_ref = ${kop}) AS dokumen,
      (SELECT count(*)::int FROM ${db(shared("kbli_koperasi"))} WHERE koperasi_ref = ${kop}) AS kbli`;
    return json({ profil, pengurus, karyawan, counts });
  },
  ["pengurus"],
);
