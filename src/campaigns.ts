/**
 * MESIN ENGAGEMENT (Campaign Engine) — fitur andalan.
 *
 * Membalik model chatbot: bukan cuma DITUNGGU (member chat duluan), tapi
 * MENGHAMPIRI (proaktif). Dua tipe campaign dalam satu engine:
 *   - 'nudge' : re-aktivasi anggota pasif — kirim ajakan 1-aksi, member tinggal balas.
 *   - 'vote'  : e-RAT / voting digital — kirim surat suara, tally real-time + kuorum.
 *
 * State in-memory (MVP). Produksi: pindah ke DB + scheduler (cron) untuk
 * pemicu otomatis berdasarkan skor keterlibatan.
 */
import { koperasi } from './business';
import { rupiah } from './format';
import { creditSimpanan } from './simpanan';
import type { Member } from './members';

type CampaignKind = 'nudge' | 'vote';
type Option = { key: string; label: string };

type Campaign = {
  id: string;
  kind: CampaignKind;
  title: string;
  options: Option[];
  tally: Record<string, number>;
  responded: Set<string>; // jid yang sudah membalas (anti dobel)
  eligible: number; // total anggota berhak (untuk kuorum)
  createdAt: number;
};

const campaigns = new Map<string, Campaign>();
const pending = new Map<string, string>(); // jid -> campaignId yang sedang menunggu balasan

const CANCEL = ['batal', 'keluar', 'menu', 'stop', 'cancel'];

/* ============================ VOTE / e-RAT ============================ */

const VOTE_ID = 'erat-2026';

function ensureVote(): Campaign {
  let c = campaigns.get(VOTE_ID);
  if (!c) {
    c = {
      id: VOTE_ID,
      kind: 'vote',
      title:
        'Menyetujui pembagian SHU tahun buku 2025 dengan porsi 60% jasa simpanan : 40% jasa transaksi',
      options: [
        { key: '1', label: 'Setuju' },
        { key: '2', label: 'Tidak Setuju' },
        { key: '3', label: 'Abstain' },
      ],
      // Suara simulasi anggota lain — biar tally terasa nyata saat demo.
      tally: { '1': 24, '2': 6, '3': 4 },
      responded: new Set(),
      eligible: 52,
      createdAt: Date.now(),
    };
    campaigns.set(VOTE_ID, c);
  }
  return c;
}

function ballotText(c: Campaign): string {
  const opts = c.options.map((o) => `${o.key})  ${o.label}`).join('\n');
  return (
    `🗳️ *e-RAT 2026 · Surat Suara Digital*\n\n` +
    `📋 Agenda:\n_${c.title}_\n\n` +
    `Beri suara dengan membalas *angka*:\n${opts}\n\n` +
    `_Cukup sekali, langsung dari chat ini. Ketik *batal* untuk keluar._`
  );
}

function bar(pct: number): string {
  const n = Math.max(0, Math.min(10, Math.round(pct / 10)));
  return '█'.repeat(n) + '░'.repeat(10 - n);
}

function resultText(c: Campaign): string {
  const total = Object.values(c.tally).reduce((a, b) => a + b, 0);
  const quorumNeeded = Math.ceil(c.eligible * 0.5);
  const quorumOk = total >= quorumNeeded;

  const lines = c.options
    .map((o) => {
      const n = c.tally[o.key] ?? 0;
      const pct = total ? Math.round((n / total) * 100) : 0;
      return `${o.label}\n   ${bar(pct)} ${pct}% (${n})`;
    })
    .join('\n');

  let top = c.options[0];
  for (const o of c.options) if ((c.tally[o.key] ?? 0) > (c.tally[top.key] ?? 0)) top = o;

  const decision = quorumOk
    ? `Keputusan sementara: *${top.label.toUpperCase()}* ✅`
    : `_Menunggu kuorum sebelum keputusan sah._`;

  return (
    `📊 *Hasil Sementara e-RAT 2026*\n` +
    `Suara masuk: *${total}/${c.eligible}*  ·  Kuorum: ${quorumOk ? '✅ tercapai' : '⏳ belum'} (butuh ${quorumNeeded})\n\n` +
    `${lines}\n\n${decision}`
  );
}

/** Mulai sesi voting untuk satu anggota. Return pesan surat suara (atau hasil bila sudah vote). */
export function startVoteFor(jid: string): string {
  const c = ensureVote();
  if (c.responded.has(jid)) {
    return `✅ Kamu sudah memberikan suara di e-RAT ini.\n\n${resultText(c)}`;
  }
  pending.set(jid, c.id);
  return ballotText(c);
}

