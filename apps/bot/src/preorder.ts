/**
 * Sistem PRE-ORDER (PO) — multi-aktor: User ↔ Admin ↔ Produsen.
 *
 * Urutan logika:
 *   1. Input     — user isi detail (produk, jumlah, catatan, tanggal butuh)
 *   2. Validasi  — admin bridge ke produsen, input HARGA + DURASI (wajib)
 *   3. Konfirmasi— user putuskan: bayar DP 50% (setuju) / batal
 *   4. Eksekusi  — admin finalize pesanan
 *
 * Poin 1 (harga): ada DB harga standar (produk dikenal → harga auto/saran);
 *                 produk custom → admin input harga. DP = 50% (auto-hitung).
 * Poin 2 (produsen nolak): daftar produsen cadangan; admin bisa `po alih`.
 * Poin 3 (durasi): durasi WAJIB diisi admin sebelum penawaran dikirim ke user.
 *
 * Catatan: DP & pembayaran bersifat DUMMY (demo, tanpa transaksi nyata).
 * Command admin dibatasi ke ADMIN_NUMBERS (akses terbatas / OWASP A01) —
 * pengecekan dilakukan di whatsapp.ts sebelum memanggil handleAdminPo().
 * Notifikasi proaktif dikirim via "outbox" yang dikuras whatsapp.ts.
 */
import { config } from './config';
import { rupiah } from './format';
import { dbEnabled, fetchAll, upsert } from './db';

type POStatus = 'MENUNGGU_ADMIN' | 'DIQUOTE' | 'DP_DIBAYAR' | 'FINAL' | 'BATAL';

type PreOrder = {
  id: string;
  userJid: string;
  userName: string;
  produk: string;
  jumlah: string;
  qtyNum: number | null;
  catatan: string;
  tanggalButuh: string;
  status: POStatus;
  hargaSaran?: number; // dari DB harga standar (produk dikenal)
  harga?: number; // harga total final (disepakati)
  dp?: number; // 50% dari harga
  durasiHari?: number;
  produsen: string;
  produsenKandidat: string[];
  produsenIdx: number;
};

type PoDraft = {
  step: 'produk' | 'jumlah' | 'catatan' | 'tanggal' | 'confirm';
  userName: string;
  produk?: string;
  jumlah?: string;
  qtyNum?: number | null;
  catatan?: string;
  tanggalButuh?: string;
};

const STATUS_LABEL: Record<POStatus, string> = {
  MENUNGGU_ADMIN: '⏳ Menunggu admin cek harga & durasi ke produsen',
  DIQUOTE: '📦 Penawaran siap — menunggu keputusanmu',
  DP_DIBAYAR: '💰 DP terbayar — menunggu finalisasi admin',
  FINAL: '✅ Difinalisasi — sedang diproduksi',
  BATAL: '❌ Dibatalkan',
};

// --- DB harga standar dummy (Poin 1). Produk di luar ini = custom (admin input harga). ---
const HARGA_STANDAR: Record<string, { unit: number; satuan: string }> = {
  beras: { unit: 13_000, satuan: 'kg' },
  gula: { unit: 16_000, satuan: 'kg' },
  minyak: { unit: 17_000, satuan: 'liter' },
  telur: { unit: 28_000, satuan: 'kg' },
  gas: { unit: 22_000, satuan: 'tabung' },
  pupuk: { unit: 120_000, satuan: 'sak' },
};

// --- Daftar produsen dummy + cadangan (Poin 2). ---
const PRODUSEN: { nama: string; produk: string[] }[] = [
  { nama: 'Kelompok Tani Sukamaju', produk: ['beras', 'sayur', 'cabe'] },
  { nama: 'Kelompok Tani Harapan Jaya', produk: ['beras', 'cabe', 'sayur'] },
  { nama: 'Peternak Telur Cibinong', produk: ['telur', 'ayam'] },
  { nama: 'Gudang Sembako Merah Putih', produk: ['gula', 'minyak', 'beras', 'gas', 'pupuk'] },
];

const pos = new Map<string, PreOrder>();
const drafts = new Map<string, PoDraft>();
const outbox: { jid: string; text: string }[] = [];
let counter = 0;

