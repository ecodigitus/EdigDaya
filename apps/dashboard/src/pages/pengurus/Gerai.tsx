import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, StatusPill, EmptyState, Icon } from "../../components/ui";

type Gerai = {
  gerai_ref: string;
  nama_jenis_gerai: string | null;
  status_gerai: string | null;
  pengisi: string | null;
  akses_internet: string | null;
  akses_listrik: string | null;
  jenis_bangunan: string | null;
  sumber_air_bersih: string | null;
};

function Fasilitas({ icon, label, value }: { icon: string; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <Icon name={icon} size={16} /> {label}: <span className="text-ink">{value}</span>
    </span>
  );
}

export function PengurusGerai() {
  const { data, isLoading } = useApi<{ data: Gerai[] }>(["pengurus/gerai"], "/api/pengurus/gerai");
  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader title="Gerai Koperasi" desc="Unit gerai/outlet beserta fasilitasnya." />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4 h-40 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="py-4">
          <EmptyState icon="storefront" title="Belum ada gerai" desc="Koperasi ini belum memiliki data gerai." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((g) => (
            <Card key={g.gerai_ref} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{g.nama_jenis_gerai ?? "Gerai"}</p>
                  <p className="text-xs text-muted">{g.gerai_ref}</p>
                </div>
                <StatusPill status={g.status_gerai} />
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                <Fasilitas icon="engineering" label="Pengisi" value={g.pengisi} />
                <Fasilitas icon="home_work" label="Bangunan" value={g.jenis_bangunan} />
                <Fasilitas icon="wifi" label="Internet" value={g.akses_internet} />
                <Fasilitas icon="bolt" label="Listrik" value={g.akses_listrik} />
                <Fasilitas icon="water_drop" label="Air" value={g.sumber_air_bersih} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
