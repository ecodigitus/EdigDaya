/** End-to-end API smoke test incl. RBAC + tenant isolation. Server must be running. */
const B = process.env.BASE ?? "http://localhost:3000";
const KOP = "KOP-6CD12C90D1FB";
const KOP2 = "KOP-CEBD84B2F4E7";
const AGT = "AGT-C41210C84A8A";

async function j(method: string, path: string, body?: unknown, token?: string) {
  const r = await fetch(B + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let d: any;
  try {
    d = JSON.parse(t);
  } catch {
    d = t;
  }
  return { status: r.status, d };
}

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, extra = "") {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  cond ? pass++ : fail++;
}

// --- Pengurus ---
const lp = await j("POST", "/api/auth/login", { role: "pengurus", koperasi_ref: KOP });
check("login pengurus", lp.status === 200 && !!lp.d.token);
const P = lp.d.token as string;

const ov = await j("GET", "/api/pengurus/overview", undefined, P);
check("pengurus/overview", ov.status === 200, `anggota=${ov.d.anggota?.total} simpananPaid=${ov.d.simpanan?.paid}`);
const tr = await j("GET", "/api/pengurus/trends", undefined, P);
check("pengurus/trends", tr.status === 200, `simpananMonths=${tr.d.simpanan?.length}`);
const al = await j("GET", "/api/pengurus/anggota?limit=5", undefined, P);
check("pengurus/anggota list", al.status === 200 && Array.isArray(al.d.data), `total=${al.d.total}`);
const firstRef = al.d.data?.[0]?.anggota_ref;
const ad = await j("GET", "/api/pengurus/anggota/" + encodeURIComponent(firstRef ?? "x"), undefined, P);
check("pengurus/anggota detail", ad.status === 200, `jenis=${ad.d.simpanan?.byJenis?.length}`);
const ss = await j("GET", "/api/pengurus/simpanan/summary", undefined, P);
check("pengurus/simpanan/summary", ss.status === 200, `jenis=${ss.d.byJenis?.length}`);
const sl = await j("GET", "/api/pengurus/simpanan?status=UNPAID&limit=5", undefined, P);
check("pengurus/simpanan list", sl.status === 200, `total=${sl.d.total}`);
const pl = await j("GET", "/api/pengurus/produk?limit=5", undefined, P);
check("pengurus/produk", pl.status === 200, `total=${pl.d.total}`);
const tl = await j("GET", "/api/pengurus/transaksi?limit=5", undefined, P);
check("pengurus/transaksi", tl.status === 200, `total=${tl.d.total}`);
const gl = await j("GET", "/api/pengurus/gerai", undefined, P);
check("pengurus/gerai", gl.status === 200, `n=${gl.d.data?.length}`);

// --- Anggota ---
const la = await j("POST", "/api/auth/login", { role: "anggota", anggota_ref: AGT });
check("login anggota", la.status === 200 && !!la.d.token);
const A = la.d.token as string;

const aov = await j("GET", "/api/anggota/overview", undefined, A);
check("anggota/overview", aov.status === 200, `saldoPaid=${aov.d.saldo?.paid}`);
const asi = await j("GET", "/api/anggota/simpanan?limit=5", undefined, A);
check("anggota/simpanan", asi.status === 200, `total=${asi.d.total}`);
const apr = await j("GET", "/api/anggota/profil", undefined, A);
check("anggota/profil", apr.status === 200, `nama=${apr.d.anggota?.nama}`);
const apd = await j("GET", "/api/anggota/produk?limit=5", undefined, A);
check("anggota/produk", apd.status === 200, `total=${apd.d.total}`);
const apg = await j("GET", "/api/anggota/pengajuan", undefined, A);
check("anggota/pengajuan", apg.status === 200, `n=${apg.d.data?.length}`);

// --- RBAC + tenant isolation ---
check("pengurus->anggota API = 403", (await j("GET", "/api/anggota/overview", undefined, P)).status === 403);
check("anggota->pengurus API = 403", (await j("GET", "/api/pengurus/overview", undefined, A)).status === 403);
check("no token = 401", (await j("GET", "/api/pengurus/overview")).status === 401);

// cross-tenant: fetch an anggota_ref from KOP2, then request it as pengurus of KOP → expect 404
const other = await j("GET", "/api/auth/anggota?koperasi_ref=" + KOP2 + "&limit=1");
const otherRef = other.d.data?.[0]?.anggota_ref;
if (otherRef) {
  const x = await j("GET", "/api/pengurus/anggota/" + encodeURIComponent(otherRef), undefined, P);
  check("cross-tenant anggota detail = 404", x.status === 404, `otherRef=${otherRef}`);
} else {
  check("cross-tenant setup", false, "could not fetch KOP2 anggota");
}

console.log(`\n${fail === 0 ? "🎉" : "⚠️"} PASS=${pass} FAIL=${fail}`);
