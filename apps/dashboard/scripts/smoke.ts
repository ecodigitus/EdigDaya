/** End-to-end smoke test against a running server on :3000. Read-only. */
const BASE = "http://localhost:3000";
let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}  ${detail}`);
  }
}
async function j(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

const KOP = "KOP-6CD12C90D1FB";
const AGT = "AGT-C41210C84A8A";

let r = await j("GET", "/api/health");
check("health", r.status === 200 && r.data?.ok, `status=${r.status}`);

r = await j("POST", "/api/auth/login", { role: "pengurus", koperasi_ref: KOP });
check("login pengurus", r.status === 200 && !!r.data?.token, JSON.stringify(r.data));
const pTok = r.data?.token;

r = await j("GET", "/api/pengurus/overview", null, pTok);
check("pengurus/overview", r.status === 200 && r.data?.anggota?.total > 0, JSON.stringify(r.data).slice(0, 240));
console.log("     →", JSON.stringify(r.data));

r = await j("GET", "/api/pengurus/trends", null, pTok);
check("pengurus/trends", r.status === 200 && Array.isArray(r.data?.simpanan), `status=${r.status}`);

r = await j("GET", "/api/pengurus/anggota?limit=5&status=Approved&sort=tanggal_terdaftar", null, pTok);
check("pengurus/anggota (filter+sort, FRAGMENT COMPOSITION)", r.status === 200 && Array.isArray(r.data?.data), JSON.stringify(r.data).slice(0, 300));
console.log("     → total:", r.data?.total, "first:", r.data?.data?.[0]?.anggota_ref);
const someRef = r.data?.data?.[0]?.anggota_ref;

r = await j("GET", "/api/pengurus/anggota?q=SAMPLE", null, pTok);
check("pengurus/anggota (search q)", r.status === 200 && Array.isArray(r.data?.data), `status=${r.status}`);

if (someRef) {
  r = await j("GET", "/api/pengurus/anggota/" + someRef, null, pTok);
  check("pengurus/anggota/:ref", r.status === 200 && !!r.data?.anggota, JSON.stringify(r.data).slice(0, 200));
}

r = await j("GET", "/api/pengurus/simpanan?limit=5&status=PAID", null, pTok);
check("pengurus/simpanan", r.status === 200 && Array.isArray(r.data?.data), `status=${r.status}`);
r = await j("GET", "/api/pengurus/simpanan/summary", null, pTok);
check("pengurus/simpanan/summary", r.status === 200 && Array.isArray(r.data?.byJenis), `status=${r.status}`);
r = await j("GET", "/api/pengurus/produk?limit=5", null, pTok);
check("pengurus/produk", r.status === 200 && Array.isArray(r.data?.data), `status=${r.status}`);
r = await j("GET", "/api/pengurus/transaksi?limit=5", null, pTok);
check("pengurus/transaksi", r.status === 200 && Array.isArray(r.data?.data), `status=${r.status}`);
r = await j("GET", "/api/pengurus/gerai", null, pTok);
check("pengurus/gerai", r.status === 200 && Array.isArray(r.data?.data), `status=${r.status}`);

r = await j("GET", "/api/pengurus/overview");
check("no token → 401", r.status === 401, `got ${r.status}`);

r = await j("POST", "/api/auth/login", { role: "anggota", anggota_ref: AGT });
check("login anggota", r.status === 200 && !!r.data?.token, JSON.stringify(r.data));
const aTok = r.data?.token;
check("anggota scoped to KOP", r.data?.session?.koperasi_ref === KOP, `got ${r.data?.session?.koperasi_ref}`);

r = await j("GET", "/api/anggota/overview", null, pTok);
check("pengurus token on /anggota → 403", r.status === 403, `got ${r.status}`);

r = await j("GET", "/api/anggota/overview", null, aTok);
check("anggota/overview", r.status === 200 && !!r.data?.profil, JSON.stringify(r.data).slice(0, 200));
console.log("     →", JSON.stringify(r.data?.saldo), JSON.stringify(r.data?.byJenis));
r = await j("GET", "/api/anggota/simpanan?limit=5", null, aTok);
check("anggota/simpanan", r.status === 200 && Array.isArray(r.data?.data), `status=${r.status}`);
r = await j("GET", "/api/anggota/profil", null, aTok);
check("anggota/profil", r.status === 200 && !!r.data?.anggota, `status=${r.status}`);
r = await j("GET", "/api/anggota/produk?limit=5", null, aTok);
check("anggota/produk", r.status === 200 && Array.isArray(r.data?.data), `status=${r.status}`);
r = await j("GET", "/api/anggota/pengajuan", null, aTok);
check("anggota/pengajuan", r.status === 200 && Array.isArray(r.data?.data), `status=${r.status}`);

console.log(`\n${fail === 0 ? "✅ ALL PASS" : "❌ FAIL"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
