import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../lib/useApi";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page";
import { Card, Button, Icon, SectionTitle, EmptyState } from "../../components/ui";
import { tanggalWaktu } from "../../lib/format";

type P = { id: number; judul: string; isi: string; penting: boolean; penulis: string; created_at: string; koperasi_ref?: string | null };

export function PengurusPengumuman() {
  const qc = useQueryClient();
  const { data, isLoading } = useApi<{ data: P[] }>(["pengurus/pengumuman"], "/api/pengurus/pengumuman");
  const [judul, setJudul] = useState("");
  const [isi, setIsi] = useState("");
  const [penting, setPenting] = useState(false);

  const buat = useMutation({
    mutationFn: () => api("/api/pengurus/pengumuman", { method: "POST", body: { judul, isi, penting } }),
    onSuccess: () => {
      setJudul(""); setIsi(""); setPenting(false);
      qc.invalidateQueries({ queryKey: ["pengurus/pengumuman"] });
    },
  });
  const hapus = useMutation({
    mutationFn: (id: number) => api("/api/pengurus/pengumuman/" + id, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pengurus/pengumuman"] }),
  });

  return (
    <>
      <PageHeader title="Pengumuman" desc="Buat & kelola pengumuman untuk anggota koperasi." />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="p-5 h-fit">
          <SectionTitle>Buat Pengumuman</SectionTitle>
          <input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Judul"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink mb-3" />
          <textarea value={isi} onChange={(e) => setIsi(e.target.value)} placeholder="Isi pengumuman" rows={4}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink mb-3" />
          <label className="flex items-center gap-2 text-sm text-ink mb-3">
            <input type="checkbox" checked={penting} onChange={(e) => setPenting(e.target.checked)} /> Tandai penting
          </label>
          <Button variant="accent" className="w-full" disabled={!judul.trim() || !isi.trim() || buat.isPending} onClick={() => buat.mutate()}>
            {buat.isPending ? "Menyimpan…" : "Terbitkan"}
          </Button>
        </Card>

        <div className="space-y-3">
          {isLoading ? (
            <Card className="h-24 animate-pulse" />
          ) : data?.data.length ? (
            data.data.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink flex items-center gap-2">
                      {p.penting && <Icon name="priority_high" size={16} className="text-danger" />}
                      {p.judul}
                    </p>
                    <p className="text-xs text-muted">
                      {p.penulis ?? "—"} · {tanggalWaktu(p.created_at)}{p.koperasi_ref == null ? " · umum" : ""}
                    </p>
                  </div>
                  {p.koperasi_ref != null && (
                    <button
                      onClick={() => { if (window.confirm("Hapus pengumuman ini?")) hapus.mutate(p.id); }}
                      className="text-muted hover:text-danger shrink-0"
                      aria-label="Hapus"
                    >
                      <Icon name="delete" size={18} />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm text-ink whitespace-pre-wrap">{p.isi}</p>
              </Card>
            ))
          ) : (
            <Card className="py-4"><EmptyState icon="campaign" title="Belum ada pengumuman" /></Card>
          )}
        </div>
      </div>
    </>
  );
}
