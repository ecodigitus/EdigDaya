import { useState } from "react";
import { useApi } from "../../lib/useApi";
import { PageHeader, SearchInput, Select } from "../../components/page";
import { Card, StatusPill, SectionTitle } from "../../components/ui";
import { DataTable, Pagination } from "../../components/table";
import { rupiah, angka, tanggalWaktu } from "../../lib/format";

type Summary = {
  byJenis: { jenis: string; paid: number; unpaid: number; n_paid: number; n_unpaid: number }[];
};
type Row = {
  simpanan_ref: string;
  anggota_nama: string;
  periode_pembayaran: string;
  jenis: string;
  jumlah: number;
  status: string;
  dibayar_pada: string;
};

export function PengurusSimpanan() {
  const [status, setStatus] = useState("");
  const [jenis, setJenis] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const summary = useApi<Summary>(["pengurus/simpanan/summary"], "/api/pengurus/simpanan/summary");
  const qs = `?status=${encodeURIComponent(status)}&jenis=${encodeURIComponent(jenis)}&q=${encodeURIComponent(q)}&page=${page}&limit=20`;
  const list = useApi<{ data: Row[]; total: number; page: number; limit: number }>(
    ["pengurus/simpanan", status, jenis, q, page],
    `/api/pengurus/simpanan${qs}`,
  );

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Simpanan Anggota" desc="Simpanan pokok, wajib, dan sukarela." />

      <div className="grid gap-4 sm:grid-cols-3">
        {(summary.data?.byJenis ?? []).map((j) => {
          const total = j.paid + j.unpaid;
          const pct = total > 0 ? (j.paid / total) * 100 : 0;
          return (
            <Card key={j.jenis} className="p-4">
              <p className="text-sm font-semibold text-ink">{j.jenis}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-ink">{rupiah(j.paid)}</p>
              <p className="text-xs text-muted">
                {angka(j.n_paid)} lunas · {angka(j.n_unpaid)} tunggakan
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">
          <SearchInput value={q} onChange={reset(setQ)} placeholder="Cari nama anggota…" className="flex-1 min-w-[200px]" />
          <Select
            value={jenis}
            onChange={reset(setJenis)}
            options={[
              { value: "", label: "Semua jenis" },
              { value: "Simpanan Pokok", label: "Pokok" },
              { value: "Simpanan Wajib", label: "Wajib" },
              { value: "Simpanan Sukarela", label: "Sukarela" },
            ]}
          />
          <Select
            value={status}
            onChange={reset(setStatus)}
            options={[
              { value: "", label: "Semua status" },
              { value: "PAID", label: "Lunas" },
              { value: "UNPAID", label: "Tunggakan" },
            ]}
          />
        </div>
        <DataTable
          loading={list.isLoading}
          rows={list.data?.data ?? []}
          keyOf={(r) => r.simpanan_ref}
          columns={[
            { key: "nama", header: "Anggota", render: (r) => r.anggota_nama ?? "—" },
            { key: "periode", header: "Periode", render: (r) => r.periode_pembayaran },
            { key: "bayar", header: "Dibayar", render: (r) => tanggalWaktu(r.dibayar_pada) },
            { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
            { key: "jumlah", header: "Jumlah", align: "right", render: (r) => <span className="tabular-nums">{rupiah(r.jumlah)}</span> },
          ]}
        />
        <Pagination page={list.data?.page ?? page} limit={list.data?.limit ?? 20} total={list.data?.total ?? 0} onPage={setPage} />
      </Card>
    </>
  );
}
