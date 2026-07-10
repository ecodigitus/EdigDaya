import type { ReactNode } from "react";

export function Icon({ name, className = "", size }: { name: string; className?: string; size?: number }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={size ? { fontSize: size } : undefined}
      aria-hidden
    >
      {name}
    </span>
  );
}

export function Card({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-surface border border-line shadow-[0_1px_3px_rgba(0,0,0,0.05)] ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  icon,
  sub,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  sub?: ReactNode;
  tone?: "primary" | "accent" | "ok" | "warn" | "danger";
}) {
  const chip: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/10 text-accent",
    ok: "bg-ok-bg text-ok",
    warn: "bg-warn-bg text-warn",
    danger: "bg-danger-bg text-danger",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted truncate">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-ink truncate">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
        </div>
        {icon && (
          <span className={`shrink-0 grid place-items-center size-10 rounded-lg ${chip[tone]}`}>
            <Icon name={icon} size={22} />
          </span>
        )}
      </div>
    </Card>
  );
}

type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

const STATUS_TONES: Record<string, Tone> = {
  approved: "ok",
  paid: "ok",
  aktif: "ok",
  verified: "ok",
  selesai: "ok",
  completed: "ok",
  ready: "ok",
  requested: "warn",
  unpaid: "warn",
  "belum aktif": "warn",
  draft: "warn",
  drafted: "warn",
  pending: "warn",
  processed: "info",
  confirmed: "info",
  reported: "info",
  rejected: "danger",
  failed: "danger",
  cancelled: "danger",
};

export function StatusPill({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted">—</span>;
  const tone = STATUS_TONES[status.toLowerCase()] ?? "neutral";
  const cls: Record<Tone, string> = {
    ok: "bg-ok-bg text-ok",
    warn: "bg-warn-bg text-warn",
    danger: "bg-danger-bg text-danger",
    info: "bg-info-bg text-info",
    neutral: "bg-surface-2 text-muted",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[tone]}`}>
      {status}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: {
  children: ReactNode;
  variant?: "primary" | "accent" | "outline" | "ghost";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const v: Record<string, string> = {
    primary: "bg-primary text-primary-fg hover:opacity-90",
    accent: "bg-accent text-accent-fg hover:opacity-90",
    outline: "border border-line text-ink hover:bg-surface-2",
    ghost: "text-ink hover:bg-surface-2",
  };
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${v[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block size-5 rounded-full border-2 border-current border-r-transparent animate-spin ${className}`}
      role="status"
      aria-label="Memuat"
    />
  );
}

export function FullscreenLoader({ label = "Memuat…" }: { label?: string }) {
  return (
    <div className="min-h-screen grid place-items-center bg-bg text-muted">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="text-primary size-8" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  desc,
  action,
}: {
  icon?: string;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <span className="grid place-items-center size-14 rounded-full bg-surface-2 text-muted mb-3">
        <Icon name={icon} size={28} />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {desc && <p className="mt-1 text-sm text-muted max-w-sm">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-surface-2 ${className}`} />;
}

export function Avatar({ name, className = "" }: { name?: string | null; className?: string }) {
  const initials = (name ?? "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={`grid place-items-center rounded-full bg-primary/10 text-primary font-semibold ${className}`}
    >
      {initials || "?"}
    </span>
  );
}
