/** Smoke test for (b) content modules + (c) pengurus secondary screens. */
const B = "http://localhost:3000";
let pass = 0, fail = 0;
function check(n: string, c: boolean, d = "") { if (c) { pass++; console.log("  ✅", n); } else { fail++; console.log("  ❌", n, d); } }
async function j(m: string, p: string, b?: unknown, t?: string) {
  const r = await fetch(B + p, { method: m, headers: { ...(b ? { "content-type": "application/json" } : {}), ...(t ? { authorization: "Bearer " + t } : {}) }, body: b ? JSON.stringify(b) : undefined });
  let d: any = null; try { d = await r.json(); } catch {}
  return { s: r.status, d };
}
const KOP = "KOP-6CD12C90D1FB";
const AGT = "AGT-37DB26D5F6E0";

let r = await j("POST", "/api/auth/login", { role: "pengurus", koperasi_ref: KOP });
const pTok = r.d?.token; check("login pengurus", !!pTok);

// (b) Pengumuman
r = await j("POST", "/api/pengurus/pengumuman", { judul: "Uji Pengumuman", isi: "Isi uji", penting: true }, pTok);
check("pengurus buat pengumuman", r.s === 200 && !!r.d?.data?.id, JSON.stringify(r.d));
const pengId = r.d?.data?.id;
r = await j("GET", "/api/pengurus/pengumuman", null, pTok);
check("pengurus list pengumuman", r.s === 200 && r.d?.data?.some((x: any) => x.id === pengId));

// (c) Pengajuan / RAT / Profil
r = await j("GET", "/api/pengurus/pengajuan?jenis=pembiayaan", null, pTok);
check("pengajuan pembiayaan", r.s === 200 && Array.isArray(r.d?.data) && Array.isArray(r.d?.summary), JSON.stringify(r.d).slice(0, 120));
r = await j("GET", "/api/pengurus/pengajuan?jenis=kemitraan", null, pTok);
check("pengajuan kemitraan", r.s === 200 && Array.isArray(r.d?.data));
r = await j("GET", "/api/pengurus/rat", null, pTok);
check("rat", r.s === 200 && Array.isArray(r.d?.data), JSON.stringify(r.d).slice(0, 120));
r = await j("GET", "/api/pengurus/profil", null, pTok);
check("profil koperasi", r.s === 200 && !!r.d?.profil && Array.isArray(r.d?.pengurus) && Array.isArray(r.d?.karyawan), JSON.stringify(r.d?.counts));
console.log("     profil:", r.d?.profil?.nama_koperasi, "| pengurus:", r.d?.pengurus?.length, "| karyawan:", r.d?.karyawan?.length, "| counts:", JSON.stringify(r.d?.counts));

// (b) Transparansi — anggota submit, pengurus manage
r = await j("POST", "/api/auth/login", { role: "anggota", anggota_ref: AGT });
const aTok = r.d?.token; check("login anggota", !!aTok);
r = await j("POST", "/api/anggota/transparansi", { kategori: "Keuangan", isi: "Laporan uji", anonim: false }, aTok);
check("anggota kirim transparansi", r.s === 200 && !!r.d?.data?.id, JSON.stringify(r.d));
r = await j("GET", "/api/anggota/transparansi", null, aTok);
check("anggota list transparansi", r.s === 200 && (r.d?.data?.length ?? 0) >= 1);
r = await j("GET", "/api/anggota/pengumuman", null, aTok);
check("anggota lihat pengumuman", r.s === 200 && r.d?.data?.some((x: any) => x.id === pengId));

r = await j("GET", "/api/pengurus/transparansi", null, pTok);
check("pengurus lihat transparansi (read-only, append-only)", r.s === 200 && (r.d?.data?.length ?? 0) >= 1);

// cleanup: delete the test pengumuman
r = await j("DELETE", "/api/pengurus/pengumuman/" + pengId, null, pTok);
check("hapus pengumuman uji", r.s === 200);

console.log(`\n${fail === 0 ? "✅ ALL PASS" : "❌ FAIL"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
