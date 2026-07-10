import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../lib/useApi";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page";
import { Card, KpiCard, EmptyState, Button, Icon } from "../../components/ui";
import { DataTable } from "../../components/table";
import { rupiah, angka } from "../../lib/format";

type Row = { no_anggota: string; nama: string; kode_referral: string; poin: number; estimasi_shu: number };
type Resp = { enabled: boolean; data: Row[]; total: { anggota: number; poin: number; bonus_shu: number } };

export function PengurusReferral() {
  const qc = useQueryClient();
  const { data, isLoading } = useApi<Resp>(["pengurus/referral"], "/api/pengurus/referral");
  const reset = useMutation({
    mutationFn: () => api("/api/pengurus/reset-demo", { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pengurus/referral"] }),
  });

  return (
    <>
      <PageHeader
        title="Referral & Anggota Digital"
        desc="Anggota yang aktif digital di koperasi Anda beserta perolehan referral."
        action={
          <Button
            variant="outline"
            disabled={reset.isPending}
            onClick={() => {
              if (window.confirm("Reset semua aktivasi digital DEMO di koperasi ini? Hanya menghapus baris onboarding lewat platform — anggota/member asli tidak tersentuh."))
                reset.mutate();
            }}
          >
            <Icon name="restart_alt" size={18} /> {reset.isPending ? "…" : "Reset Demo"}
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <KpiCard label="Anggota Digital" value={angka(data?.total.anggota)} icon="how_to_reg" tone="accent" />
        <KpiCard label="Total Poin" value={angka(data?.total.poin)} icon="stars" />
        <KpiCard label="Total Bonus SHU" value={rupiah(data?.total.bonus_shu)} icon="savings" tone="ok" />
      </div>
      <Card>
        <DataTable
          loading={isLoading}
          rows={data?.data ?? []}
          keyOf={(r) => r.no_anggota}
          empty={<EmptyState icon="campaign" title="Belum ada anggota digital" desc="Belum ada anggota yang mengaktifkan akun digital di koperasi ini." />}
          columns={[
            {
              key: "nama",
              header: "Anggota",
              render: (r) => (
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{r.nama}</p>
                  <p className="text-xs text-muted">{r.no_anggota}</p>
                </div>
              ),
            },
            { key: "kode", header: "Kode Referral", render: (r) => <code className="text-sm text-primary">{r.kode_referral}</code> },
            { key: "poin", header: "Poin", align: "right", render: (r) => angka(r.poin) },
            { key: "shu", header: "Bonus SHU", align: "right", render: (r) => <span className="tabular-nums">{rupiah(r.estimasi_shu)}</span> },
          ]}
        />
      </Card>
    </>
  );
}
