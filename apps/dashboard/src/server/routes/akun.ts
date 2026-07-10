/**
 * Digital-account onboarding + referral, backed by the team-prefixed table
 * `edig_dev_members` in the Cloud SQL mirror (writes via koperasi_app, which has
 * write grants on the team tables only). "Punya akun digital" = ada baris di
 * members. Reward referral = bonus SHU (estimasi_shu) + poin.
 */
import { route } from "../router";
import { json, err, readJson } from "../http";
import { db } from "../db";
import { sdb } from "../sdb";
import { shared, team } from "../tables";
import { anggotaScope, koperasiScope } from "../scope";
import { clearNasionalCache } from "./nasional";

const MEMBERS = team("members");
const REWARD_POIN = 10;
const REWARD_SHU = 25000;

function kodeReferral(anggotaRef: string): string {
  const base = anggotaRef.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return "MP" + (base.slice(-6) || base || "000000");
}

// GET /api/anggota/akun — digital-account + referral status of the logged-in member.
route(
  "GET",
  "/api/anggota/akun",
  async ({ session }) => {
    const { koperasi_ref, anggota_ref } = anggotaScope(session);
    const [ah] = await db`
      SELECT nama, nik, status_akun FROM ${db(shared("anggota_koperasi"))}
      WHERE anggota_ref = ${anggota_ref} AND koperasi_ref = ${koperasi_ref} LIMIT 1`;
    if (!ah) return err(404, "Anggota tidak ditemukan.");
    const [member] = await sdb`
      SELECT no_anggota, nama, kode_referral, poin, estimasi_shu::float8 AS estimasi_shu, diaktifkan_pada
      FROM ${sdb(MEMBERS)} WHERE no_anggota = ${anggota_ref} LIMIT 1`;
    return json({
      status_simkopdes: ah.status_akun,
      aktif_platform: !!member,
      bisa_aktivasi: !member && ah.status_akun !== "Punya Akun",
      member: member ?? null,
    });
  },
  ["anggota"],
);

// POST /api/anggota/akun/aktivasi — create the member's digital account (row in members).
route(
  "POST",
  "/api/anggota/akun/aktivasi",
  async ({ session }) => {
    const { koperasi_ref, anggota_ref } = anggotaScope(session);
    const [ah] = await db`
      SELECT nama, nik, status_akun FROM ${db(shared("anggota_koperasi"))}
      WHERE anggota_ref = ${anggota_ref} AND koperasi_ref = ${koperasi_ref} LIMIT 1`;
    if (!ah) return err(404, "Anggota tidak ditemukan.");

    const [existing] = await sdb`
      SELECT no_anggota, nama, kode_referral, poin, estimasi_shu::float8 AS estimasi_shu
      FROM ${sdb(MEMBERS)} WHERE no_anggota = ${anggota_ref} LIMIT 1`;
    if (existing) return json({ ok: true, sudah_aktif: true, member: existing });

    if (ah.status_akun === "Punya Akun") return err(409, "Anggota ini sudah memiliki akun (simkopdes).");

    const kode = kodeReferral(anggota_ref);
    const [m] = await sdb`
      INSERT INTO ${sdb(MEMBERS)} (no_anggota, nama, nik, role, koperasi_ref, anggota_ref, kode_referral, diaktifkan_pada, updated_at)
      VALUES (${anggota_ref}, ${ah.nama ?? anggota_ref}, ${ah.nik ?? null}, 'anggota', ${koperasi_ref}, ${anggota_ref}, ${kode}, now(), now())
      RETURNING no_anggota, nama, kode_referral, poin, estimasi_shu::float8 AS estimasi_shu`;
    clearNasionalCache();
    return json({ ok: true, sudah_aktif: false, member: m });
  },
  ["anggota"],
);

