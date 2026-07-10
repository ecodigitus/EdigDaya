import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../lib/useApi";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page";
import { Card, EmptyState } from "../../components/ui";
import { DataTable } from "../../components/table";
import { tanggalWaktu, angka } from "../../lib/format";

const STATUS = [
  { v: "MENUNGGU_ADMIN", l: "Menunggu Admin" },
  { v: "DIQUOTE", l: "Ditawar (Quote)" },
  { v: "DP_DIBAYAR", l: "DP Dibayar" },
  { v: "FINAL", l: "Final / Selesai" },
  { v: "BATAL", l: "Batal" },
];

type PO = {
  id: string;
  user_name: string;
  anggota_ref: string;
  produk: string;
  qty_num: number;
  catatan: string;
  status: string;
  created_at: string;
};

export function PengurusPreOrder() {
  const qc = useQueryClient();
  const { data, isLoading } = useApi<{ enabled: boolean; data: PO[] }>(["pengurus/pre-order"], "/api/pengurus/pre-order");
  const ubah = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      api("/api/pengurus/pre-order/" + encodeURIComponent(v.id), { method: "PATCH", body: { status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pengurus/pre-order"] }),
  });

  return (
    <>
      <PageHeader title="Antrean Pre-Order" desc="Kelola pesanan dari anggota — ubah status sesuai alur." />
      <Card>
        <DataTable
          loading={isLoading}
          rows={data?.data ?? []}
          keyOf={(r) => r.id}
          empty={<EmptyState icon="shopping_cart" title="Belum ada pre-order" desc="Belum ada pesanan masuk untuk koperasi ini." />}
          columns={[
            {
              key: "produk",
              header: "Produk",
              render: (r) => (
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{r.produk}</p>
                  <p className="text-xs text-muted truncate">oleh {r.user_name}{r.catatan ? ` · ${r.catatan}` : ""}</p>
                </div>
              ),
            },
            { key: "qty", header: "Jumlah", align: "right", render: (r) => angka(r.qty_num) },
            { key: "tgl", header: "Waktu", render: (r) => tanggalWaktu(r.created_at) },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <select
                  value={r.status}
                  disabled={ubah.isPending}
                  onChange={(e) => ubah.mutate({ id: r.id, status: e.target.value })}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
                >
                  {STATUS.map((s) => (
                    <option key={s.v} value={s.v}>{s.l}</option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