// ---------------- OUTBOX (notifikasi proaktif) ----------------

function notify(jid: string, text: string): void {
  outbox.push({ jid, text });
}

/** Ambil & kosongkan antrean notifikasi (dipanggil whatsapp.ts untuk dikirim). */
export function drainOutbox(): { jid: string; text: string }[] {
  const items = outbox.splice(0, outbox.length);
  return items;
}

function notifyAdmins(text: string): void {
  for (const num of config.admin.numbers) notify(`${num}@s.whatsapp.net`, text);
}

// ---------------- FORM PEMBUATAN PO (sisi user) ----------------

export function inPoForm(jid: string): boolean {
  return drafts.has(jid);
}

export function cancelPoForm(jid: string): void {
  drafts.delete(jid);
}

/** Mulai form PO. */
export function startPoForm(jid: string, userName: string): string {
  drafts.set(jid, { step: 'produk', userName });
  return (
    `📦 *Buat Pre-Order (PO)*\n` +
    `Isi detail pesananmu ya. Ketik *batal* kapan saja untuk berhenti.\n\n` +
    `*1/4* — Mau pesan *produk apa*? _(mis. "beras", "cabe buat party")_`
  );
}

/** Proses input form PO sesuai langkahnya. */
export function handlePoForm(jid: string, text: string): string {
  const d = drafts.get(jid);
  if (!d) return startPoForm(jid, 'Anggota');

  const raw = text.trim();
  const low = raw.toLowerCase();
  if (low === 'batal' || low === 'keluar') {
    drafts.delete(jid);
    return '❌ Pembuatan PO dibatalkan. Ketik *menu* untuk kembali ya.';
  }

  switch (d.step) {
    case 'produk': {
      if (raw.length < 2 || raw.length > 80) return '⚠️ Nama produk belum valid. Ketik nama produknya (2–80 karakter).';
      d.produk = raw;
      d.step = 'jumlah';
      return `*2/4* — *Berapa jumlahnya?* _(mis. "50 kg", "100", "20 tabung")_`;
    }
    case 'jumlah': {
      if (raw.length < 1 || raw.length > 40) return '⚠️ Jumlah belum valid. Ketik jumlahnya, mis. *50 kg*.';
      d.jumlah = raw;
      const n = Number(raw.replace(/[^\d]/g, ''));
      d.qtyNum = Number.isFinite(n) && n > 0 ? n : null;
      d.step = 'catatan';
      return `*3/4* — Ada *catatan*? _(mis. "cabe merah keriting, buat acara")_. Ketik *-* kalau nggak ada.`;
    }
    case 'catatan': {
      d.catatan = raw === '-' ? '' : raw.slice(0, 200);
      d.step = 'tanggal';
      return `*4/4* — *Kapan* kamu butuh barangnya? _(mis. "2 minggu lagi", "20 Agustus")_`;
    }
    case 'tanggal': {
      d.tanggalButuh = raw.slice(0, 60);
      d.step = 'confirm';
      return poDraftSummary(d);
    }
    case 'confirm': {
      if (['ulang', 'ubah', 'edit'].includes(low)) {
        drafts.set(jid, { step: 'produk', userName: d.userName });
        return `Oke, kita isi ulang ya.\n\n*1/4* — Mau pesan *produk apa*?`;
      }
      if (!['kirim', 'ya', 'ok', 'oke', 'submit', 'lanjut'].includes(low)) {
        return `Ketik *kirim* untuk kirim PO ke admin, *ulang* untuk isi lagi, atau *batal*.`;
      }
      return createPo(jid, d);
    }
  }
}

function poDraftSummary(d: PoDraft): string {
  const std = d.produk ? lookupHarga(d.produk) : null;
  const saran =
    std && d.qtyNum ? `\n_Perkiraan harga standar: ${rupiah(std.unit * d.qtyNum)} (dikonfirmasi admin)_` : '';
  return (
    `📝 *Cek PO kamu:*\n\n` +
    `• Produk: ${d.produk}\n` +
    `• Jumlah: ${d.jumlah}\n` +
    `• Catatan: ${d.catatan || '-'}\n` +
    `• Butuh: ${d.tanggalButuh}${saran}\n\n` +
    `Kirim ke admin untuk dicek harga & durasinya? Ketik *kirim*, *ulang*, atau *batal*.`
  );
}

