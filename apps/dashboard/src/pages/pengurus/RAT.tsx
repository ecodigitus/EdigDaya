import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, StatusPill, EmptyState } from "../../components/ui";
import { DataTable } from "../../components/table";
import { angka, tanggal } from "../../lib/format";

type Row = {
  ref: string;
  tahun_buku: number;
  urutan_rat: string;
  tanggal_rat: string;
  jumlah_peserta_rat: number;
  status_rat: string;
  tahap_rat: string;
  jenis_sektor_koperasi: string;
};

export function PengurusRAT() {
  const { data, isLoading } = useApi<{ data: Row[]; summary: { status: string; n: number }[] }>(
    ["pengurus/rat"],
    "/api/pengurus/rat",
  );

  return (
    <>
      <PageHeader title="RAT" desc="Rapat Anggota Tahunan koperasi Anda." />
      {data?.summary && data.summary.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {data.summary.map((s) => (
            <span key={s.status} className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs border border-line">
              <StatusPill status={s.status} />
              <span className="tabular-nums font-semibold text-ink">{s.n}</span>
            </span>
          ))}
        </div>
      )}
      <Card>
        <DataTable
          loading={isLoading}
          rows={data?.data ?? []}
          keyOf={(r) => r.ref}
          columns={[
            { key: "tahun", header: "Tahun Buku", render: (r) => r.tahun_buku ?? "—" },
            { key: "urutan", header: "RAT ke-", render: (r) => r.urutan_rat ?? "—" },
            { key: "tanggal", header: "Tanggal", render: (r) => tanggal(r.tanggal_rat) },
            { key: "peserta", header: "Peserta", align: "right", render: (r) => angka(r.jumlah_peserta_rat) },
            { key: "tahap", header: "Tahap", render: (r) => r.tahap_rat ?? "—" },
            { key: "status", header: "Status", render: (r) => <StatusPill status={r.status_rat} /> },
          ]}
          empty={<EmptyState icon="how_to_vote" title="Belum ada RAT" desc="Belum ada data Rapat Anggota Tahunan." />}
        />
      </Card>
    </>
  );
}
