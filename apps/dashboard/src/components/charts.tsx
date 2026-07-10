/**
 * Lightweight hand-built chart primitives (no chart lib), following the
 * dataviz guidance: thin marks, rounded data-ends, recessive tracks, direct
 * labels, hover tooltips, legend for multi-series. Series colors come from a
 * validated categorical palette (teal/blue/amber/violet, CVD ΔE ≫ 12).
 */
import type { ReactNode } from "react";

export const CHART_COLORS = ["#0d9488", "#2563eb", "#d97706", "#7c3aed"] as const;

/** Horizontal magnitude bars with direct value labels (single hue by default). */
export function BarList({
  items,
  format = (v) => v.toLocaleString("id-ID"),
}: {
  items: { label: string; value: number; color?: string }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.label + i}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-ink">{it.label}</span>
            <span className="text-muted tabular-nums">{format(it.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${(it.value / max) * 100}%`,
                backgroundColor: it.color ?? CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Vertical bars over time with a CSS hover tooltip. Single series. */
export function Columns({
  data,
  format = (v) => v.toLocaleString("id-ID"),
  color = CHART_COLORS[0],
  height = 176,
}: {
  data: { label: string; value: number; hint?: string }[];
  format?: (v: number) => string;
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 border-b border-line" style={{ height }}>
      {data.map((d, i) => (
        <div
          key={d.label + i}
          className="group relative flex-1 flex flex-col items-center justify-end h-full min-w-[16px]"
        >
          <div className="pointer-events-none absolute bottom-full mb-1 hidden group-hover:block whitespace-nowrap rounded-md bg-ink text-white text-xs px-2 py-1 shadow-lg z-10">
            <div className="font-semibold">{d.hint ?? d.label}</div>
            <div className="tabular-nums">{format(d.value)}</div>
          </div>
          <div
            className="w-full max-w-10 rounded-t-md transition-[height] duration-500"
            style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: color }}
          />
          <span className="mt-1 text-[11px] text-muted truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Two-part collection meter (e.g. paid vs unpaid) with legend. */
export function Meter({
  value,
  total,
  valueLabel = "Tercapai",
  restLabel = "Sisa",
  format = (v) => v.toLocaleString("id-ID"),
  color = CHART_COLORS[0],
  restColor = "#d97706",
}: {
  value: number;
  total: number;
  valueLabel?: string;
  restLabel?: string;
  format?: (v: number) => string;
  color?: string;
  restColor?: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const rest = Math.max(0, total - value);
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm text-muted">{valueLabel}</span>
        <span className="text-lg font-bold tabular-nums text-ink">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: `${restColor}33` }}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5 text-xs">
        <LegendDot color={color} label={`${valueLabel}: ${format(value)}`} />
        <LegendDot color={restColor} label={`${restLabel}: ${format(rest)}`} />
      </div>
    </div>
  );
}

/** Donut for 2–4 part composition, with a center total and legend. */
export function Donut({
  segments,
  centerLabel,
  centerValue,
  format = (v) => v.toLocaleString("id-ID"),
  size = 160,
}: {
  segments: { label: string; value: number; color?: string }[];
  centerLabel?: string;
  centerValue?: ReactNode;
  format?: (v: number) => string;
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 15.915; // circumference ≈ 100
  let offset = 0;
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r={R} fill="none" className="stroke-surface-2" strokeWidth="3.2" />
          {total > 0 &&
            segments.map((s, i) => {
              const pct = (s.value / total) * 100;
              const gap = pct > 2 ? 1.5 : 0; // 2px-ish surface gap between slices
              const dash = `${Math.max(0, pct - gap)} ${100 - Math.max(0, pct - gap)}`;
              const el = (
                <circle
                  key={s.label + i}
                  cx="18"
                  cy="18"
                  r={R}
                  fill="none"
                  stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth="3.2"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                />
              );
              offset += pct;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            {centerValue != null && <div className="text-lg font-bold tabular-nums text-ink leading-tight">{centerValue}</div>}
            {centerLabel && <div className="text-[11px] text-muted">{centerLabel}</div>}
          </div>
        </div>
      </div>
      <div className="space-y-1.5 text-sm min-w-0">
        {segments.map((s, i) => (
          <LegendDot
            key={s.label + i}
            color={s.color ?? CHART_COLORS[i % CHART_COLORS.length]!}
            label={
              <>
                <span className="text-ink">{s.label}</span>{" "}
                <span className="text-muted tabular-nums">· {format(s.value)}</span>
              </>
            }
          />
        ))}
      </div>
    </div>
  );
}

export function LegendDot({ color, label }: { color: string; label: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-muted">{label}</span>
    </span>
  );
}