function createPo(jid: string, d: PoDraft): string {
  counter += 1;
  const id = `PO-${String(counter).padStart(3, '0')}`;
  const std = lookupHarga(d.produk ?? '');
  const hargaSaran = std && d.qtyNum ? std.unit * d.qtyNum : undefined;
  const kandidat = findProducers(d.produk ?? '');

  const po: PreOrder = {
    id,
    userJid: jid,
    userName: d.userName,
    produk: d.produk ?? '',
    jumlah: d.jumlah ?? '',
    qtyNum: d.qtyNum ?? null,
    catatan: d.catatan ?? '',
    tanggalButuh: d.tanggalButuh ?? '',
    status: 'MENUNGGU_ADMIN',
    hargaSaran,
    produsen: kandidat[0] ?? 'Belum ditentukan',
    produsenKandidat: kandidat,
    produsenIdx: 0,
  };
  pos.set(id, po);
  persistPo(po); // write-through PO baru
  drafts.delete(jid);

  // Notifikasi ke admin (Input → admin bridge ke produsen)
  notifyAdmins(
    `🆕 *PO baru: ${id}*\n` +
      `Dari: ${po.userName}\n` +
      `Produk: ${po.produk} — ${po.jumlah}\n` +
      `Catatan: ${po.catatan || '-'}\n` +
      `Butuh: ${po.tanggalButuh}\n` +
      (hargaSaran ? `Harga standar: ${rupiah(hargaSaran)} _(bisa pakai "auto")_\n` : `Produk *custom* — harga dari produsen.\n`) +
      `Produsen kandidat: ${kandidat.join(', ')}\n\n` +
      `Quote: *po quote ${id} <harga|auto> <durasi_hari> [produsen]*`,
  );

  const adaAdmin = config.admin.numbers.length > 0;
  return (
    `✅ *${id} berhasil dibuat!*\n\n` +
    `Detailmu diteruskan ke admin untuk dicek harga & durasi ke produsen. ` +
    `Nanti kamu dapat *penawaran* (harga + DP 50% + estimasi selesai) di sini.\n\n` +
    (adaAdmin ? '' : '_(Catatan demo: belum ada nomor admin di ADMIN_NUMBERS.)_\n') +
    `Ketik *po saya* untuk cek status pesananmu. 🙌`
  );
}

// ---------------- KONFIRMASI (sisi user) ----------------

/** Tangani balasan user atas penawaran (setuju bayar DP / batal). Null bila tak relevan. */
export function handlePoUserReply(jid: string, text: string): string | null {
  const pending = [...pos.values()].filter((p) => p.userJid === jid && p.status === 'DIQUOTE');
  if (pending.length === 0) return null;

  const t = text.trim().toLowerCase();
  const yes = /^(setuju|ya|iya|lanjut|bayar|terima|ok|oke)\b/.test(t);
  const no = /^(batal|tolak|gak|ga|tidak|nggak|engga)\b/.test(t);
  if (!yes && !no) return null;

  const targeted = matchId(text);
  const po = (targeted && pending.find((p) => p.id === targeted)) || pending[pending.length - 1]!;

  if (no) {
    po.status = 'BATAL';
    persistPo(po);
    notifyAdmins(`❌ *${po.id}* dibatalkan oleh ${po.userName}.`);
    return `Oke, *${po.id}* dibatalkan. Makasih ya, boleh pesan lagi kapan aja. 🙏`;
  }

  po.status = 'DP_DIBAYAR';
  persistPo(po);
  notifyAdmins(
    `💰 *${po.id}* disetujui ${po.userName}. DP ${rupiah(po.dp ?? 0)} *terbayar (demo)*.\n` +
      `Finalisasi: *po final ${po.id}*`,
  );
  return (
    `🎉 *DP terbayar (demo)!*\n\n` +
    `Pesanan *${po.id}* (${po.produk} — ${po.jumlah}) diproses.\n` +
    `DP 50%: *${rupiah(po.dp ?? 0)}* · Sisa saat barang siap: *${rupiah((po.harga ?? 0) - (po.dp ?? 0))}*.\n\n` +
    `Tunggu finalisasi dari admin ya. Ketik *po saya* untuk cek status. 🙌`
  );
}

