/**
 * Table-name resolver + whitelist.
 *
 * Rule compliance: the shared dataset (27 tables) is read-only and UNPREFIXED;
 * team-owned tables we create ourselves carry the configured team prefix.
 * Because both resolvers only accept whitelisted names, resolved identifiers
 * are never influenced by user input (defends against identifier injection).
 */
import { config } from "./config";

/** 27 shared, read-only source tables (unprefixed, owned by the organizer). */
export const SHARED_TABLES = [
  "akun_bank_koperasi",
  "anggota_koperasi",
  "aset_koperasi",
  "barang_keluar_produk",
  "barang_masuk_produk",
  "dokumen_koperasi",
  "gerai_koperasi",
  "inventaris_produk",
  "karyawan_koperasi",
  "kbli_koperasi",
  "modal_koperasi",
  "pengajuan_domain",
  "pengajuan_kemitraan",
  "pengajuan_pembiayaan",
  "pengajuan_rekening_bank",
  "pengurus_koperasi",
  "produk_koperasi",
  "profil_koperasi",
  "rat_koperasi",
  "referensi_dokumen_koperasi",
  "referensi_gerai_koperasi",
  "referensi_komoditas_desa",
  "referensi_koperasi_wilayah",
  "referensi_profil_desa",
  "referensi_wilayah",
  "simpanan_anggota",
  "transaksi_penjualan",
] as const;
export type SharedTable = (typeof SHARED_TABLES)[number];
const SHARED = new Set<string>(SHARED_TABLES);

/** Team-owned tables (writable) in the mirror, under the team prefix (edig_dev_). */
export const TEAM_TABLES = ["members", "pre_orders", "pengumuman", "pengurus", "laporan_transparansi"] as const;
export type TeamTable = (typeof TEAM_TABLES)[number];
const TEAM = new Set<string>(TEAM_TABLES);

/** Resolve a shared table name (returns a known, safe identifier). */
export function shared(name: SharedTable): SharedTable {
  if (!SHARED.has(name)) throw new Error(`Unknown shared table: ${name}`);
  return name;
}

/** Resolve a team-owned table name with the configured prefix. */
export function team(name: TeamTable): string {
  if (!TEAM.has(name)) throw new Error(`Unknown team table: ${name}`);
  return `${config.tablePrefix}${name}`;
}
