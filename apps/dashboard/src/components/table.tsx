import type { ReactNode } from "react";
import { EmptyState, Icon, Skeleton } from "./ui";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  loading,
  empty,
  keyOf,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  empty?: ReactNode;
  keyOf: (row: T, i: number) => string;
  onRowClick?: (row: T) => void;
}) {
  const alignCls = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted whitespace-nowrap ${alignCls(c.align)}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={`sk-${i}`} className="border-b border-line/60">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-3">
                    <Skeleton className="h-4 w-full max-w-[140px]" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                {empty ?? <EmptyState title="Belum ada data" desc="Tidak ada baris untuk ditampilkan." />}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={keyOf(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-line/60 ${onRowClick ? "cursor-pointer hover:bg-surface-2" : ""}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-3 text-ink ${alignCls(c.align)} ${c.className ?? ""}`}
                  >
                    {c.render ? c.render(row) : ((row as Record<string, unknown>)[c.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const lastPage = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-line text-sm text-muted">
      <span className="tabular-nums">
        {from}–{to} dari {total.toLocaleString("id-ID")}
      </span>
      <div className="flex items-center gap-1">
        <button
          className="grid place-items-center size-8 rounded-lg border border-line disabled:opacity-40 hover:bg-surface-2"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Sebelumnya"
        >
          <Icon name="chevron_left" size={20} />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {lastPage}
        </span>
        <button
          className="grid place-items-center size-8 rounded-lg border border-line disabled:opacity-40 hover:bg-surface-2"
          disabled={page >= lastPage}
          onClick={() => onPage(page + 1)}
          aria-label="Berikutnya"
        >
          <Icon name="chevron_right" size={20} />
        </button>
      </div>
    </div>
  );
}
