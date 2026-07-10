import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, StatusPill, EmptyState, Icon } from "../../components/ui";
import { rupiah, tanggal } from "../../lib/format";

type Row = {
  pengajuan_pembiayaan_ref: string;
  status_permohonan: string;
  nominal: number | null;
  tenor: number | null;
  tujuan_permohonan: string | null;
  dibuat_pada: string;
};

export function AnggotaPengajuan() {
  const { data, isLoading } = useApi<{ data: Row[] }>(["anggota/pengajuan"], "/api/anggota/pengajuan");
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader title="Pengajuan Pembiayaan" desc="Status permohonan pembiayaan Anda (dicocokkan via NIK)." />
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="py-4">
          <EmptyState icon="request_quote" title="Belum ada pengajuan" desc="Anda belum memiliki permohonan pembiayaan." />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.pengajuan_pembiayaan_ref} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{r.tujuan_permohonan ?? "Pembiayaan"}</p>
                  <p className="text-xs text-muted">{r.pengajuan_pembiayaan_ref} · {tanggal(r.dibuat_pada)}</p>
                </div>
                <StatusPill status={r.status_permohonan} />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1 text-muted">
                  <Icon name="payments" size={16} /> Nominal:
                  <span className="text-ink font-medium tabular-nums">{r.nominal != null ? rupiah(r.nominal) : "—"}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-muted">
                  <Icon name="schedule" size={16} /> Tenor:
                  <span className="text-ink font-medium">{r.tenor != null ? `${r.tenor} bulan` : "—"}</span>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
