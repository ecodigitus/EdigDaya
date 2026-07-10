import { useState } from "react";
import { useApi } from "../../lib/useApi";
import { PageHeader, SearchInput } from "../../components/page";
import { Card, StatusPill, EmptyState, Icon } from "../../components/ui";
import { Pagination } from "../../components/table";
import { rupiah, angka } from "../../lib/format";

type Row = {
  produk_sample_id: string;
  nama_produk: string;
  unit: string;
  kode_barcode: string;
  stok: number;
  harga_jual: number | null;
};

export function AnggotaProduk() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const qs = `?q=${encodeURIComponent(q)}&page=${page}&limit=24`;
  const { data, isLoading } = useApi<{ data: Row[]; total: number; page: number; limit: number }>(
    ["anggota/produk", q, page],
    `/api/anggota/produk${qs}`,
  );
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader title="Produk Koperasi" desc="Katalog produk yang tersedia di koperasi Anda." />
      <div className="mb-4 max-w-sm">
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder="Cari produk…"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="py-4">
          <EmptyState icon="storefront" title="Belum ada produk" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((p) => (
            <Card key={p.produk_sample_id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="grid place-items-center size-10 rounded-lg bg-accent/10 text-accent shrink-0">
                  <Icon name="inventory_2" size={20} />
                </span>
                {p.stok > 0 ? (
                  <span className="text-xs text-muted">Stok {angka(p.stok)}</span>
                ) : (
                  <StatusPill status="Belum aktif" />
                )}
              </div>
              <p className="mt-2 font-semibold text-ink line-clamp-2">{p.nama_produk}</p>
              <p className="text-xs text-muted">{p.unit ?? "—"}</p>
              <p className="mt-1.5 font-bold tabular-nums text-ink">
                {p.harga_jual != null ? rupiah(p.harga_jual) : <span className="text-sm font-normal text-muted">belum tercatat</span>}
              </p>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4">
        <Card>
          <Pagination page={data?.page ?? page} limit={data?.limit ?? 24} total={data?.total ?? 0} onPage={setPage} />
        </Card>
      </div>
    </>
  );
}