/** Daftar PO milik user (status). */
export function listUserPo(jid: string): string {
  const mine = [...pos.values()].filter((p) => p.userJid === jid);
  if (mine.length === 0) return `Kamu belum punya PO. Ketik *8* atau *pre-order* untuk bikin pesanan. 📦`;
  const lines = mine.map((p) => {
    const harga = p.harga ? ` · ${rupiah(p.harga)} (DP ${rupiah(p.dp ?? 0)})` : '';
    return `• *${p.id}* — ${p.produk} (${p.jumlah})\n  ${STATUS_LABEL[p.status]}${harga}`;
  });
  return `📦 *Pesanan PO kamu:*\n\n${lines.join('\n\n')}`;
}

// ---------------- COMMAND ADMIN ----------------

/** Router command admin PO. Return balasan untuk admin, atau null jika bukan command PO. */
export function handleAdminPo(raw: string): string | null {
  const parts = raw.trim().split(/\s+/);
  if ((parts[0] ?? '').toLowerCase() !== 'po') return null;
  const action = (parts[1] ?? '').toLowerCase();

  switch (action) {
    case '':
    case 'list':
      return adminList();
    case 'lihat':
      return adminView(parts[2] ?? '');
    case 'quote':
      return adminQuote(parts[2] ?? '', parts[3] ?? '', parts[4] ?? '', parts.slice(5).join(' '));
    case 'alih':
      return adminAlih(parts[2] ?? '', parts.slice(3).join(' '));
    case 'final':
      return adminFinal(parts[2] ?? '');
    case 'batal':
      return adminBatal(parts[2] ?? '');
    default:
      return adminHelp();
  }
}

function adminHelp(): string {
  return (
    `🛠️ *Command PO admin:*\n` +
    `• *po list* — daftar semua PO\n` +
    `• *po lihat <id>* — detail PO\n` +
    `• *po quote <id> <harga|auto> <durasi_hari> [produsen]* — kirim penawaran\n` +
    `• *po alih <id> [produsen]* — alihkan ke produsen cadangan\n` +
    `• *po final <id>* — finalisasi (setelah DP dibayar)\n` +
    `• *po batal <id>* — batalkan PO`
  );
}

function adminList(): string {
  if (pos.size === 0) return 'Belum ada PO masuk.';
  const lines = [...pos.values()].map((p) => `• *${p.id}* ${p.produk} (${p.jumlah}) — ${p.status} — ${p.userName}`);
  return `📋 *Daftar PO:*\n${lines.join('\n')}`;
}

function adminView(idRaw: string): string {
  const po = getPo(idRaw);
  if (!po) return `PO tidak ditemukan. Ketik *po list*.`;
  return (
    `📦 *${po.id}* — ${po.status}\n\n` +
    `User: ${po.userName}\n` +
    `Produk: ${po.produk} — ${po.jumlah}\n` +
    `Catatan: ${po.catatan || '-'}\n` +
    `Butuh: ${po.tanggalButuh}\n` +
    (po.hargaSaran ? `Harga standar (saran): ${rupiah(po.hargaSaran)}\n` : `Produk custom — harga dari produsen.\n`) +
    `Produsen: ${po.produsen}\n` +
    `Kandidat produsen: ${po.produsenKandidat.join(', ')}\n` +
    (po.harga ? `Harga disepakati: ${rupiah(po.harga)} · DP ${rupiah(po.dp ?? 0)} · Durasi ${po.durasiHari} hari\n` : '') +
    `\nQuote: *po quote ${po.id} <harga|auto> <durasi_hari> [produsen]*`
  );
}

