/**
 * e-RAT voting store (in-memory, MVP demo) — sejalan dengan bot (campaigns.ts).
 * Satu agenda aktif, tally + kuorum, satu suara per anggota. Produksi: pindah ke
 * DB + scheduler. State reset saat server restart (cukup untuk demo).
 */
type Option = { key: string; label: string };

const AGENDA =
  "Menyetujui pembagian SHU tahun buku 2025 dengan porsi 60% jasa simpanan : 40% jasa transaksi";
const OPTIONS: Option[] = [
  { key: "1", label: "Setuju" },
  { key: "2", label: "Tidak Setuju" },
  { key: "3", label: "Abstain" },
];
const ELIGIBLE = 52;
// Suara simulasi anggota lain — biar tally terasa nyata saat demo.
const tally: Record<string, number> = { "1": 24, "2": 6, "3": 4 };
const voted = new Map<string, string>(); // no_anggota -> pilihan key

export type EratState = ReturnType<typeof eratState>;

export function eratState(no: string) {
  const total = OPTIONS.reduce((s, o) => s + (tally[o.key] ?? 0), 0);
  const quorumNeeded = Math.ceil(ELIGIBLE * 0.5);
  const quorumOk = total >= quorumNeeded;
  let top: Option = OPTIONS[0]!;
  for (const o of OPTIONS) if ((tally[o.key] ?? 0) > (tally[top.key] ?? 0)) top = o;
  return {
    agenda: AGENDA,
    options: OPTIONS,
    hasil: OPTIONS.map((o) => {
      const suara = tally[o.key] ?? 0;
      return { key: o.key, label: o.label, suara, pct: total ? Math.round((suara / total) * 100) : 0 };
    }),
    total,
    eligible: ELIGIBLE,
    quorum_needed: quorumNeeded,
    quorum_ok: quorumOk,
    keputusan_sementara: quorumOk ? top.label : null,
    sudah_vote: voted.has(no),
    pilihan_saya: voted.get(no) ?? null,
  };
}

/** Catat suara. Return null bila sukses, atau kode error. */
export function castVote(no: string, key: string): "sudah" | "invalid" | null {
  if (voted.has(no)) return "sudah";
  if (!OPTIONS.some((o) => o.key === key)) return "invalid";
  tally[key] = (tally[key] ?? 0) + 1;
  voted.set(no, key);
  return null;
}
