/**
 * INTENT LAYER — pahami kalimat bebas (teks / voice note) lalu jalankan aksi yang
 * SAMA dengan menu manual. Contoh: "tolong aku mau setor simpanan sukarela 500rb"
 * → langsung ke konfirmasi setor sukarela Rp500.000.
 *
 * Cara kerja: LLM (provider aktif) mengklasifikasi pesan → JSON {aksi, jenis,
 * nominal} → dipetakan ke handler yang sudah ada. Kalau tak yakin (aksi "none")
 * → kembalikan null, biar router lanjut ke ngobrol AI biasa.
 *
 * KEAMANAN: aksi UANG (setor) hanya DISIAPKAN sampai layar konfirmasi — user
 * tetap wajib balas "sudah bayar". Tidak ada kredit/transfer otomatis (mitigasi
 * salah-dengar voice & OWASP: aksi sensitif butuh konfirmasi eksplisit).
 */
import { completeRaw } from './ai';
import { logger } from './logger';
import { matchMenu } from './menu';
import { pengumumanView } from './pengumuman';
import { startSetor, type JenisSimpanan } from './simpanan';
import type { Member } from './members';

type Intent = {
  aksi: string;
  jenis?: string;
  nominal?: number | null;
};

// aksi navigasi → nomor menu (ditangani matchMenu di menu.ts).
const NAV_MENU: Record<string, string> = {
  informasi: '1',
  simpanan: '2',
  shu: '3',
  pinjaman: '4',
  erat: '5',
  poin: '6',
  pengurus: '7',
  referral: '8',
};

const SYSTEM = `Kamu pengklasifikasi MAKSUD (intent) untuk chatbot koperasi WhatsApp berbahasa Indonesia.
Dari pesan anggota, keluarkan HANYA satu JSON valid tanpa penjelasan/markdown, bentuk:
{"aksi": string, "jenis": string|null, "nominal": number|null}

Nilai "aksi" yang boleh:
- "setor"      : ingin menyetor/menabung simpanan. Isi "jenis" salah satu "pokok"|"wajib"|"sukarela" (default "sukarela" bila tak jelas). Isi "nominal" dalam RUPIAH sebagai angka bulat: "500 rb"/"500ribu"->500000, "1 juta"->1000000, "50000"->50000. null bila tak disebут.
- "simpanan"   : ingin melihat saldo/simpanan
- "shu"        : ingin melihat estimasi SHU / bagi hasil
- "pinjaman"   : bertanya/melihat pinjaman/kredit
- "poin"       : melihat poin/misi/lencana
- "informasi"  : melihat data diri/profil/keanggotaan
- "erat"       : e-RAT / rapat / voting
- "pengurus"   : ingin menghubungi pengurus/admin/CS
- "referral"   : ingin mengajak teman / kode referral
- "pengumuman" : ingin melihat pengumuman/kabar koperasi
- "none"       : obrolan biasa, pertanyaan umum, atau di luar daftar di atas

Contoh:
"aku mau nabung sukarela 200rb" -> {"aksi":"setor","jenis":"sukarela","nominal":200000}
"bayar simpanan wajib dong" -> {"aksi":"setor","jenis":"wajib","nominal":null}
"saldoku berapa ya" -> {"aksi":"simpanan","jenis":null,"nominal":null}
"apa itu koperasi" -> {"aksi":"none","jenis":null,"nominal":null}
Jawab HANYA JSON.`;

/** Ambil objek JSON pertama dari teks (buang fence markdown bila ada). */
function parseJson(raw: string): Intent | null {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Intent;
  } catch {
    return null;
  }
}

function normJenis(j?: string): JenisSimpanan {
  const t = (j ?? '').toLowerCase();
  if (t.includes('pokok')) return 'pokok';
  if (t.includes('wajib')) return 'wajib';
  return 'sukarela';
}

/**
 * Deteksi maksud lalu jalankan aksinya. Kembalikan balasan string bila ada aksi
 * yang cocok, atau null (→ router lanjut ke ngobrol AI biasa). Tak pernah melempar.
 */
export async function handleIntent(jid: string, m: Member, text: string): Promise<string | null> {
  let intent: Intent | null = null;
  try {
    intent = parseJson(await completeRaw(SYSTEM, text));
  } catch (err) {
    logger.warn({ err }, 'Intent classify gagal');
    return null;
  }
  if (!intent || !intent.aksi || intent.aksi === 'none') return null;

  const aksi = intent.aksi.toLowerCase();
  logger.info({ aksi }, 'Intent terdeteksi');

  if (aksi === 'setor') {
    const nominal = typeof intent.nominal === 'number' && intent.nominal > 0 ? intent.nominal : undefined;
    return startSetor(jid, m, normJenis(intent.jenis), nominal);
  }
  if (aksi === 'pengumuman') return pengumumanView();
  if (NAV_MENU[aksi]) return matchMenu(NAV_MENU[aksi], m);

  return null;
}
