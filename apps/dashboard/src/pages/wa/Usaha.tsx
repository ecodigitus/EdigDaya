import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, SectionTitle, EmptyState } from "../../components/ui";
import { DataTable } from "../../components/table";
import { rupiah, angka } from "../../lib/format";

type Produk = { nama: string; stok: number; terjual: number; hargaJual: number };
type Usaha = { namaUsaha: string; produk: Produk[]; kerugian: number };
type Overview = {
  member: { usaha: Usaha | null; keuangan: { modal: number; pengeluaran: number } | null };
};

export function WaUsaha() {
  const { data, isLoading } = useApi<Overview>(["anggota-wa/overview"], "/api/anggota-wa/overview");
  const u = data?.member?.usaha ?? null;
  const k = data?.member?.keuangan ?? { modal: 0, pengeluaran: 0 };

  if (isLoading) return <Card className="h-40 animate-pulse" />;

  if (!u) {
    return (
      <>
        <PageHeader title="Usaha Saya" desc="Dashboard usaha untuk anggota produsen." />
        <EmptyState
          icon="storefront"
          title="Belum ada data usaha"
          desc="Fitur ini untuk anggota produsen. Mau menitip-jual lewat koperasi? Hubungi pengurus via WhatsApp bot."
        />
      </>
    );
  }

  const omzet = u.produk.reduce((s, p) => s + p.terjual * p.hargaJual, 0);
  const laba = omzet - k.pengeluaran - u.kerugian;

  return (
    <>
      <PageHeader title={`Usaha — ${u.namaUsaha}`} desc="Ringkasan penjualan & keuangan usaha Anda." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Omzet penjualan" value={rupiah(omzet)} />
        <Stat label="Modal usaha" value={rupiah(k.modal)} />
        <Stat
          label={laba >= 0 ? "Keuntungan bersih" : "Kerugian bersih"}
          value={rupiah(Math.abs(laba))}
          tone={laba >= 0 ? "ok" : "warn"}
        />
      </div>

      <Card className="mt-4">
        <div className="p-4 pb-0">
          <SectionTitle>Produk</SectionTitle>
        </div>
        <DataTable
          rows={u.produk}
          keyOf={(p) => p.nama}
          columns={[
            { key: "nama", header: "Produk", render: (p) => p.nama },
            { key: "terjual", header: "Terjual", render: (p) => angka(p.terjual) },
            { key: "stok", header: "Stok", render: (p) => angka(p.stok) },
            {
              key: "harga",
              header: "Harga",
              align: "right",
              render: (p) => <span className="tabular-nums">{rupiah(p.hargaJual)}</span>,
            },
          ]}
        />
      </Card>
      <p className="mt-3 text-xs text-muted">
        Pengeluaran {rupiah(k.pengeluaran)} · Kerugian/susut {rupiah(u.kerugian)}. Keuntungan bersih ={" "}
        omzet − pengeluaran − kerugian.
      </p>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const c = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${c}`}>{value}</p>
    </Card>
  );
}