function handleVoteReply(jid: string, t: string, c: Campaign): string {
  const opt = c.options.find((o) => o.key === t || o.label.toLowerCase() === t);
  if (!opt) {
    const opts = c.options.map((o) => `${o.key})  ${o.label}`).join('\n');
    return `Belum kebaca pilihannya 🙈. Balas *angka* ya:\n${opts}\n\n_(atau ketik *batal*)_`;
  }
  c.tally[opt.key] = (c.tally[opt.key] ?? 0) + 1;
  c.responded.add(jid);
  pending.delete(jid);
  return `✅ *Suaramu tercatat: ${opt.label}*\n\n${resultText(c)}`;
}

/* ============================== NUDGE ============================== */

/** Kirim nudge re-aktivasi ke satu anggota. Return pesan ajakan 1-aksi. */
export function startNudgeFor(jid: string, m: Member): string {
  const id = `nudge-${jid}`;
  campaigns.set(id, {
    id,
    kind: 'nudge',
    title: 'Re-aktivasi: simpanan wajib',
    options: [
      { key: 'YA', label: 'Bayar sekarang' },
      { key: 'NANTI', label: 'Nanti dulu' },
    ],
    tally: {},
    responded: new Set(),
    eligible: 1,
    createdAt: Date.now(),
  });
  pending.set(jid, id);
  return (
    `🔔 Halo *${m.nama}* 👋\n\n` +
    `Kami perhatikan *simpanan wajib bulan ini (${rupiah(koperasi.simpanan.wajib)})* belum tercatat. ` +
    `Yuk selesaikan sekarang biar keanggotaanmu tetap aktif & dapat *+50 poin* 🎯\n\n` +
    `Balas *YA* untuk bayar sekarang, atau *NANTI* untuk diingatkan lagi.`
  );
}

function handleNudgeReply(jid: string, t: string, c: Campaign, m: Member): string {
  const yes = ['ya', 'iya', 'ok', 'oke', 'okay', 'bayar', 'sip', 'y', 'yes', 'mau'];
  const no = ['nanti', 'tidak', 'ga', 'gak', 'engga', 'enggak', 'belum', 'no', 'n'];

  if (yes.some((w) => t === w)) {
    c.responded.add(jid);
    pending.delete(jid);
    const before = m.skorKeterlibatan;
    creditSimpanan(m, 'wajib', koperasi.simpanan.wajib); // beneran menambah saldo (bukan sekadar poin)
    m.poin += 50;
    m.skorKeterlibatan = Math.min(100, m.skorKeterlibatan + 7);
    return (
      `✅ Siap, *${m.nama}*! Pembayaran *simpanan wajib ${rupiah(koperasi.simpanan.wajib)}* tercatat 🎉\n\n` +
      `💰 Total simpanan wajib kamu kini: *${rupiah(m.simpananWajib)}*\n` +
      `⭐ +50 poin  (total ${m.poin.toLocaleString('id-ID')})\n` +
      `📊 Skor keterlibatan: ${before} → *${m.skorKeterlibatan}*/100\n\n` +
      `Makasih udah aktif! Ketik *poin* buat lihat progresmu. 🙌`
    );
  }
  if (no.some((w) => t === w)) {
    c.responded.add(jid);
    pending.delete(jid);
    return `Oke, gak masalah 🙏. Nanti kami ingatkan lagi ya, *${m.nama}*. Ketik *menu* kalau butuh yang lain.`;
  }
  return `Balas *YA* untuk bayar sekarang, atau *NANTI* untuk diingatkan lagi ya 🙂\n_(atau ketik *batal*)_`;
}

/* ============================ INTEGRASI ============================ */

/**
 * Kalau anggota ini sedang menunggu balasan campaign, proses di sini.
 * Return string balasan bila ditangani, atau null bila tidak ada campaign
 * yang menunggu (biar diteruskan ke menu/AI biasa).
 */
export function handleCampaignReply(jid: string, text: string, m: Member): string | null {
  const id = pending.get(jid);
  if (!id) return null;

  const c = campaigns.get(id);
  if (!c) {
    pending.delete(jid);
    return null;
  }

  const t = text.trim().toLowerCase();
  if (CANCEL.includes(t)) {
    pending.delete(jid);
    return null; // biar jatuh ke menu/AI biasa (mis. "menu")
  }

  return c.kind === 'vote' ? handleVoteReply(jid, t, c) : handleNudgeReply(jid, t, c, m);
}

/** Kata kunci untuk MEMULAI campaign dari sisi anggota (demo satu HP). */
export function matchTrigger(jid: string, text: string, m: Member): string | null {
  const t = text.trim().toLowerCase();
  if (['voting', 'vote', 'mulai voting', 'beri suara', 'suara', 'pilih'].includes(t)) {
    return startVoteFor(jid);
  }
  if (['nudge', 'demo nudge', 'ingatkan', 'ingatkan saya', 'reminder'].includes(t)) {
    return startNudgeFor(jid, m);
  }
  return null;
}
