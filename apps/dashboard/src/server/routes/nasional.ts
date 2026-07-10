/**
 * National aggregate dashboard — PUBLIC (no auth), jury/government facing.
 * Aggregates across all 1.026 koperasi (read-only hackathon data). Only
 * non-sensitive aggregates are exposed. Cached in-memory (cleared when a member
 * is onboarded so the digital-adoption gap reflects it).
 *
 * Digital adoption is shown honestly as two layers: baseline (simkopdes,
 * status_akun='Punya Akun') + onboarded via our platform (Supabase members
 * with koperasi_ref set). We never claim to change simkopdes itself.
 */
import { route } from "../router";
import { json, serverError } from "../http";
import { db } from "../db";
import { sdb, supabaseEnabled } from "../sdb";
import { shared, team } from "../tables";

let cache: { at: number; data: Record<string, unknown> } | null = null;
const TTL = 10 * 60 * 1000;

/** Invalidate the cache so the next fetch recomputes (e.g. after onboarding). */
export function clearNasionalCache(): void {
  cache = null;
}

route("GET", "/api/nasional/overview", async () => {
  try {
    if (cache && Date.now() - cache.at < TTL) {
      return json({ ...cache.data, cached: true });
    }
    const [anggota, koperasi, simpanan, gerai, rat, prov, produk, transaksi, kemitraan] =
      await Promise.all([
        db`SELECT count(*)::int total,
             count(*) FILTER (WHERE status_akun = 'Tidak Punya Akun')::int tanpa_akun,
             count(*) FILTER (WHERE status_akun = 'Punya Akun')::int punya_akun,
             count(*) FILTER (WHERE status_keanggotaan = 'Approved')::int approved,
             count(*) FILTER (WHERE status_keanggotaan = 'Requested')::int requested,
             count(*) FILTER (WHERE jenis_kelamin = 'LAKI-LAKI')::int laki,
             count(*) FILTER (WHERE jenis_kelamin = 'PEREMPUAN')::int perempuan
           FROM ${db(shared("anggota_koperasi"))}`,
        db`SELECT count(*)::int total FROM ${db(shared("profil_koperasi"))}`,
        db`SELECT coalesce(sum(jumlah_simpanan) FILTER (WHERE status = 'PAID'), 0)::float8 paid,
                  coalesce(sum(jumlah_simpanan) FILTER (WHERE status = 'UNPAID'), 0)::float8 unpaid,
                  count(*) FILTER (WHERE status = 'PAID')::int n_paid,
                  count(*) FILTER (WHERE status = 'UNPAID')::int n_unpaid
           FROM ${db(shared("simpanan_anggota"))}`,
        db`SELECT count(*)::int total, count(*) FILTER (WHERE status_gerai = 'Aktif')::int aktif
           FROM ${db(shared("gerai_koperasi"))}`,
        db`SELECT status_rat AS status, count(*)::int n FROM ${db(shared("rat_koperasi"))}
           GROUP BY 1 ORDER BY 2 DESC`,
        db`SELECT w.provinsi, count(*)::int anggota
           FROM ${db(shared("anggota_koperasi"))} a
           JOIN ${db(shared("referensi_koperasi_wilayah"))} kw ON kw.koperasi_ref = a.koperasi_ref
           JOIN ${db(shared("referensi_wilayah"))} w ON w.kode_wilayah = kw.kode_wilayah
           GROUP BY 1 ORDER BY 2 DESC`,
        db`SELECT count(*)::int total FROM ${db(shared("produk_koperasi"))}`,
        db`SELECT count(*)::int total, coalesce(sum(total_pembayaran), 0)::float8 nilai
           FROM ${db(shared("transaksi_penjualan"))}`,
        db`SELECT status_permohonan AS status, count(*)::int n FROM ${db(shared("pengajuan_kemitraan"))}
           GROUP BY 1 ORDER BY 2 DESC`,
      ]);

    // Overlay: members onboarded to digital via our platform.
    let onboarded = 0;
    if (supabaseEnabled) {
      try {
        const [o] = await sdb`SELECT count(*)::int n FROM ${sdb(team("members"))} WHERE koperasi_ref IS NOT NULL`;
        onboarded = o?.n ?? 0;
      } catch {
        /* keep 0 if supabase unreachable */
      }
    }

    const a = anggota[0];
    const belumDigital = Math.max(0, a.tanpa_akun - onboarded);
    const totalDigital = a.punya_akun + onboarded;
    const digital = {
      simkopdes: a.punya_akun,
      platform: onboarded,
      total_digital: totalDigital,
      belum: belumDigital,
      gap_pct: a.total > 0 ? (belumDigital / a.total) * 100 : 0,
      gap_awal_pct: a.total > 0 ? (a.tanpa_akun / a.total) * 100 : 0,
    };

    const data = {
      koperasi: koperasi[0],
      anggota: a,
      digital,
      simpanan: simpanan[0],
      gerai: gerai[0],
      produk: produk[0],
      transaksi: transaksi[0],
      rat,
      provinsi: prov,
      provinsi_count: prov.length,
      kemitraan,
      generated_at: new Date().toISOString(),
    };
    cache = { at: Date.now(), data };
    return json(data);
  } catch (e) {
    return serverError("nasional/overview", e);
  }
});