function adminQuote(idRaw: string, hargaRaw: string, durasiRaw: string, produsen: string): string {
  const po = getPo(idRaw);
  if (!po) return `PO tidak ditemukan. Ketik *po list*.`;
  if (po.status === 'FINAL' || po.status === 'BATAL') return `PO ${po.id} sudah ${po.status}, tak bisa di-quote.`;

  // Harga: "auto" pakai DB standar (produk dikenal), atau angka manual (Poin 1).
  let harga: number;
  if (hargaRaw.toLowerCase() === 'auto') {
    if (!po.hargaSaran) return `Produk custom, tak ada harga standar. Isi manual: *po quote ${po.id} <harga> <durasi>*`;
    harga = po.hargaSaran;
  } else {
    harga = Number(hargaRaw.replace(/[^\d]/g, ''));
  }
  if (!Number.isFinite(harga) || harga <= 0) return `Harga tidak valid. Contoh: *po quote ${po.id} 150000 3*`;

  // Durasi WAJIB (Poin 3).
  const durasi = Number(durasiRaw.replace(/[^\d]/g, ''));
  if (!Number.isFinite(durasi) || durasi <= 0) return `⚠️ Durasi (hari) WAJIB diisi. Contoh: *po quote ${po.id} ${hargaRaw} 3*`;

  po.harga = harga;
  po.dp = Math.round(harga / 2);
  po.durasiHari = durasi;
  if (produsen.trim()) po.produsen = produsen.trim();
  po.status = 'DIQUOTE';
  persistPo(po);

  // Notifikasi penawaran ke user (Validasi → Konfirmasi)
  notify(
    po.userJid,
    `📦 *Penawaran untuk ${po.id}*\n\n` +
      `Produk: ${po.produk} — ${po.jumlah}\n` +
      `Produsen: ${po.produsen}\n` +
      `💰 Harga total: *${rupiah(harga)}*\n` +
      `💵 DP 50%: *${rupiah(po.dp)}*\n` +
      `⏱️ Estimasi selesai: *${durasi} hari* (± ${estimasi(durasi)})\n\n` +
      `Lanjut? Ketik *setuju* untuk bayar DP, atau *batal*. _(balas *setuju ${po.id}* bila punya >1 PO)_`,
  );
  return `✅ ${po.id} di-quote (${rupiah(harga)}, DP ${rupiah(po.dp)}, ${durasi} hari, ${po.produsen}) & dikirim ke user.`;
}

function adminAlih(idRaw: string, produsen: string): string {
  const po = getPo(idRaw);
  if (!po) return `PO tidak ditemukan.`;
  if (produsen.trim()) {
    po.produsen = produsen.trim();
    persistPo(po);
    return `🔄 Produsen ${po.id} dialihkan ke *${po.produsen}*.`;
  }
  // Tanpa argumen: pindah ke kandidat cadangan berikutnya (Poin 2).
  if (po.produsenKandidat.length <= 1) return `Tak ada produsen cadangan untuk ${po.id}. Isi manual: *po alih ${po.id} <produsen>*`;
  po.produsenIdx = (po.produsenIdx + 1) % po.produsenKandidat.length;
  po.produsen = po.produsenKandidat[po.produsenIdx]!;
  persistPo(po);
  return `🔄 Produsen ${po.id} dialihkan ke cadangan: *${po.produsen}*. (quote ulang bila perlu)`;
}

function adminFinal(idRaw: string): string {
  const po = getPo(idRaw);
  if (!po) return `PO tidak ditemukan.`;
  if (po.status !== 'DP_DIBAYAR') return `⚠️ ${po.id} belum bisa difinalisasi (status: ${po.status}). Finalisasi setelah DP dibayar.`;
  po.status = 'FINAL';
  persistPo(po);
  notify(
    po.userJid,
    `✅ *${po.id} difinalisasi!*\n\n` +
      `Pesananmu (${po.produk} — ${po.jumlah}) resmi diproduksi oleh ${po.produsen}.\n` +
      `⏱️ Estimasi selesai: *${estimasi(po.durasiHari ?? 0)}*.\n` +
      `Sisa pembayaran ${rupiah((po.harga ?? 0) - (po.dp ?? 0))} saat barang siap. Makasih! 🙏`,
  );
  return `✅ ${po.id} difinalisasi. User sudah diberi tahu.`;
}

