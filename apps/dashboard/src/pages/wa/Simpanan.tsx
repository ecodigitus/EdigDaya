import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, Icon } from "../../components/ui";
import { rupiah } from "../../lib/format";

type Overview = {
  member: {
    simpanan_pokok: number;
    simpanan_wajib: number;
    simpanan_sukarela: number;
  };
  total_simpanan: number;
};

export function WaSimpanan() {
  const { data, isLoading } = useApi<Overview>(["anggota-wa/overview"], "/api/anggota-wa/overview");
  const m = data?.member;
  const jenis: [string, number][] = [
    ["Pokok", m?.simpanan_pokok ?? 0],
    ["Wajib", m?.simpanan_wajib ?? 0],
    ["Sukarela", m?.simpanan_sukarela ?? 0],
  ];

  return (
    <>
      <PageHeader title="Simpanan Saya" desc="Rincian simpanan Anda dari akun WhatsApp." />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-2xl p-5 bg-primary text-primary-fg shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <p className="text-sm text-primary-fg/80">Total Simpanan</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums">{rupiah(data?.total_simpanan)}</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {jenis.map(([label, v]) => (
              <Card key={label} className="p-4">
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-ok">{rupiah(v)}</p>
              </Card>
            ))}
          </div>
          <Card className="mt-4 p-4 flex items-start gap-3">
            <span className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon name="chat" size={18} />
            </span>
            <p className="text-sm text-muted">
              Setoran & rincian transaksi dilakukan lewat chat WhatsApp bot. Saldo di sini
              mengikuti data terbaru dari akun WhatsApp Anda.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
