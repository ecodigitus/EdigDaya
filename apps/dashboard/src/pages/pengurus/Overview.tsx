import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, KpiCard, SectionTitle, EmptyState, StatusPill } from "../../components/ui";
import { Columns, Donut, Meter } from "../../components/charts";
import { DataTable } from "../../components/table";
import { rupiah, rupiahShort, angka, tanggalWaktu } from "../../lib/format";

type Overview = {
  anggota: { total: number; approved: number; requested: number; laki: number; perempuan: number };
  simpanan: { paid: number; unpaid: number; n_paid: number; n_unpaid: number };
  produk: { total: number };
  transaksi: { total: number; nilai: number };
  gerai: { total: number; aktif: number };
};
type Trends = { simpanan: { bulan: string; total: number; n: number }[] };

function bulanShort(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat("id-ID", { month: "short" }).format(new Date(y, m - 1, 1));
}

export function PengurusOverview() {
  const ov = useApi<Overview>(["pengurus/overview"], "/api/pengurus/overview");
  const tr = useApi<Trends>(["pengurus/trends"], "/api/pengurus/trends");
  const trx = useApi<{ data: any[] }>(["pengurus/transaksi", "recent"], "/api/pengurus/transaksi?limit=6");

  const d = ov.data;
  const collTotal = d ? d.simpanan.paid + d.simpanan.unpaid : 0;

  return (
    <>
      <PageHeader title="Ringkasan Koperasi" desc="Kondisi terkini anggota, simpanan, produk & transaksi." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Anggota" value={angka(d?.anggota.total)} icon="group"
          sub={d ? `${angka(d.anggota.approved)} aktif · ${angka(d.anggota.requested)} menunggu` : undefined} />
        <KpiCard label="Simpanan Terkumpul" value={rupiahShort(d?.simpanan.paid)} icon="savings" tone="ok"
          sub={d ? `${angka(d.simpanan.n_paid)} setoran lunas` : undefined} />
        <KpiCard label="Produk" value={angka(d?.produk.total)} icon="inventory_2" tone="accent"
          sub={d ? `${angka(d.gerai.aktif)} gerai aktif` : undefined} />
        <KpiCard label="Transaksi" value={angka(d?.transaksi.total)} icon="receipt_long" tone="primary"
          sub={d ? rupiah(d.transaksi.nilai) : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        <Card className="p-4 lg:col-span-2">
          <SectionTitle>Tren Simpanan Masuk (per bulan)</SectionTitle>
          {tr.data && tr.data.simpanan.length > 0 ? (
            <Columns
              data={tr.data.simpanan.map((s) => ({ label: bulanShort(s.bulan), value: s.total, hint: s.bulan }))}
              format={rupiahShort}
            />
          ) : (
            <EmptyState icon="show_chart" title="Belum ada simpanan masuk"
              desc="Belum ada setoran berstatus lunas untuk koperasi ini." />
          )}
        </Card>

        <Card className="p-4 space-y-5">
          <div>
            <SectionTitle>Tingkat Penagihan Simpanan</SectionTitle>
            <Meter value={d?.simpanan.paid ?? 0} total={collTotal} valueLabel="Lunas" restLabel="Tunggakan" format={rupiahShort} />
          </div>
          <div>
            <SectionTitle>Komposisi Gender</SectionTitle>
            <Donut
              segments={[
                { label: "Laki-laki", value: d?.anggota.laki ?? 0 },
                { label: "Perempuan", value: d?.anggota.perempuan ?? 0, color: "#d97706" },
              ]}
              centerValue={angka(d?.anggota.total)}
              centerLabel="anggota"
            />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="p-4 pb-0">
          <SectionTitle>Transaksi Terbaru</SectionTitle>
        </div>
        <DataTable
          loading={trx.isLoading}
          rows={trx.data?.data ?? []}
          keyOf={(r) => r.transaksi_sample_id}
          empty={<EmptyState icon="receipt_long" title="Belum ada transaksi" />}
          columns={[
            { key: "pelanggan", header: "Pelanggan", render: (r) => r.nama_pelanggan ?? "Umum" },
            { key: "waktu", header: "Waktu", render: (r) => tanggalWaktu(r.tanggal_dibuat) },
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
      </Card>
    </>
  );
}
