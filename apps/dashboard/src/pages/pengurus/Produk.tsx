import { useState } from "react";
import { useApi } from "../../lib/useApi";
import { PageHeader, SearchInput } from "../../components/page";
import { Card, StatusPill } from "../../components/ui";
import { DataTable, Pagination } from "../../components/table";
import { rupiah, angka } from "../../lib/format";

type Row = {
  produk_sample_id: string;
  nama_produk: string;
  unit: string;
  kode_barcode: string;
  stok: number;
  harga_jual: number | null;
};

export function PengurusProduk() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const qs = `?q=${encodeURIComponent(q)}&page=${page}&limit=20`;
  const { data, isLoading } = useApi<{ data: Row[]; total: number; page: number; limit: number }>(
    ["pengurus/produk", q, page],
    `/api/pengurus/produk${qs}`,
  );

  return (
    <>
      <PageHeader title="Produk & Inventaris" desc="Katalog produk beserta stok dan harga jual terakhir." />
      <Card>
        <div className="p-3 border-b border-line">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Cari nama produk / barcode…"
            className="max-w-sm"
          />
        </div>
        <DataTable
          loading={isLoading}
          rows={data?.data ?? []}
          keyOf={(r) => r.produk_sample_id}
          columns={[
            {
              key: "nama",
              header: "Produk",
              render: (r) => (
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{r.nama_produk}</p>
                  {r.kode_barcode && <p className="text-xs text-muted">{r.kode_barcode}</p>}
                </div>
              ),
            },
            { key: "unit", header: "Satuan", render: (r) => r.unit ?? "—" },
            {
              key: "stok",
              header: "Stok",
              align: "right",
              render: (r) =>
                r.stok > 0 ? (
                  <span className="tabular-nums">{angka(r.stok)}</span>
                ) : (
                  <StatusPill status="Belum aktif" />
                ),
            },
            {
              key: "harga",
              header: "Harga Jual",
              align: "right",
              render: (r) => (r.harga_jual != null ? <span className="tabular-nums">{rupiah(r.harga_jual)}</span> : <span className="text-muted">belum tercatat</span>),
            },
          ]}
        />
        <Pagination page={data?.page ?? page} limit={data?.limit ?? 20} total={data?.total ?? 0} onPage={setPage} />
      </Card>
    </>
  );
}