// GET /api/anggota/referral — the member's referral code + reward so far.
route(
  "GET",
  "/api/anggota/referral",
  async ({ session }) => {
    const { anggota_ref } = anggotaScope(session);
    const [m] = await sdb`
      SELECT kode_referral, poin, estimasi_shu::float8 AS estimasi_shu
      FROM ${sdb(MEMBERS)} WHERE no_anggota = ${anggota_ref} LIMIT 1`;
    if (!m) return json({ enabled: true, aktif: false });
    return json({
      enabled: true,
      aktif: true,
      kode_referral: m.kode_referral,
      poin: m.poin,
      estimasi_shu: m.estimasi_shu,
      jumlah_referral: Math.floor((m.poin ?? 0) / REWARD_POIN),
      reward_per_referral: { poin: REWARD_POIN, bonus_shu: REWARD_SHU },
    });
  },
  ["anggota"],
);

// POST /api/anggota/referral/catat — record a successful referral → reward = bonus SHU + poin.
route(
  "POST",
  "/api/anggota/referral/catat",
  async ({ session, req }) => {
    const { anggota_ref } = anggotaScope(session);
    const body = await readJson<{ nama?: string }>(req);
    const nama = (body?.nama ?? "").trim().slice(0, 120);
    if (!nama) return err(400, "Nama orang yang direferensikan wajib diisi.");
    const [m] = await sdb`SELECT no_anggota FROM ${sdb(MEMBERS)} WHERE no_anggota = ${anggota_ref} LIMIT 1`;
    if (!m) return err(409, "Aktifkan akun digital dulu untuk mendapatkan kode referral.");
    const [u] = await sdb`
      UPDATE ${sdb(MEMBERS)} SET poin = poin + ${REWARD_POIN}, estimasi_shu = estimasi_shu + ${REWARD_SHU}, updated_at = now()
      WHERE no_anggota = ${anggota_ref}
      RETURNING poin, estimasi_shu::float8 AS estimasi_shu`;
    return json({ ok: true, poin: u.poin, estimasi_shu: u.estimasi_shu, reward: { poin: REWARD_POIN, bonus_shu: REWARD_SHU } });
  },
  ["anggota"],
);

// GET /api/pengurus/referral — leaderboard for this koperasi.
route(
  "GET",
  "/api/pengurus/referral",
  async ({ session }) => {
    const kop = koperasiScope(session);
    const data = await sdb`
      SELECT no_anggota, nama, kode_referral, poin, estimasi_shu::float8 AS estimasi_shu
      FROM ${sdb(MEMBERS)} WHERE koperasi_ref = ${kop} ORDER BY poin DESC, estimasi_shu DESC LIMIT 20`;
    const [total] = await sdb`
      SELECT count(*)::int anggota, coalesce(sum(poin),0)::int poin, coalesce(sum(estimasi_shu),0)::float8 bonus_shu
      FROM ${sdb(MEMBERS)} WHERE koperasi_ref = ${kop}`;
    return json({ enabled: true, data, total });
  },
  ["pengurus"],
);

// POST /api/anggota/akun/nonaktif — self-deactivate (DEMO reset).
// Only removes the platform-onboarding row we created (diaktifkan_pada set).
route(
  "POST",
  "/api/anggota/akun/nonaktif",
  async ({ session }) => {
    const { anggota_ref } = anggotaScope(session);
    const del = await sdb`
      DELETE FROM ${sdb(MEMBERS)} WHERE no_anggota = ${anggota_ref} AND diaktifkan_pada IS NOT NULL
      RETURNING no_anggota`;
    clearNasionalCache();
    return json({ ok: true, deleted: del.length });
  },
  ["anggota"],
);

// POST /api/pengurus/reset-demo — remove ALL platform-onboarded members for this koperasi (DEMO).
// Airtight: diaktifkan_pada IS NOT NULL → only rows our onboarding created; pre-existing members untouched.
route(
  "POST",
  "/api/pengurus/reset-demo",
  async ({ session }) => {
    const kop = koperasiScope(session);
    const del = await sdb`
      DELETE FROM ${sdb(MEMBERS)} WHERE koperasi_ref = ${kop} AND diaktifkan_pada IS NOT NULL
      RETURNING no_anggota`;
    clearNasionalCache();
    return json({ ok: true, deleted: del.length });
  },
  ["pengurus"],
);
