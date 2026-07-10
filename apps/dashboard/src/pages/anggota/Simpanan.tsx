import { useState } from "react";
import { useApi } from "../../lib/useApi";
import { PageHeader, Select } from "../../components/page";
import { Card, StatusPill, SectionTitle } from "../../components/ui";
import { DataTable, Pagination } from "../../components/table";
import { rupiah, angka, tanggalWaktu } from "../../lib/format";

type Resp = {
  byJenis: { jenis: string; paid: number; unpaid: number; n_paid: number; n_unpaid: number }[];
  data: { simpanan_ref: string; periode_pembayaran: string; jenis: string; jumlah: number; status: string; dibayar_pada: string }[];
  total: number;
  page: number;
  limit: number;
};

export function AnggotaSimpanan() {
  const [status, setStatus] = useState("");
  const [jenis, setJenis] = useState("");
  const [page, setPage] = useState(1);
  const qs = `?status=${encodeURIComponent(status)}&jenis=${encodeURIComponent(jenis)}&page=${page}&limit=20`;
  const { data, isLoading } = useApi<Resp>(["anggota/simpanan", status, jenis, page], `/api/anggota/simpanan${qs}`);

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Simpanan Saya" desc="Rincian dan riwayat simpanan Anda." />

      <div className="grid gap-4 sm:grid-cols-3">
        {(data?.byJenis ?? []).map((j) => (
          <Card key={j.jenis} className="p-4">
            <p className="text-sm font-semibold text-ink">{j.jenis.replace("Simpanan ", "")}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-ok">{rupiah(j.paid)}</p>
            <p className="text-xs text-muted">
              {angka(j.n_paid)} lunas{j.n_unpaid > 0 ? ` · ${angka(j.n_unpaid)} tunggakan` : ""}
            </p>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">
          <SectionTitle>Riwayat</SectionTitle>
          <div className="flex-1" />
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
          loading={isLoading}
          rows={data?.data ?? []}
          keyOf={(r) => r.simpanan_ref}
          columns={[
            { key: "periode", header: "Periode", render: (r) => r.periode_pembayaran },
            { key: "jenis", header: "Jenis", render: (r) => r.jenis.replace("Simpanan ", "") },
            { key: "bayar", header: "Dibayar", render: (r) => tanggalWaktu(r.dibayar_pada) },
            { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
            { key: "jumlah", header: "Jumlah", align: "right", render: (r) => <span className="tabular-nums">{rupiah(r.jumlah)}</span> },
          ]}
        />
        <Pagination page={data?.page ?? page} limit={data?.limit ?? 20} total={data?.total ?? 0} onPage={setPage} />
      </Card>
    </>
  );
}
