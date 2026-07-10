import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, Icon, EmptyState } from "../../components/ui";
import { tanggalWaktu } from "../../lib/format";

type P = { id: number; judul: string; isi: string; penting: boolean; penulis: string; created_at: string };

export function AnggotaPengumuman() {
  const { data, isLoading } = useApi<{ data: P[] }>(["anggota/pengumuman"], "/api/anggota/pengumuman");
  return (
    <>
      <PageHeader title="Pengumuman" desc="Informasi terbaru dari koperasi Anda." />
      <div className="space-y-3">
        {isLoading ? (
          <Card className="h-24 animate-pulse" />
        ) : data?.data.length ? (
          data.data.map((p) => (
            <Card key={p.id} className={`p-4 ${p.penting ? "border-l-4 border-l-danger" : ""}`}>
              <p className="font-semibold text-ink flex items-center gap-2">
                {p.penting && <Icon name="priority_high" size={16} className="text-danger" />}
                {p.judul}
              </p>
              <p className="text-xs text-muted">{p.penulis ?? "—"} · {tanggalWaktu(p.created_at)}</p>
              <p className="mt-2 text-sm text-ink whitespace-pre-wrap">{p.isi}</p>
            </Card>
          ))
        ) : (
          <Card className="py-4"><EmptyState icon="campaign" title="Belum ada pengumuman" /></Card>
        )}
      </div>
    </>
  );
}