function adminBatal(idRaw: string): string {
  const po = getPo(idRaw);
  if (!po) return `PO tidak ditemukan.`;
  po.status = 'BATAL';
  persistPo(po);
  notify(po.userJid, `❌ Maaf, *${po.id}* (${po.produk}) dibatalkan oleh admin. Hubungi *pengurus* untuk info lebih lanjut.`);
  return `✅ ${po.id} dibatalkan. User sudah diberi tahu.`;
}

// ---------------- helper ----------------

function lookupHarga(produk: string): { key: string; unit: number; satuan: string } | null {
  const p = produk.toLowerCase();
  for (const key of Object.keys(HARGA_STANDAR)) {
    if (p.includes(key)) return { key, ...HARGA_STANDAR[key]! };
  }
  return null;
}

function findProducers(produk: string): string[] {
  const p = produk.toLowerCase();
  const matched = PRODUSEN.filter((x) => x.produk.some((tag) => p.includes(tag)));
  return (matched.length ? matched : PRODUSEN).map((x) => x.nama);
}

function getPo(idRaw: string): PreOrder | undefined {
  const id = normId(idRaw);
  return id ? pos.get(id) : undefined;
}

function normId(raw: string): string {
  const m = String(raw).match(/\d+/);
  return m ? `PO-${m[0].padStart(3, '0')}` : '';
}

function matchId(text: string): string {
  const m = text.toUpperCase().match(/PO-?\s*(\d+)/);
  return m ? `PO-${m[1]!.padStart(3, '0')}` : '';
}

function estimasi(durasiHari: number): string {
  const d = new Date();
  d.setDate(d.getDate() + durasiHari);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ---------------- Supabase: hydrate (seed) + write-through ----------------

/** DB row (snake_case) -> PreOrder. */
function rowToPo(r: Record<string, any>): PreOrder {
  return {
    id: r.id,
    userJid: r.user_jid ?? '',
    userName: r.user_name ?? 'Anggota',
    produk: r.produk ?? '',
    jumlah: r.jumlah ?? '',
    qtyNum: r.qty_num ?? null,
    catatan: r.catatan ?? '',
    tanggalButuh: r.tanggal_butuh ?? '',
    status: r.status,
    hargaSaran: r.harga_saran ?? undefined,
    harga: r.harga ?? undefined,
    dp: r.dp ?? undefined,
    durasiHari: r.durasi_hari ?? undefined,
    produsen: r.produsen ?? 'Belum ditentukan',
    produsenKandidat: Array.isArray(r.produsen_kandidat) ? r.produsen_kandidat : [],
    produsenIdx: r.produsen_idx ?? 0,
  };
}

/** PreOrder -> DB row. */
function poToRow(po: PreOrder): Record<string, unknown> {
  return {
    id: po.id,
    user_jid: po.userJid,
    user_name: po.userName,
    produk: po.produk,
    jumlah: po.jumlah,
    qty_num: po.qtyNum,
    catatan: po.catatan,
    tanggal_butuh: po.tanggalButuh,
    status: po.status,
    harga_saran: po.hargaSaran ?? null,
    harga: po.harga ?? null,
    dp: po.dp ?? null,
    durasi_hari: po.durasiHari ?? null,
    produsen: po.produsen,
    produsen_kandidat: po.produsenKandidat,
    produsen_idx: po.produsenIdx,
  };
}

/** Muat PO dari Supabase ke `pos` (dipanggil sekali saat start). */
export async function hydratePreOrders(): Promise<number> {
  if (!dbEnabled) return 0;
  const rows = await fetchAll('pre_orders');
  for (const r of rows) {
    const po = rowToPo(r);
    pos.set(po.id, po);
    const n = Number(po.id.replace(/\D/g, '')); // majukan counter agar id baru tak bentrok
    if (Number.isFinite(n) && n > counter) counter = n;
  }
  return rows.length;
}

/** Write-through satu PO ke Supabase (fire-and-forget; no-op bila DB nonaktif). */
function persistPo(po: PreOrder): void {
  if (!dbEnabled) return;
  upsert('pre_orders', poToRow(po), 'id');
}
