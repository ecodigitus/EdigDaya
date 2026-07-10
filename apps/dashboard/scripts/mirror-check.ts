/** Inspect the Cloud SQL mirror: tables, write-table candidates, koperasi_app grants. */
import { SQL } from "bun";
const su = new SQL({
  url: `postgres://${encodeURIComponent(process.env.DB_USERNAME!)}:${encodeURIComponent(process.env.DB_PASSWORD!)}@${process.env.DB_HOST}:${process.env.DB_PORT ?? "5432"}/${process.env.DB_DATABASE}`,
  ssl: true, max: 2, idleTimeout: 15, connectionTimeout: 15,
});
const [w] = await su`SELECT current_user AS u`;
console.log("connected as", w.u, "->", process.env.DB_DATABASE);

const tabs = await su<{ table_name: string }[]>`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`;
const names = tabs.map((t) => t.table_name);
console.log("total tables:", names.length);
console.log("members?", names.includes("members"), "| pre_orders?", names.includes("pre_orders"));

const hackathonPrefix = /^(akun_bank|anggota|aset|barang_|dokumen|gerai|inventaris|karyawan|kbli|modal|pengajuan|pengurus|produk|profil|rat|referensi|simpanan|transaksi)/;
console.log("tabel non-hackathon:", names.filter((n) => !hackathonPrefix.test(n)).join(", ") || "(tidak ada)");

const gr = await su<{ table_name: string; privilege_type: string }[]>`
  SELECT table_name, privilege_type FROM information_schema.role_table_grants
  WHERE grantee = 'koperasi_app' AND privilege_type IN ('INSERT','UPDATE','DELETE')
  ORDER BY table_name LIMIT 40`;
console.log("koperasi_app write grants:", gr.length ? gr.map((g) => `${g.table_name}:${g.privilege_type}`).join(", ") : "(none — SELECT-only)");

await su.end();
