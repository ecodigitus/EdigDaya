/**
 * Tes API key Gemini (Generative Language API) — berdiri sendiri.
 *
 * Cara pakai (Bun auto-load .env):
 *   bun run scripts/test-gemini.ts                  # pakai GEMINI_API_KEY dari .env
 *   bun run scripts/test-gemini.ts <API_KEY>        # pakai key dari argument
 *   bun run scripts/test-gemini.ts <API_KEY> <MODEL>
 *
 * Dua cek terpisah:
 *   1) ListModels  -> apakah KEY VALID & API aktif (call GRATIS, tak kena billing)
 *   2) generateContent -> apakah bisa GENERATE (di sinilah masalah billing/kuota muncul)
 */
const key = (process.argv[2] || process.env.GEMINI_API_KEY || '').trim();
const model = (process.argv[3] || process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

if (!key) {
  console.log('❌ Tidak ada API key. Isi GEMINI_API_KEY di .env, atau: bun run scripts/test-gemini.ts <API_KEY>');
  process.exit(1);
}
console.log(`🔑 Key: ...${key.slice(-6)}  | Model: ${model}\n`);

async function main() {
  // 1) ListModels — validasi key + API aktif
  console.log('1) Cek key (ListModels)...');
  try {
    const r = await fetch(`${BASE}/models?key=${encodeURIComponent(key)}`);
    const d: any = await r.json();
    if (d.error) {
      console.log(`   ❌ ${d.error.code} ${d.error.status} — ${d.error.message}`);
      if (d.error.status === 'PERMISSION_DENIED') console.log('   → API belum di-enable / key ke-restrict. Enable "Generative Language API".');
      return;
    }
    const flash = (d.models || [])
      .map((m: any) => m.name.replace('models/', ''))
      .filter((n: string) => n.includes('flash'))
      .slice(0, 6);
    console.log(`   ✅ Key VALID. Contoh model flash: ${flash.join(', ')}`);
  } catch (e) {
    console.log('   ❌ Error jaringan:', (e as Error).message);
    return;
  }

  // 2) generateContent — cek bisa generate (billing/kuota)
  console.log(`\n2) Cek generate (model ${model})...`);
  try {
    const r = await fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Balas satu kata: "OK"' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });
    const d: any = await r.json();
    if (d.error) {
      console.log(`   ❌ ${d.error.code} ${d.error.status} — ${d.error.message}`);
      if (d.error.status === 'RESOURCE_EXHAUSTED') console.log('   → Masalah BILLING/kuota. Aktifkan billing project di AI Studio/GCP.');
      if (d.error.status === 'NOT_FOUND') console.log('   → Model tak ada. Coba model lain (mis. gemini-2.5-flash).');
      return;
    }
    const txt = (d.candidates?.[0]?.content?.parts || []).map((p: any) => p.text).join('').trim();
    console.log(`   ✅ GENERATE JALAN! Jawaban model: "${txt}"`);
    console.log('\n🎉 Key + billing OK — siap dipakai bot (set AI_PROVIDER=gemini).');
  } catch (e) {
    console.log('   ❌ Error jaringan:', (e as Error).message);
  }
}

main().then(() => process.exit(0));
