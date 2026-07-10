/**
 * Content modules backed by team-prefixed mirror tables:
 *  - Pengumuman (edig_dev_pengumuman): pengurus buat/hapus, anggota lihat.
 *  - Transparansi (edig_dev_laporan_transparansi): anggota lapor, pengurus verifikasi.
 * Scoped per koperasi_ref (rows with NULL koperasi_ref = pengumuman umum/global).
 */
import { route } from "../router";
import { json, err, readJson } from "../http";
import { sdb } from "../sdb";
import { team } from "../tables";
import { anggotaScope, koperasiScope } from "../scope";

const PENGUMUMAN = team("pengumuman");
const TRANSPARANSI = team("laporan_transparansi");
// NOTE: edig_dev_laporan_transparansi is APPEND-ONLY (DB trigger block_laporan_mutation
// blocks UPDATE/DELETE) — a tamper-proof transparency log. Reports can be submitted &
// viewed, never altered. So there is no status-update endpoint by design.

// ---- Pengumuman ----
route(
  "GET",
  "/api/pengurus/pengumuman",
  async ({ session }) => {
    const kop = koperasiScope(session);
    const data = await sdb`
      SELECT id, judul, isi, penting, penulis, created_at, koperasi_ref
      FROM ${sdb(PENGUMUMAN)} WHERE koperasi_ref = ${kop} OR koperasi_ref IS NULL
      ORDER BY created_at DESC LIMIT 100`;
    return json({ data });
  },
  ["pengurus"],
);

route(
  "POST",
  "/api/pengurus/pengumuman",
  async ({ session, req }) => {
    const kop = koperasiScope(session);
    const b = await readJson<{ judul?: string; isi?: string; penting?: boolean }>(req);
    const judul = (b?.judul ?? "").trim().slice(0, 200);
    const isi = (b?.isi ?? "").trim().slice(0, 4000);
    if (!judul || !isi) return err(400, "Judul & isi wajib diisi.");
    const [row] = await sdb`
      INSERT INTO ${sdb(PENGUMUMAN)} (judul, isi, penting, penulis, koperasi_ref, created_at)
      VALUES (${judul}, ${isi}, ${!!b?.penting}, ${session!.nama ?? "Pengurus"}, ${kop}, now())
      RETURNING id, judul, isi, penting, penulis, created_at`;
    return json({ ok: true, data: row });
  },
  ["pengurus"],
);

route(
  "DELETE",
  "/api/pengurus/pengumuman/:id",
  async ({ session, params }) => {
    const kop = koperasiScope(session);
    const del = await sdb`DELETE FROM ${sdb(PENGUMUMAN)} WHERE id = ${params.id} AND koperasi_ref = ${kop} RETURNING id`;
    if (!del.length) return err(404, "Pengumuman tidak ditemukan (atau milik umum, tak bisa dihapus).");
    return json({ ok: true });
  },
  ["pengurus"],
);

route(
  "GET",
  "/api/anggota/pengumuman",
  async ({ session }) => {
    const { koperasi_ref } = anggotaScope(session);
    const data = await sdb`
      SELECT id, judul, isi, penting, penulis, created_at
      FROM ${sdb(PENGUMUMAN)} WHERE koperasi_ref = ${koperasi_ref} OR koperasi_ref IS NULL
      ORDER BY created_at DESC LIMIT 100`;
    return json({ data });
  },
  ["anggota", "anggota_wa"],
);

// ---- Transparansi ----
route(
  "POST",
  "/api/anggota/transparansi",
  async ({ session, req }) => {
    const { koperasi_ref, anggota_ref } = anggotaScope(session);
    const b = await readJson<{ kategori?: string; isi?: string; anonim?: boolean; pelapor_no?: string }>(req);
    const kategori = (b?.kategori ?? "Lainnya").trim().slice(0, 80) || "Lainnya";
    const isi = (b?.isi ?? "").trim().slice(0, 4000);
    if (!isi) return err(400, "Isi laporan wajib diisi.");
    const anonim = !!b?.anonim;
    const [row] = await sdb`
      INSERT INTO ${sdb(TRANSPARANSI)} (kategori, isi, anonim, pelapor_nama, pelapor_no, status, koperasi_ref, anggota_ref, created_at)
      VALUES (${kategori}, ${isi}, ${anonim}, ${anonim ? null : (session!.nama ?? null)}, ${(b?.pelapor_no ?? "").trim().slice(0, 40) || null}, 'BELUM_DIVERIFIKASI', ${koperasi_ref}, ${anggota_ref}, now())
      RETURNING id, kategori, isi, anonim, status, created_at`;
    return json({ ok: true, data: row });
  },
  ["anggota", "anggota_wa"],
);

route(
  "GET",
  "/api/anggota/transparansi",
  async ({ session }) => {
    const { anggota_ref } = anggotaScope(session);
    const data = await sdb`
      SELECT id, kategori, isi, anonim, status, created_at
      FROM ${sdb(TRANSPARANSI)} WHERE anggota_ref = ${anggota_ref} ORDER BY created_at DESC LIMIT 100`;
    return json({ data });
  },
  ["anggota", "anggota_wa"],
);

route(
  "GET",
  "/api/pengurus/transparansi",
  async ({ session }) => {
    const kop = koperasiScope(session);
    const data = await sdb`
      SELECT id, kategori, isi, anonim, pelapor_nama, pelapor_no, status, created_at
      FROM ${sdb(TRANSPARANSI)} WHERE koperasi_ref = ${kop} ORDER BY created_at DESC LIMIT 200`;
    return json({ data });
  },
  ["pengurus"],
);

