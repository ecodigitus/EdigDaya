import { useState } from "react";
import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, StatusPill, EmptyState } from "../../components/ui";
import { DataTable, type Column } from "../../components/table";
import { rupiah, tanggal } from "../../lib/format";

const JENIS = [
  { v: "pembiayaan", l: "Pembiayaan" },
  { v: "kemitraan", l: "Kemitraan" },
  { v: "domain", l: "Domain" },
  { v: "rekening", l: "Rekening Bank" },
];

const COLUMNS: Record<string, Column<any>[]> = {
  pembiayaan: [
    { key: "pj", header: "Penanggung Jawab", render: (r) => r.penanggung_jawab ?? "—" },
    { key: "tujuan", header: "Tujuan", render: (r) => r.tujuan_permohonan ?? "—" },
    { key: "nominal", header: "Nominal", align: "right", render: (r) => rupiah(r.nominal) },
    { key: "tenor", header: "Tenor", align: "right", render: (r) => (r.tenor != null ? `${r.tenor} bln` : "—") },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "tgl", header: "Tanggal", render: (r) => tanggal(r.dibuat_pada) },
  ],
  kemitraan: [
    { key: "pj", header: "Penanggung Jawab", render: (r) => r.penanggung_jawab ?? "—" },
    { key: "bisnis", header: "Bisnis", render: (r) => r.bisnis_kemitraan ?? "—" },
    { key: "paket", header: "Paket", render: (r) => r.paket_kemitraan ?? "—" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "tgl", header: "Tanggal", render: (r) => tanggal(r.dibuat_pada) },
  ],
  domain: [
    { key: "domain", header: "Domain", render: (r) => r.domain_koperasi ?? "—" },
    { key: "verif", header: "Verifikasi", render: (r) => <StatusPill status={r.status_verifikasi} /> },
    { key: "status", header: "Status Domain", render: (r) => <StatusPill status={r.status} /> },
    { key: "tgl", header: "Tanggal", render: (r) => tanggal(r.dibuat_pada) },
  ],
  rekening: [
    { key: "pj", header: "Penanggung Jawab", render: (r) => r.penanggung_jawab ?? "—" },
    { key: "bank", header: "Bank", render: (r) => r.nama_bank ?? r.kode_bank ?? "—" },
    { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "tgl", header: "Tanggal", render: (r) => tanggal(r.dibuat_pada) },
  ],
};

export function PengurusPengajuan() {
  const [jenis, setJenis] = useState("pembiayaan");
  const { data, isLoading } = useApi<{ jenis: string; data: any[]; summary: { status: string; n: number }[] }>(
    ["pengurus/pengajuan", jenis],
    `/api/pengurus/pengajuan?jenis=${jenis}`,
  );

  return (
    <>
      <PageHeader title="Pengajuan" desc="Permohonan pembiayaan, kemitraan, domain, dan rekening bank." />
      <div className="flex flex-wrap gap-2 mb-4">
        {JENIS.map((j) => (
          <button
            key={j.v}
            onClick={() => setJenis(j.v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              jenis === j.v ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted hover:text-ink"
            }`}
          >
            {j.l}
          </button>
        ))}
      </div>

      {data?.summary && data.summary.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {data.summary.map((s) => (
            <span key={s.status} className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs border border-line">
              <StatusPill status={s.status} />
              <span className="tabular-nums font-semibold text-ink">{s.n}</span>
            </span>
          ))}
        </div>
      )}

      <Card>
        <DataTable
          loading={isLoading}
          rows={data?.data ?? []}
          keyOf={(r, i) => r.ref ?? String(i)}
          columns={COLUMNS[jenis]!}
          empty={<EmptyState icon="assignment" title="Belum ada pengajuan" desc="Tidak ada permohonan untuk kategori ini." />}
        />
      </Card>
    </>
  );
}
