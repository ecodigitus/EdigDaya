/**
 * OCR KTP via Google Cloud Vision — baca foto KTP saat pendaftaran, ekstrak
 * field (NIK, nama, jenis kelamin, alamat) supaya calon anggota tak perlu
 * mengetik manual.
 *
 * KEAMANAN (UU PDP — KTP = data pribadi sensitif):
 * - Foto KTP HANYA di-OCR sekali lalu dibuang; TIDAK disimpan & TIDAK di-log.
 * - NIK ditampilkan tersamar oleh pemanggil (bukan di modul ini).
 * - API key dari .env (config.gcp.visionApiKey), tak pernah di-hardcode.
 * - Fitur mati otomatis bila key kosong (fallback: pendaftaran manual).
 */
import { config, aiEnabled } from './config';
import { completeRaw } from './ai';
import { logger } from './logger';

/** True bila API key Vision tersedia. */
export const ktpEnabled = config.gcp.visionApiKey.length > 0;

const ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

export type KtpData = {
  nik?: string;
  nama?: string;
  tempatTglLahir?: string;
  jenisKelamin?: string;
  golDarah?: string;
  alamat?: string;
  rtRw?: string;
  kelDesa?: string;
  kecamatan?: string;
  agama?: string;
  statusPerkawinan?: string;
  pekerjaan?: string;
  kewarganegaraan?: string;
  berlakuHingga?: string;
};

/** OCR foto KTP → field. null bila fitur mati / gagal / tak terbaca (tak melempar). */
export async function extractKtp(image: Buffer): Promise<KtpData | null> {
  if (!ktpEnabled) return null;
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(config.gcp.visionApiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            image: { content: image.toString('base64') },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            imageContext: { languageHints: ['id'] },
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error({ status: res.status, detail: detail.slice(0, 300) }, 'Vision OCR gagal');
      return null;
    }
    const data = (await res.json()) as {
      responses?: { fullTextAnnotation?: { text?: string } }[];
    };
    const text = data.responses?.[0]?.fullTextAnnotation?.text ?? '';
    if (!text.trim()) {
      logger.info({ textLen: 0 }, 'KTP OCR: teks kosong');
      return null;
    }
    // Parser UTAMA: LLM (tahan layout 2-kolom KTP yang sering kebalik). Regex jadi
    // cadangan bila AI mati / gagal. Catatan PDP: teks OCR (termasuk NIK) dikirim
    // ke penyedia AI untuk diekstrak — sama alurnya dgn foto dikirim ke Vision.
    let parsed = await parseKtpLLM(text);
    let via = 'llm';
    if (!parsed || (!parsed.nik && !parsed.nama)) {
      parsed = parseKtp(text);
      via = 'regex';
    }
    logger.info(
      { via, textLen: text.length, hasNik: !!parsed.nik, hasNama: !!parsed.nama, hasJk: !!parsed.jenisKelamin },
      'KTP OCR hasil',
    );
    return parsed;
  } catch (err) {
    logger.error({ err }, 'Vision OCR error jaringan');
    return null;
  }
}

/**
 * Parse teks hasil OCR KTP (heuristik). KTP Indonesia punya label baku (NIK,
 * Nama, Jenis Kelamin, Alamat). OCR bisa berantakan → ambil yang paling andal.
 */
const KTP_LLM_SYSTEM = `Kamu ekstraktor data KTP Indonesia dari teks OCR yang mungkin BERANTAKAN (urutan kolom label & nilai bisa terpisah/terbalik).
Keluarkan HANYA satu JSON valid tanpa penjelasan/markdown, dengan SEMUA kunci ini:
{"nik":string|null,"nama":string|null,"tempatTglLahir":string|null,"jenisKelamin":"Laki-laki"|"Perempuan"|null,"golDarah":string|null,"alamat":string|null,"rtRw":string|null,"kelDesa":string|null,"kecamatan":string|null,"agama":string|null,"statusPerkawinan":string|null,"pekerjaan":string|null,"kewarganegaraan":string|null,"berlakuHingga":string|null}
Aturan:
- "nik": 16 digit angka (abaikan spasi). null bila tak lengkap.
- "nama": nama lengkap PEMEGANG KTP. JANGAN ambil nama wilayah seperti "PROVINSI DKI JAKARTA", "JAKARTA BARAT", "KABUPATEN ..." — itu BUKAN nama orang.
- "tempatTglLahir": mis. "JAKARTA, 18-02-1986".
- "jenisKelamin": "Laki-laki" atau "Perempuan".
- "alamat": nama jalan pada baris "Alamat". "rtRw": mis "007/008". "kelDesa","kecamatan": sesuai label.
- Field yang tak ada di teks → null. Jangan mengarang.
Jawab HANYA JSON.`;

