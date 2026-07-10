import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../../lib/useApi";
import { PageHeader, SearchInput, Select } from "../../components/page";
import { Card, StatusPill } from "../../components/ui";
import { DataTable, Pagination } from "../../components/table";
import { tanggal } from "../../lib/format";

type Row = {
  anggota_ref: string;
  nama: string;
  nik: string;
  jenis_kelamin: string;
  status_keanggotaan: string;
  status_akun: string;
  pekerjaan: string;
  tanggal_terdaftar: string;
  kode_wilayah: string;
};

export function PengurusAnggota() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const qs = `?q=${encodeURIComponent(q)}&gender=${encodeURIComponent(gender)}&status=${encodeURIComponent(status)}&page=${page}&limit=20`;
  const { data, isLoading } = useApi<{ data: Row[]; total: number; page: number; limit: number }>(
    ["pengurus/anggota", q, gender, status, page],
    `/api/pengurus/anggota${qs}`,
  );

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="Daftar Anggota" desc="Direktori anggota koperasi." />
      <Card>
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">
          <SearchInput value={q} onChange={reset(setQ)} placeholder="Cari nama / NIK…" className="flex-1 min-w-[200px]" />
          <Select
            value={gender}
            onChange={reset(setGender)}
            options={[
              { value: "", label: "Semua gender" },
              { value: "LAKI-LAKI", label: "Laki-laki" },
              { value: "PEREMPUAN", label: "Perempuan" },
            ]}
          />
          <Select
            value={status}
            onChange={reset(setStatus)}
            options={[
              { value: "", label: "Semua status" },
              { value: "Approved", label: "Aktif" },
              { value: "Requested", label: "Menunggu" },
            ]}
          />
        </div>
        <DataTable
          loading={isLoading}
          rows={data?.data ?? []}
          keyOf={(r) => r.anggota_ref}
          onRowClick={(r) => nav(`/anggota/${encodeURIComponent(r.anggota_ref)}`)}
          columns={[
            {
              key: "nama",
              header: "Anggota",
              render: (r) => (
                <div className="min-w-0">
                  <p className="font-medium text-ink truncate">{r.nama}</p>
                  <p className="text-xs text-muted">{r.nik}</p>
                </div>
              ),
            },
            { key: "jk", header: "Gender", render: (r) => (r.jenis_kelamin === "LAKI-LAKI" ? "Laki-laki" : r.jenis_kelamin === "PEREMPUAN" ? "Perempuan" : "—") },
            { key: "pekerjaan", header: "Pekerjaan", render: (r) => r.pekerjaan ?? "—" },
            { key: "daftar", header: "Terdaftar", render: (r) => tanggal(r.tanggal_terdaftar) },
            { key: "status", header: "Status", render: (r) => <StatusPill status={r.status_keanggotaan === "Approved" ? "Aktif" : r.status_keanggotaan} /> },
          ]}
        />
        <Pagination page={data?.page ?? page} limit={data?.limit ?? 20} total={data?.total ?? 0} onPage={setPage} />
      </Card>
    </>
  );
}
