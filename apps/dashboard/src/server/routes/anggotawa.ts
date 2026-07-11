/**
 * Portal ANGGOTA WA — anggota yang mendaftar/aktif lewat WhatsApp bot.
 * Sumber data: edig_dev_members (tabel tim), via sdb + team("members").
 * Scope = no_anggota dari SESSION bertanda-tangan (bukan input klien) → OWASP A01:
 * anggota WA hanya bisa melihat datanya sendiri.
 */
import { route } from "../router";
import { json, err } from "../http";
import { sdb } from "../sdb";
import { team } from "../tables";
import { waScope } from "../scope";

const ANGGOTA_WA = ["anggota_wa"] as const;
const MEMBERS = team("members");
const REWARD_POIN = 10;
const REWARD_SHU = 25000;

// GET /api/anggota-wa/overview — profil + simpanan + poin/SHU/referral milik dirinya.
route(
  "GET",
  "/api/anggota-wa/overview",
  async ({ session }) => {
    const no = waScope(session);
    const [m] = await sdb`
      SELECT no_anggota, nama, phone, role, sejak, kode_referral, lencana,
             pinjaman, usaha, keuangan, pendaftaran,
             coalesce(poin, 0)::int AS poin,
             coalesce(estimasi_shu, 0)::float8 AS estimasi_shu,
             coalesce(skor_keterlibatan, 0)::int AS skor_keterlibatan,
             coalesce(simpanan_pokok, 0)::float8 AS simpanan_pokok,
             coalesce(simpanan_wajib, 0)::float8 AS simpanan_wajib,
             coalesce(simpanan_sukarela, 0)::float8 AS simpanan_sukarela,
             updated_at
      FROM ${sdb(MEMBERS)} WHERE no_anggota = ${no} LIMIT 1`;
    if (!m) return err(404, "Data anggota tidak ditemukan.");
    // Sebagian baris menyimpan kolom jsonb sebagai STRING (double-encoded) —
    // normalisasi jadi objek agar frontend konsisten.
    for (const f of ["usaha", "keuangan", "pendaftaran", "pinjaman"] as const) {
      if (typeof m[f] === "string") {
        try {
          m[f] = JSON.parse(m[f] as string);
        } catch {
          m[f] = null;
        }
      }
    }
    const total_simpanan =
      Number(m.simpanan_pokok) + Number(m.simpanan_wajib) + Number(m.simpanan_sukarela);
    return json({ member: m, total_simpanan });
  },
  ANGGOTA_WA,
);

// GET /api/anggota-wa/referral — kode referral + reward milik dirinya (read-only).
// Pencatatan referral dilakukan lewat bot WhatsApp; portal ini hanya menampilkan.
route(
  "GET",
  "/api/anggota-wa/referral",
  async ({ session }) => {
    const no = waScope(session);
    const [m] = await sdb`
      SELECT kode_referral,
             coalesce(poin, 0)::int AS poin,
             coalesce(estimasi_shu, 0)::float8 AS estimasi_shu
      FROM ${sdb(MEMBERS)} WHERE no_anggota = ${no} LIMIT 1`;
    if (!m) return err(404, "Data anggota tidak ditemukan.");
    return json({
      kode_referral: m.kode_referral,
      poin: m.poin,
      estimasi_shu: m.estimasi_shu,
      jumlah_referral: Math.floor((m.poin ?? 0) / REWARD_POIN),
      reward_per_referral: { poin: REWARD_POIN, bonus_shu: REWARD_SHU },
    });
  },
  ANGGOTA_WA,
);

// GET /api/anggota-wa/pengurus — daftar pengurus koperasi (tabel tim edig_dev_pengurus).
route(
  "GET",
  "/api/anggota-wa/pengurus",
  async () => {
    const data = await sdb`
      SELECT id, coalesce(urutan, 0)::int AS urutan, nama, jabatan, no_hp, wilayah
      FROM ${sdb(team("pengurus"))}
      ORDER BY urutan ASC NULLS LAST, nama ASC`;
    return json({ data });
  },
  ANGGOTA_WA,
);
