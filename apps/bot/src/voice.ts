/**
 * VOICE NOTE → TEKS via Google Cloud Speech-to-Text (REST).
 *
 * Tujuan (inklusi digital desa): anggota yang malas/susah mengetik bisa kirim
 * PESAN SUARA — bot transkrip ke teks lalu diproses seperti pesan biasa.
 *
 * WhatsApp voice note (PTT) = OGG/Opus; GCP STT mendukung OGG_OPUS langsung
 * (tak perlu konversi). Sample rate dibaca dari header Ogg (tak perlu di-set).
 *
 * KEAMANAN (OWASP/UU PDP):
 * - API key HANYA dari .env (config.gcp), tak pernah di-hardcode.
 * - Audio dikirim ke GCP untuk transkrip lalu dibuang (tak disimpan/di-log).
 * - Fitur mati otomatis bila API key kosong (fallback aman, bot tetap jalan).
 */
import { config } from './config';
import { logger } from './logger';

/** True bila API key STT tersedia. Kalau false → transkripsi no-op. */
export const sttEnabled = config.gcp.sttApiKey.length > 0;

const ENDPOINT = 'https://speech.googleapis.com/v1/speech:recognize';

const SUPPORTED_RATES = [8000, 12000, 16000, 24000, 48000];

// Kosakata domain koperasi — di-"boost" agar STT tak salah dengar perintah
// (mis. "setor" jangan jadi "stop"). Dipakai sbg speechContexts.
const SPEECH_PHRASES = [
  'menu', 'mulai', 'informasi saya', 'simpanan', 'setor', 'setor simpanan', 'nabung',
  'estimasi SHU', 'SHU', 'pinjaman', 'e-RAT', 'voting', 'poin', 'misi', 'pengurus',
  'ajak teman', 'referral', 'pre-order', 'pesan barang', 'dashboard usaha', 'keuangan',
  'ngobrol', 'pengumuman', 'laporan', 'anggota jaga anggota', 'lapor', 'koperasi global',
  'aktivasi', 'periksa aktivasi', 'daftar', 'ya', 'batal', 'keluar', 'kirim', 'setuju',
];

/**
 * Baca sample rate asli dari header "OpusHead" di dalam OGG (little-endian,
 * offset +12). WhatsApp PTT biasanya 16000/48000. GCP wajib sampleRateHertz
 * eksplisit untuk OGG_OPUS. Fallback 48000 (rate native Opus) bila tak terbaca.
 */
function opusSampleRate(buf: Buffer): number {
  const idx = buf.indexOf('OpusHead');
  if (idx >= 0 && idx + 16 <= buf.length) {
    const rate = buf.readUInt32LE(idx + 12);
    if (SUPPORTED_RATES.includes(rate)) return rate;
  }
  return 48000;
}

/**
 * Transkrip audio OGG/Opus (buffer) ke teks Bahasa Indonesia. Kembalikan teks,
 * atau null bila fitur nonaktif / gagal / tak terdengar (tak melempar).
 */
export async function transcribeOggOpus(audio: Buffer): Promise<string | null> {
  if (!sttEnabled) return null;

  const body = {
    config: {
      encoding: 'OGG_OPUS',
      sampleRateHertz: opusSampleRate(audio),
      languageCode: config.gcp.sttLang,
      enableAutomaticPunctuation: true,
      model: 'latest_short', // dioptimalkan untuk ucapan pendek / perintah
      speechContexts: [{ phrases: SPEECH_PHRASES, boost: 18 }],
    },
    audio: { content: audio.toString('base64') },
  };

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(config.gcp.sttApiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error({ status: res.status, detail: detail.slice(0, 300) }, 'GCP STT gagal');
      return null;
    }
    const data = (await res.json()) as {
      results?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
    };
    const transcript = (data.results ?? [])
      .map((r) => r.alternatives?.[0]?.transcript ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/[.,!?;:]+$/g, '') // buang tanda baca akhir → cocok dgn kata kunci menu
      .trim();
    return transcript || null;
  } catch (err) {
    logger.error({ err }, 'GCP STT error jaringan');
    return null;
  }
}
