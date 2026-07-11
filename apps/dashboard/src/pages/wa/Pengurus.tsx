import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, Avatar, EmptyState } from "../../components/ui";

type Row = {
  id: number;
  urutan: number;
  nama: string;
  jabatan: string;
  no_hp: string | null;
  wilayah: string | null;
};

export function WaPengurus() {
  const { data, isLoading } = useApi<{ data: Row[] }>(["anggota-wa/pengurus"], "/api/anggota-wa/pengurus");
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader title="Pengurus Koperasi" desc="Susunan pengurus koperasi Anda." />
      {isLoading ? (
        <Card className="h-40 animate-pulse" />
      ) : rows.length === 0 ? (
        <EmptyState icon="groups" title="Belum ada data pengurus" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id} className="p-4 flex items-center gap-3">
              <Avatar name={r.nama} className="size-12 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{r.nama}</p>
                <p className="text-sm text-primary">{r.jabatan}</p>
                <p className="text-xs text-muted truncate">
                  {[r.wilayah, r.no_hp].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
