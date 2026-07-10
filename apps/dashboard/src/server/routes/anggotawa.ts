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

// GET /api/anggota-wa/overview — profil + simpanan + poin/SHU/referral milik dirinya.
route(
  "GET",
  "/api/anggota-wa/overview",
  async ({ session }) => {
    const no = waScope(session);
    const [m] = await sdb`
      SELECT no_anggota, nama, phone, role, sejak, kode_referral, lencana,
             coalesce(poin, 0)::int AS poin,
             coalesce(estimasi_shu, 0)::float8 AS estimasi_shu,
             coalesce(skor_keterlibatan, 0)::int AS skor_keterlibatan,
             coalesce(simpanan_pokok, 0)::float8 AS simpanan_pokok,
             coalesce(simpanan_wajib, 0)::float8 AS simpanan_wajib,
             coalesce(simpanan_sukarela, 0)::float8 AS simpanan_sukarela,
             updated_at
      FROM ${sdb(MEMBERS)} WHERE no_anggota = ${no} LIMIT 1`;
    if (!m) return err(404, "Data anggota tidak ditemukan.");
    const total_simpanan =
      Number(m.simpanan_pokok) + Number(m.simpanan_wajib) + Number(m.simpanan_sukarela);
    return json({ member: m, total_simpanan });
  },
  ANGGOTA_WA,
);
