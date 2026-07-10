import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../lib/useApi";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page";
import { Card, Button, EmptyState, SectionTitle, StatusPill } from "../../components/ui";
import { DataTable } from "../../components/table";
import { tanggalWaktu, angka } from "../../lib/format";

type PO = { id: string; produk: string; qty_num: number; catatan: string; status: string; created_at: string };
type Produk = { produk_sample_id: string; nama_produk: string; unit: string };

export const PREORDER_LABEL: Record<string, string> = {
  MENUNGGU_ADMIN: "Menunggu",
  DIQUOTE: "Ditawar",
  DP_DIBAYAR: "DP Dibayar",
  FINAL: "Selesai",
  BATAL: "Batal",
};

export function AnggotaPreOrder() {
  const qc = useQueryClient();
  const list = useApi<{ enabled: boolean; data: PO[] }>(["anggota/pre-order"], "/api/anggota/pre-order");
  const katalog = useApi<{ data: Produk[] }>(["anggota/produk", "po"], "/api/anggota/produk?limit=100");
  const [mode, setMode] = useState<"katalog" | "manual">("katalog");
  const [produk, setProduk] = useState("");
  const [psid, setPsid] = useState("");
  const [qty, setQty] = useState("1");
  const [catatan, setCatatan] = useState("");

  const buat = useMutation({
    mutationFn: () =>
      api("/api/anggota/pre-order", {
        method: "POST",
        body: { produk, qty_num: Number(qty), catatan, produk_sample_id: mode === "katalog" ? psid : undefined },
      }),
    onSuccess: () => {
      setProduk("");
      setPsid("");
      setQty("1");
      setCatatan("");
      qc.invalidateQueries({ queryKey: ["anggota/pre-order"] });
    },
  });

  return (
    <>
      <PageHeader title="Pre-Order" desc="Pesan produk dari katalog atau ketik manual — pengurus menindaklanjuti." />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="p-5 h-fit">
          <SectionTitle>Buat Pesanan</SectionTitle>
          <div className="flex gap-2 mb-3">
            <Tab active={mode === "katalog"} onClick={() => setMode("katalog")}>Dari Katalog</Tab>
            <Tab active={mode === "manual"} onClick={() => setMode("manual")}>Ketik Manual</Tab>
          </div>
          {mode === "katalog" ? (
            <select
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink mb-3"
              value={psid}
              onChange={(e) => {
                const p = katalog.data?.data.find((x) => x.produk_sample_id === e.target.value);
                setPsid(e.target.value);
                setProduk(p?.nama_produk ?? "");
              }}
            >
              <option value="">— pilih produk —</option>
              {katalog.data?.data.map((p) => (
                <option key={p.produk_sample_id} value={p.produk_sample_id}>
                  {p.nama_produk}
                  {p.unit ? ` (${p.unit})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink mb-3"
              placeholder="Nama produk"
              value={produk}
              onChange={(e) => setProduk(e.target.value)}
            />
          )}
          <input
            type="number"
            min="1"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink mb-3"
            placeholder="Jumlah"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <textarea
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink mb-3"
            placeholder="Catatan (opsional)"
            rows={2}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
          />
          <Button
            variant="accent"
            className="w-full"
            disabled={!produk.trim() || Number(qty) <= 0 || buat.isPending}
            onClick={() => buat.mutate()}
          >
            {buat.isPending ? "Menyimpan…" : "Kirim Pre-Order"}
          </Button>
          {buat.isError && <p className="text-danger text-sm mt-2">Gagal membuat pesanan.</p>}
          {buat.isSuccess && <p className="text-ok text-sm mt-2">Pre-order terkirim!</p>}
        </Card>

        <Card>
          <div className="p-4 pb-0"><SectionTitle>Pesanan Saya</SectionTitle></div>
          <DataTable
            loading={list.isLoading}
            rows={list.data?.data ?? []}
            keyOf={(r) => r.id}
            empty={<EmptyState icon="shopping_cart" title="Belum ada pre-order" desc="Buat pesanan pertama Anda di sebelah kiri." />}
            columns={[
              { key: "produk", header: "Produk", render: (r) => (
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{r.produk}</p>
                  {r.catatan && <p className="text-xs text-muted truncate">{r.catatan}</p>}
                </div>
              ) },
              { key: "qty", header: "Jumlah", align: "right", render: (r) => angka(r.qty_num) },
              { key: "tgl", header: "Waktu", render: (r) => tanggalWaktu(r.created_at) },
              { key: "status", header: "Status", render: (r) => <StatusPill status={PREORDER_LABEL[r.status] ?? r.status} /> },
            ]}
          />
        </Card>
      </div>
    </>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
