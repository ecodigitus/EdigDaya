/**
 * Pre-Order, backed by the team-prefixed table `edig_dev_pre_orders` in the
 * Cloud SQL mirror. Anggota membuat & melacak pesanan; pengurus mengelola antrean.
 */
import { route } from "../router";
import { json, err, readJson } from "../http";
import { sdb } from "../sdb";
import { team } from "../tables";
import { anggotaScope, koperasiScope } from "../scope";

const PRE_ORDERS = team("pre_orders");
const STATUSES = ["MENUNGGU_ADMIN", "DIQUOTE", "DP_DIBAYAR", "FINAL", "BATAL"] as const;

// GET /api/anggota/pre-order — my pre-orders.
route(
  "GET",
  "/api/anggota/pre-order",
  async ({ session }) => {
    const { anggota_ref } = anggotaScope(session);
    const data = await sdb`
      SELECT id, produk, qty_num, catatan, status, harga, created_at
      FROM ${sdb(PRE_ORDERS)} WHERE anggota_ref = ${anggota_ref} ORDER BY created_at DESC LIMIT 100`;
    return json({ enabled: true, data });
  },
  ["anggota"],
);

// POST /api/anggota/pre-order — create a pre-order (product from catalog or free text).
route(
  "POST",
  "/api/anggota/pre-order",
  async ({ session, req }) => {
    const { koperasi_ref, anggota_ref } = anggotaScope(session);
    const body = await readJson<{ produk?: string; qty_num?: number; catatan?: string; produk_sample_id?: string }>(req);
    const produk = (body?.produk ?? "").trim().slice(0, 200);
    const qty = Number(body?.qty_num);
    if (!produk) return err(400, "Nama produk wajib diisi.");
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) return err(400, "Jumlah tidak valid.");
    const catatan = (body?.catatan ?? "").trim().slice(0, 500) || null;
    const psid = (body?.produk_sample_id ?? "").trim().slice(0, 120) || null;
    const [row] = await sdb`
      INSERT INTO ${sdb(PRE_ORDERS)} (id, user_name, anggota_ref, koperasi_ref, produk, qty_num, catatan, produk_sample_id, status, created_at)
      VALUES (${crypto.randomUUID()}, ${session!.nama ?? anggota_ref}, ${anggota_ref}, ${koperasi_ref}, ${produk}, ${qty}, ${catatan}, ${psid}, 'MENUNGGU_ADMIN', now())
      RETURNING id, produk, qty_num, catatan, status, created_at`;
    return json({ ok: true, data: row });
  },
  ["anggota"],
);

// GET /api/pengurus/pre-order — queue for this koperasi.
route(
  "GET",
  "/api/pengurus/pre-order",
  async ({ session }) => {
    const kop = koperasiScope(session);
    const data = await sdb`
      SELECT id, user_name, anggota_ref, produk, qty_num, catatan, status, harga, created_at
      FROM ${sdb(PRE_ORDERS)} WHERE koperasi_ref = ${kop} ORDER BY created_at DESC LIMIT 200`;
    return json({ enabled: true, data });
  },
  ["pengurus"],
);

// PATCH /api/pengurus/pre-order/:id — update status (tenant-enforced).
route(
  "PATCH",
  "/api/pengurus/pre-order/:id",
  async ({ session, params, req }) => {
    const kop = koperasiScope(session);
    const body = await readJson<{ status?: string }>(req);
    const status = String(body?.status ?? "");
    if (!(STATUSES as readonly string[]).includes(status)) return err(400, "Status tidak valid.");
    const [row] = await sdb`
      UPDATE ${sdb(PRE_ORDERS)} SET status = ${status} WHERE id = ${params.id} AND koperasi_ref = ${kop}
      RETURNING id, status`;
    if (!row) return err(404, "Pre-order tidak ditemukan.");
    return json({ ok: true, data: row });
  },
  ["pengurus"],
);
