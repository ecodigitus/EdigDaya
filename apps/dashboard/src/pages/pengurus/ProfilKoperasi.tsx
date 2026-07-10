import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, KpiCard, SectionTitle, StatusPill, EmptyState, FullscreenLoader } from "../../components/ui";
import { DataTable } from "../../components/table";
import { angka } from "../../lib/format";

type Resp = {
  profil: {
    koperasi_ref: string;
    nama_koperasi: string;
    status_registrasi: string;
    bentuk_koperasi: string;
    kategori_usaha: string;
    nik_koperasi: string;
    alamat_lengkap: string;
    kode_pos: string;
    modal_awal: string;
    tentang_koperasi: string;
  };
  pengurus: { pengurus_ref: string; nama: string; jabatan: string; status: string; no_hp: string; jenis_kelamin: string }[];
  karyawan: { karyawan_ref: string; nama: string; jabatan: string; nomor_hp_karyawan: string; status_karyawan: string }[];
  counts: { aset: number; modal: number; dokumen: number; kbli: number };
};

export function PengurusProfilKoperasi() {
  const { data, isLoading } = useApi<Resp>(["pengurus/profil"], "/api/pengurus/profil");
  if (isLoading) return <FullscreenLoader />;
  if (!data) return <EmptyState icon="error" title="Profil tidak ditemukan" />;
  const p = data.profil;

  return (
    <>
      <PageHeader title="Profil Koperasi" desc="Identitas, pengurus, dan karyawan koperasi." />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-ink">{p.nama_koperasi}</h2>
            <p className="text-sm text-muted">{p.koperasi_ref}</p>
          </div>
          <StatusPill status={p.status_registrasi} />
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 mt-5 text-sm">
          <Info label="Bentuk" value={p.bentuk_koperasi} />
          <Info label="Kategori Usaha" value={p.kategori_usaha} />
          <Info label="NIK Koperasi" value={p.nik_koperasi} />
          <Info label="Modal Awal" value={p.modal_awal} />
          <Info label="Kode Pos" value={p.kode_pos} />
          <Info label="Alamat" value={p.alamat_lengkap} />
        </dl>
        {p.tentang_koperasi && <p className="mt-4 text-sm text-muted border-t border-line pt-3">{p.tentang_koperasi}</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mt-4">
        <KpiCard label="Pengurus" value={angka(data.pengurus.length)} icon="groups" />
        <KpiCard label="Karyawan" value={angka(data.karyawan.length)} icon="badge" tone="accent" />
        <KpiCard label="Aset" value={angka(data.counts.aset)} icon="apartment" />
        <KpiCard label="Dokumen" value={angka(data.counts.dokumen)} icon="folder" tone="primary" sub={`${angka(data.counts.kbli)} KBLI · ${angka(data.counts.modal)} modal`} />
      </div>

      <Card className="mt-4">
        <div className="p-4 pb-0"><SectionTitle>Pengurus</SectionTitle></div>
        <DataTable
          rows={data.pengurus}
          keyOf={(r) => r.pengurus_ref}
          empty={<EmptyState icon="groups" title="Belum ada pengurus" />}
          columns={[
            { key: "nama", header: "Nama", render: (r) => r.nama ?? "—" },
            { key: "jabatan", header: "Jabatan", render: (r) => r.jabatan ?? "—" },
            { key: "jk", header: "Gender", render: (r) => (r.jenis_kelamin === "LAKI-LAKI" ? "L" : r.jenis_kelamin === "PEREMPUAN" ? "P" : "—") },
            { key: "hp", header: "No. HP", render: (r) => r.no_hp ?? "—" },
            { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
          ]}
        />
      </Card>

      <Card className="mt-4">
        <div className="p-4 pb-0"><SectionTitle>Karyawan</SectionTitle></div>
        <DataTable
          rows={data.karyawan}
          keyOf={(r) => r.karyawan_ref}
          empty={<EmptyState icon="badge" title="Belum ada karyawan" />}
          columns={[
            { key: "nama", header: "Nama", render: (r) => r.nama ?? "—" },
            { key: "jabatan", header: "Jabatan", render: (r) => r.jabatan ?? "—" },
            { key: "hp", header: "No. HP", render: (r) => r.nomor_hp_karyawan ?? "—" },
            { key: "status", header: "Status", render: (r) => <StatusPill status={r.status_karyawan} /> },
          ]}
        />
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-ink mt-0.5 break-words">{value || "—"}</dd>
    </div>
  );
}
