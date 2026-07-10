import { useState } from "react";
import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, StatusPill } from "../../components/ui";
import { DataTable, Pagination } from "../../components/table";
import { rupiah, angka, tanggalWaktu } from "../../lib/format";

type Row = {
  transaksi_sample_id: string;
  nama_pelanggan: string;
  tanggal_dibuat: string;
  total_pembayaran: number;
  status_transaksi: string;
  metode_pembayaran: string;
  n_item: number;
};

export function PengurusTransaksi() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useApi<{ data: Row[]; total: number; page: number; limit: number }>(
    ["pengurus/transaksi", page],
    `/api/pengurus/transaksi?page=${page}&limit=20`,
  );

  return (
    <>
      <PageHeader title="Transaksi Penjualan" desc="Riwayat penjualan koperasi." />
      <Card>
        <DataTable
          loading={isLoading}
          rows={data?.data ?? []}
          keyOf={(r) => r.transaksi_sample_id}
          columns={[
            { key: "pelanggan", header: "Pelanggan", render: (r) => r.nama_pelanggan ?? "Umum" },
            { key: "waktu", header: "Waktu", render: (r) => tanggalWaktu(r.tanggal_dibuat) },
            { key: "item", header: "Item", align: "right", render: (r) => angka(r.n_item) },
            { key: "metode", header: "Metode", render: (r) => r.metode_pembayaran ?? "—" },
            { key: "status", header: "Status", render: (r) => <StatusPill status={r.status_transaksi} /> },
            {
              key: "total",
              header: "Total",
              align: "right",
              render: (r) => <span className="font-semibold tabular-nums">{rupiah(r.total_pembayaran)}</span>,
            },
          ]}
        />
        <Pagination page={data?.page ?? page} limit={data?.limit ?? 20} total={data?.total ?? 0} onPage={setPage} />
      </Card>
    </>
  );
}
