import { useState } from "react";
import { useApi } from "../../lib/useApi";
import { PageHeader, SearchInput } from "../../components/page";
import { Card } from "../../components/ui";
import { DataTable, Pagination } from "../../components/table";
import { rupiah, angka, tanggalWaktu } from "../../lib/format";

type Row = {
  no_anggota: string;
  nama: string;
  phone: string | null;
  role: string;
  kode_referral: string | null;
  poin: number;
  estimasi_shu: number;
  total_simpanan: number;
  diaktifkan_pada: string | null;
  updated_at: string;
};

export function PengurusAnggotaDigital() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const qs = `?q=${encodeURIComponent(q)}&page=${page}&limit=20`;
  const { data, isLoading } = useApi<{ data: Row[]; total: number; page: number; limit: number }>(
    ["pengurus/anggota-digital", q, page],
    `/api/pengurus/anggota-digital${qs}`,
  );

  const onSearch = (v: string) => {
    setQ(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Anggota Digital"
        desc="Anggota yang punya akun digital / mendaftar lewat WhatsApp bot (tabel edig_dev_members)."
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">
          <SearchInput
            value={q}
            onChange={onSearch}
            placeholder="Cari nama / no. anggota / no. HP…"
            className="flex-1 min-w-[200px]"
          />
        </div>
        <DataTable
          loading={isLoading}
          rows={data?.data ?? []}
          keyOf={(r) => r.no_anggota}
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
            { key: "phone", header: "No. HP", render: (r) => r.phone ?? "—" },
            { key: "referral", header: "Kode Referral", render: (r) => r.kode_referral ?? "—" },
            { key: "poin", header: "Poin", render: (r) => angka(r.poin) },
            { key: "shu", header: "Estimasi SHU", render: (r) => rupiah(r.estimasi_shu) },
            { key: "simpanan", header: "Total Simpanan", render: (r) => rupiah(r.total_simpanan) },
            { key: "update", header: "Update Terakhir", render: (r) => tanggalWaktu(r.updated_at) },
          ]}
        />
        <Pagination page={data?.page ?? page} limit={data?.limit ?? 20} total={data?.total ?? 0} onPage={setPage} />
      </Card>
    </>
  );
}
