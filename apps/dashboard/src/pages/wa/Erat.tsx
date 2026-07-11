import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../lib/useApi";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page";
import { Card, Button, Icon, SectionTitle, FullscreenLoader } from "../../components/ui";
import { angka } from "../../lib/format";

type Hasil = { key: string; label: string; suara: number; pct: number };
type Erat = {
  agenda: string;
  options: { key: string; label: string }[];
  hasil: Hasil[];
  total: number;
  eligible: number;
  quorum_needed: number;
  quorum_ok: boolean;
  keputusan_sementara: string | null;
  sudah_vote: boolean;
  pilihan_saya: string | null;
};

export function WaErat() {
  const qc = useQueryClient();
  const { data, isLoading } = useApi<Erat>(["anggota-wa/erat"], "/api/anggota-wa/erat");
  const vote = useMutation({
    mutationFn: (pilihan: string) => api("/api/anggota-wa/erat/vote", { method: "POST", body: { pilihan } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["anggota-wa/erat"] }),
  });

  if (isLoading || !data) return <FullscreenLoader />;
  const e = data;
  const pilihanku = e.hasil.find((h) => h.key === e.pilihan_saya)?.label;

  return (
    <>
      <PageHeader title="e-RAT · Voting" desc="Rapat Anggota Tahunan digital — beri suara Anda dari sini." />

      <Card className="p-5">
        <SectionTitle>Agenda e-RAT 2026</SectionTitle>
        <p className="mt-1 text-ink">{e.agenda}</p>

        {!e.sudah_vote ? (
          <div className="mt-4">
            <p className="text-sm text-muted mb-2">Pilih suara Anda (hanya sekali):</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {e.options.map((o) => (
                <Button
                  key={o.key}
                  variant="outline"
                  disabled={vote.isPending}
                  onClick={() => vote.mutate(o.key)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
            {vote.isError && <p className="text-danger text-sm mt-2">Gagal mengirim suara. Coba lagi.</p>}
          </div>
        ) : (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-ok-bg text-ok px-3 py-2 text-sm font-medium">
            <Icon name="verified" size={18} /> Suara Anda tercatat: {pilihanku}
          </div>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <SectionTitle>Hasil Sementara</SectionTitle>
        <p className="text-xs text-muted mt-0.5">
          Suara masuk {angka(e.total)}/{angka(e.eligible)} · Kuorum{" "}
          {e.quorum_ok ? "✅ tercapai" : `⏳ belum (butuh ${angka(e.quorum_needed)})`}
        </p>
        <div className="mt-3 space-y-3">
          {e.hasil.map((h) => (
            <div key={h.key}>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-ink">{h.label}</span>
                <span className="text-muted tabular-nums">
                  {h.pct}% ({angka(h.suara)})
                </span>
              </div>
              <div className="mt-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${h.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        {e.keputusan_sementara && (
          <p className="mt-4 text-sm font-semibold text-ink">
            Keputusan sementara: {e.keputusan_sementara.toUpperCase()} ✅
          </p>
        )}
      </Card>
    </>
  );
}
