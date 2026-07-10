/** List ALL public tables in the mirror + columns of the team-prefixed ones. */
import { SQL } from "bun";
const su = new SQL({
  url: `postgres://${encodeURIComponent(process.env.DB_USERNAME!)}:${encodeURIComponent(process.env.DB_PASSWORD!)}@${process.env.DB_HOST}:${process.env.DB_PORT ?? "5432"}/${process.env.DB_DATABASE}`,
  ssl: true, max: 2, idleTimeout: 15,
});
const tabs = await su<{ table_name: string }[]>`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`;
const names = tabs.map((t) => t.table_name);
console.log(`ALL ${names.length} tables:\n`, names.join(", "));

const hackathon = /^(akun_bank|anggota|aset|barang_|dokumen|gerai|inventaris|karyawan|kbli|modal|pengajuan|pengurus|produk|profil|rat|referensi|simpanan|transaksi)/;
const team = names.filter((n) => !hackathon.test(n));
console.log(`\nNON-hackathon (team) tables:`, team.join(", ") || "(none)");

for (const t of team) {
  const cols = await su<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${t} ORDER BY ordinal_position`;
  const [c] = await su`SELECT count(*)::int n FROM ${su(t)}`;
  console.log(`\n# ${t} (rows=${c.n})\n   ${cols.map((x) => x.column_name).join(", ")}`);
}
await su.end();
