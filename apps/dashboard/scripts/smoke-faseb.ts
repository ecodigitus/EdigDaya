/** Fase B smoke test (writes to Supabase): activation, referral, pre-order, national overlay. */
import { SQL } from "bun";
const BASE = "http://localhost:3000";
let pass = 0;
let fail = 0;
function check(n: string, c: boolean, d = "") {
  if (c) { pass++; console.log("  ✅", n); }
  else { fail++; console.log("  ❌", n, d); }
}
async function j(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try { data = await r.json(); } catch {}
  return { status: r.status, data };
}

const KOP = "KOP-6CD12C90D1FB";
const hurl = `postgres://${encodeURIComponent(process.env.DB_USERNAME!)}:${encodeURIComponent(process.env.DB_PASSWORD!)}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;
const hdb = new SQL({ url: hurl, ssl: true, max: 2, idleTimeout: 15 });
const [ag] = await hdb`SELECT anggota_ref, nama FROM anggota_koperasi WHERE koperasi_ref = ${KOP} AND status_akun = 'Tidak Punya Akun' LIMIT 1`;
await hdb.end();
if (!ag) { console.log("Tidak ada anggota 'Tidak Punya Akun' di KOP demo"); process.exit(1); }
console.log("test anggota:", ag.anggota_ref, "-", ag.nama);

let r = await j("POST", "/api/auth/login", { role: "anggota", anggota_ref: ag.anggota_ref });
check("login anggota", r.status === 200 && !!r.data?.token, JSON.stringify(r.data));
const aTok = r.data?.token;

r = await j("GET", "/api/anggota/akun", null, aTok);
check("akun status", r.status === 200 && (r.data?.bisa_aktivasi || r.data?.aktif_platform), JSON.stringify(r.data));

r = await j("POST", "/api/anggota/akun/aktivasi", {}, aTok);
check("aktivasi akun digital", r.status === 200 && !!r.data?.member?.kode_referral, JSON.stringify(r.data));
console.log("   kode referral:", r.data?.member?.kode_referral);

r = await j("GET", "/api/anggota/akun", null, aTok);
check("aktif_platform=true", r.status === 200 && r.data?.aktif_platform === true, JSON.stringify(r.data));

r = await j("POST", "/api/anggota/referral/catat", { nama: "Budi Test" }, aTok);
check("catat referral → bonus SHU", r.status === 200 && r.data?.estimasi_shu >= 25000, JSON.stringify(r.data));

r = await j("POST", "/api/anggota/pre-order", { produk: "Beras Premium 5kg", qty_num: 3, catatan: "tes" }, aTok);
check("buat pre-order", r.status === 200 && !!r.data?.data?.id, JSON.stringify(r.data));
const poId = r.data?.data?.id;

r = await j("GET", "/api/anggota/pre-order", null, aTok);
check("list pre-order anggota", r.status === 200 && (r.data?.data?.length ?? 0) >= 1);

r = await j("POST", "/api/auth/login", { role: "pengurus", koperasi_ref: KOP });
const pTok = r.data?.token;
check("login pengurus", !!pTok);

r = await j("GET", "/api/pengurus/pre-order", null, pTok);
check("pengurus lihat antrean pre-order", r.status === 200 && r.data?.data?.some((x: any) => x.id === poId), JSON.stringify(r.data).slice(0, 160));

r = await j("PATCH", "/api/pengurus/pre-order/" + encodeURIComponent(poId), { status: "DIQUOTE" }, pTok);
check("pengurus ubah status", r.status === 200 && r.data?.data?.status === "DIQUOTE", JSON.stringify(r.data));

r = await j("GET", "/api/pengurus/referral", null, pTok);
check("leaderboard referral", r.status === 200 && r.data?.enabled && r.data?.total?.anggota >= 1, JSON.stringify(r.data).slice(0, 160));

r = await j("GET", "/api/nasional/overview");
check("nasional digital.platform>=1 (76,3% bergerak)", r.status === 200 && (r.data?.digital?.platform ?? 0) >= 1, JSON.stringify(r.data?.digital));
console.log("   digital:", JSON.stringify(r.data?.digital));

console.log(`\n${fail === 0 ? "✅ ALL PASS" : "❌ FAIL"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
