/**
 * Tes Vertex AI (Gemini via service account) — berdiri sendiri.
 *
 * Prasyarat:
 *   - Enable "Vertex AI API" di GCP.
 *   - Buat service account + role "Vertex AI User", download JSON key.
 *   - .env: VERTEX_SA_KEY_FILE=./vertex-sa.json, VERTEX_LOCATION, VERTEX_MODEL,
 *           (opsional) VERTEX_PROJECT_ID.
 *
 * Jalankan:  bun run scripts/test-vertex.ts
 */
import { callVertex, vertexEnabled } from '../src/vertex';
import { config } from '../src/config';

if (!vertexEnabled) {
  console.log('❌ VERTEX_SA_KEY_FILE belum diisi di .env (path ke JSON service account).');
  process.exit(1);
}

console.log(
  `🔧 Project: ${config.vertex.project || '(ambil dari SA JSON)'} | Location: ${config.vertex.location} | Model: ${config.vertex.model}\n`,
);
console.log('Memanggil Vertex AI...');

callVertex('Kamu asisten koperasi yang ringkas.', [{ role: 'user', content: 'Balas satu kata: OK' }])
  .then((t) => {
    console.log(`✅ VERTEX JALAN! Jawaban model: "${t.trim()}"`);
    console.log('\n🎉 Credit $300 kepakai. Set AI_PROVIDER=vertex di .env → bot pakai Gemini via Vertex.');
    process.exit(0);
  })
  .catch((e: Error) => {
    console.log(`❌ Gagal: ${e.message}`);
    if (/403|PERMISSION/i.test(e.message))
      console.log('→ Enable "Vertex AI API" & beri role "Vertex AI User" ke service account.');
    if (/token exchange|ENOENT|JSON/i.test(e.message))
      console.log('→ Cek file service account JSON (path & isinya benar?).');
    if (/404|NOT_FOUND/i.test(e.message))
      console.log('→ Model/location tak cocok. Coba VERTEX_LOCATION=us-central1 & model gemini-2.0-flash.');
    process.exit(1);
  });
