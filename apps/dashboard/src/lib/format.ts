/** Indonesian formatting helpers. */

const EMPTY = "—";

export function rupiah(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return EMPTY;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Compact currency for KPI tiles: Rp 1,2 jt / Rp 3,4 M / Rp 5 T. */
export function rupiahShort(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return EMPTY;
  const abs = Math.abs(n);
  const f = (v: number, s: string) =>
    `Rp ${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })} ${s}`;
  if (abs >= 1e12) return f(n / 1e12, "T");
  if (abs >= 1e9) return f(n / 1e9, "M");
  if (abs >= 1e6) return f(n / 1e6, "jt");
  if (abs >= 1e3) return f(n / 1e3, "rb");
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function angka(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return EMPTY;
  return new Intl.NumberFormat("id-ID").format(n);
}

export function persen(n?: number | null, digits = 1): string {
  if (n == null || Number.isNaN(n)) return EMPTY;
  return `${n.toFixed(digits)}%`;
}

export function tanggal(s?: string | null): string {
  if (!s) return EMPTY;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return EMPTY;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function tanggalWaktu(s?: string | null): string {
  if (!s) return EMPTY;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return EMPTY;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** "YYYY-MM" -> "Mmm YYYY" (id). */
export function bulanLabel(ym?: string | null): string {
  if (!ym) return EMPTY;
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
