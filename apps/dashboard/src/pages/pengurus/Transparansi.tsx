import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, StatusPill, EmptyState, Icon } from "../../components/ui";
import { DataTable } from "../../components/table";
import { tanggalWaktu } from "../../lib/format";

type T = {
  id: number;
  kategori: string;
  isi: string;
  anonim: boolean;
  pelapor_nama: string | null;
  pelapor_no: string | null;
  status: string;
  created_at: string;
};

export function PengurusTransparansi() {
  const { data, isLoading } = useApi<{ data: T[] }>(["pengurus/transparansi"], "/api/pengurus/transparansi");
  return (
    <>
      <PageHeader title="Laporan Transparansi" desc="Aspirasi/aduan dari anggota koperasi." />
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
        <Icon name="lock" size={16} /> Laporan bersifat <strong className="text-ink">tamper-proof</strong> — tidak dapat diubah/dihapus, menjamin integritas transparansi.
      </div>
      <Card>
        <DataTable
          loading={isLoading}
          rows={data?.data ?? []}
          keyOf={(r) => String(r.id)}
          empty={<EmptyState icon="flag" title="Belum ada laporan" desc="Belum ada aduan/aspirasi masuk." />}
          columns={[
            { key: "kategori", header: "Kategori", render: (r) => r.kategori },
            { key: "isi", header: "Isi", render: (r) => <span className="line-clamp-2 max-w-md inline-block">{r.isi}</span> },
            { key: "pelapor", header: "Pelapor", render: (r) => (r.anonim ? <span className="italic text-muted">Anonim</span> : (r.pelapor_nama ?? "—")) },
            { key: "tgl", header: "Waktu", render: (r) => tanggalWaktu(r.created_at) },
            { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
          ]}
        />
      </Card>
    </>
  );
}
