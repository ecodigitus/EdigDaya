import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, Avatar, StatusPill, FullscreenLoader, EmptyState } from "../../components/ui";
import { tanggal } from "../../lib/format";

type Resp = {
  anggota: {
    anggota_ref: string;
    nama: string;
    nik: string;
    jenis_kelamin: string;
    status_keanggotaan: string;
    status_akun: string;
    pekerjaan: string;
    tanggal_terdaftar: string;
    provinsi?: string;
    kab_kota?: string;
    kecamatan?: string;
    desa_kelurahan?: string;
    nama_koperasi?: string;
    koperasi_alamat?: string;
  };
};

export function AnggotaProfil() {
  const { data, isLoading } = useApi<Resp>(["anggota/profil"], "/api/anggota/profil");
  if (isLoading) return <FullscreenLoader />;
  if (!data) return <EmptyState icon="error" title="Profil tidak ditemukan" />;
  const a = data.anggota;
  const wilayah = [a.desa_kelurahan, a.kecamatan, a.kab_kota, a.provinsi].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader title="Profil Saya" desc="Data keanggotaan Anda di koperasi." />
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={a.nama} className="size-16 text-xl shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-ink">{a.nama}</h2>
            <p className="text-sm text-muted">{a.anggota_ref}</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusPill status={a.status_keanggotaan === "Approved" ? "Aktif" : a.status_keanggotaan} />
              <span className="text-xs text-muted">{a.status_akun}</span>
            </div>
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 mt-6 text-sm">
          <Info label="NIK" value={a.nik} />
          <Info label="Gender" value={a.jenis_kelamin === "LAKI-LAKI" ? "Laki-laki" : "Perempuan"} />
          <Info label="Pekerjaan" value={a.pekerjaan} />
          <Info label="Terdaftar" value={tanggal(a.tanggal_terdaftar)} />
          <Info label="Wilayah" value={wilayah} />
          <Info label="Koperasi" value={a.nama_koperasi} />
        </dl>
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-ink mt-0.5">{value || "—"}</dd>
    </div>
  );
}
