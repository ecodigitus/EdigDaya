import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../lib/useApi";
import { api } from "../../lib/api";
import { PageHeader, Select } from "../../components/page";
import { Card, Button, StatusPill, SectionTitle, EmptyState } from "../../components/ui";
import { DataTable } from "../../components/table";
import { tanggalWaktu } from "../../lib/format";

const KATEGORI = ["Keuangan", "Pelayanan", "Kepengurusan", "Aset", "Lainnya"];

type T = { id: number; kategori: string; isi: string; anonim: boolean; status: string; created_at: string };

export function AnggotaTransparansi() {
  const qc = useQueryClient();
  const { data, isLoading } = useApi<{ data: T[] }>(["anggota/transparansi"], "/api/anggota/transparansi");
  const [kategori, setKategori] = useState("Keuangan");
  const [isi, setIsi] = useState("");
  const [anonim, setAnonim] = useState(false);

  const kirim = useMutation({
    mutationFn: () => api("/api/anggota/transparansi", { method: "POST", body: { kategori, isi, anonim } }),
    onSuccess: () => {
      setIsi("");
      qc.invalidateQueries({ queryKey: ["anggota/transparansi"] });
    },
  });

  return (
    <>
      <PageHeader title="Transparansi" desc="Sampaikan aspirasi/aduan. Laporan tersimpan permanen (tamper-proof)." />
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="p-5 h-fit">
          <SectionTitle>Kirim Laporan</SectionTitle>
          <Select value={kategori} onChange={setKategori} options={KATEGORI.map((k) => ({ value: k, label: k }))} className="w-full mb-3" />
          <textarea value={isi} onChange={(e) => setIsi(e.target.value)} placeholder="Tulis laporan Anda…" rows={4}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink mb-3" />
          <label className="flex items-center gap-2 text-sm text-ink mb-3">
            <input type="checkbox" checked={anonim} onChange={(e) => setAnonim(e.target.checked)} /> Kirim sebagai anonim
          </label>
          <Button variant="accent" className="w-full" disabled={!isi.trim() || kirim.isPending} onClick={() => kirim.mutate()}>
            {kirim.isPending ? "Mengirim…" : "Kirim Laporan"}
          </Button>
          {kirim.isSuccess && <p className="text-ok text-sm mt-2">Laporan terkirim & tersimpan permanen.</p>}
        </Card>

        <Card>
          <div className="p-4 pb-0"><SectionTitle>Laporan Saya</SectionTitle></div>
          <DataTable
            loading={isLoading}
            rows={data?.data ?? []}
            keyOf={(r) => String(r.id)}
            empty={<EmptyState icon="flag" title="Belum ada laporan" desc="Anda belum mengirim laporan." />}
            columns={[
              { key: "kategori", header: "Kategori", render: (r) => r.kategori },
              { key: "isi", header: "Isi", render: (r) => <span className="line-clamp-2 max-w-xs inline-block">{r.isi}</span> },
              { key: "tgl", header: "Waktu", render: (r) => tanggalWaktu(r.created_at) },
              { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