const strOrU = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** Parser UTAMA berbasis LLM — tahan layout 2-kolom KTP. null bila AI mati/gagal. */
export async function parseKtpLLM(text: string): Promise<KtpData | null> {
  if (!aiEnabled) return null;
  try {
    const raw = await completeRaw(KTP_LLM_SYSTEM, text);
    const cleaned = raw.replace(/```json|```/gi, '').trim();
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s < 0 || e <= s) return null;
    const o = JSON.parse(cleaned.slice(s, e + 1)) as Record<string, unknown>;
    const nik = typeof o.nik === 'string' ? o.nik.replace(/\D/g, '') : '';
    const jkRaw = typeof o.jenisKelamin === 'string' ? o.jenisKelamin : '';
    const jenisKelamin = /perempuan/i.test(jkRaw) ? 'Perempuan' : /laki/i.test(jkRaw) ? 'Laki-laki' : undefined;
    return {
      nik: /^\d{16}$/.test(nik) ? nik : undefined,
      nama: strOrU(o.nama),
      tempatTglLahir: strOrU(o.tempatTglLahir),
      jenisKelamin,
      golDarah: strOrU(o.golDarah),
      alamat: strOrU(o.alamat),
      rtRw: strOrU(o.rtRw),
      kelDesa: strOrU(o.kelDesa),
      kecamatan: strOrU(o.kecamatan),
      agama: strOrU(o.agama),
      statusPerkawinan: strOrU(o.statusPerkawinan),
      pekerjaan: strOrU(o.pekerjaan),
      kewarganegaraan: strOrU(o.kewarganegaraan),
      berlakuHingga: strOrU(o.berlakuHingga),
    };
  } catch (err) {
    logger.warn({ err }, 'parseKtpLLM gagal, fallback regex');
    return null;
  }
}

/** Parse teks OCR KTP → field (heuristik & toleran noise). Cadangan bila LLM mati. */
export function parseKtp(text: string): KtpData {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const onlyDigits = (s: string) => (s.match(/\d/g) ?? []).join('');

  // NIK: toleran terhadap noise OCR (spasi/titik di antara digit).
  //  1) dari baris ber-label "NIK" → ambil digitnya (15–17 → normalkan 16)
  //  2) kalau gagal, cari rentetan angka terpanjang (15–17 digit) di seluruh teks
  let nik: string | undefined;
  const nikLine = lines.find((l) => /nik/i.test(l));
  if (nikLine) {
    const d = onlyDigits(nikLine);
    if (d.length >= 15 && d.length <= 17) nik = d.slice(0, 16);
  }
  if (!nik) {
    const runs = (text.match(/\d[\d\s.]{13,}\d/g) ?? [])
      .map((r) => r.replace(/\D/g, ''))
      .filter((r) => r.length >= 15 && r.length <= 17);
    if (runs.length) nik = runs.sort((a, b) => Math.abs(16 - a.length) - Math.abs(16 - b.length))[0]!.slice(0, 16);
  }
  if (!nik) nik = text.replace(/[^\d]/g, ' ').match(/\d{16}/)?.[0];

  // Nilai label "X : ..." — di baris yg sama SETELAH ':' atau di baris berikutnya.
  const afterLabel = (label: RegExp): string | undefined => {
    const idx = lines.findIndex((l) => label.test(l));
    if (idx < 0) return undefined;
    const parts = lines[idx]!.split(/[:：]/);
    let val = parts.length > 1 ? parts.slice(1).join(':').trim() : '';
    if (!val && idx + 1 < lines.length) val = lines[idx + 1]!.trim(); // nilai di baris bawahnya
    return val || undefined;
  };

  let jenisKelamin: string | undefined;
  if (/LAKI\s*-?\s*LAKI/i.test(text)) jenisKelamin = 'Laki-laki';
  else if (/PEREMPUAN/i.test(text)) jenisKelamin = 'Perempuan';

  return {
    nik,
    nama: afterLabel(/^nama\b/i),
    tempatTglLahir: afterLabel(/^tempat/i),
    jenisKelamin,
    golDarah: afterLabel(/gol/i),
    alamat: afterLabel(/^alamat\b/i),
    rtRw: afterLabel(/^rt/i),
    kelDesa: afterLabel(/^kel/i),
    kecamatan: afterLabel(/^kecamatan/i),
    agama: afterLabel(/^agama/i),
    statusPerkawinan: afterLabel(/^status/i),
    pekerjaan: afterLabel(/^pekerjaan/i),
    kewarganegaraan: afterLabel(/^kewarganegaraan/i),
    berlakuHingga: afterLabel(/^berlaku/i),
  };
}
