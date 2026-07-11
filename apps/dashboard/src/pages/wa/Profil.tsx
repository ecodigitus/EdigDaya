import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, Avatar, StatusPill, SectionTitle, FullscreenLoader, EmptyState } from "../../components/ui";
import { rupiah, angka, tanggalWaktu } from "../../lib/format";

type Ktp = {
  tempatTglLahir?: string;
  golDarah?: string;
  alamat?: string;
  rtRw?: string;
  kelDesa?: string;
  agama?: string;
  statusPerkawinan?: string;
  pekerjaan?: string;
  kewarganegaraan?: string;
};
type Pendaftaran = {
  nik?: string;
  jenisKelamin?: string;
  email?: string;
  nomorHp?: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  desa?: string;
  ktp?: Ktp;
};
type Overview = {
  member: {
    no_anggota: string;
    nama: string;
    phone: string | null;
    role: string;
    sejak: string | null;
    kode_referral: string | null;
    lencana: string | null;
    poin: number;
    estimasi_shu: number;
    skor_keterlibatan: number;
    updated_at: string;
    pendaftaran?: Pendaftaran | null;
  };
};

export function WaProfil() {
  const { data, isLoading } = useApi<Overview>(["anggota-wa/overview"], "/api/anggota-wa/overview");
  if (isLoading) return <FullscreenLoader />;
  if (!data) return <EmptyState icon="error" title="Profil tidak ditemukan" />;
  const m = data.member;
  const roleLabel = m.role === "produsen" ? "Produsen" : "Anggota";

  return (
    <>
      <PageHeader title="Profil Saya" desc="Data akun digital Anda (via WhatsApp)." />
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={m.nama} className="size-16 text-xl shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-ink">{m.nama}</h2>
            <p className="text-sm text-muted">{m.no_anggota}</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusPill status="Aktif" />
              <span className="text-xs text-muted">{roleLabel}</span>
            </div>
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 mt-6 text-sm">
          <Info label="No. Anggota" value={m.no_anggota} />
          <Info label="No. HP" value={m.phone} />
          <Info label="Bergabung sejak" value={m.sejak} />
          <Info label="Lencana" value={m.lencana} />
          <Info label="Kode Referral" value={m.kode_referral} />
          <Info label="Poin" value={angka(m.poin)} />
          <Info label="Estimasi SHU" value={rupiah(m.estimasi_shu)} />
          <Info label="Skor Keterlibatan" value={angka(m.skor_keterlibatan)} />
          <Info label="Update terakhir" value={tanggalWaktu(m.updated_at)} />
        </dl>
      </Card>

      {m.pendaftaran && <KtpCard p={m.pendaftaran} />}
    </>
  );
}

function KtpCard({ p }: { p: Pendaftaran }) {
  const k: Ktp = p.ktp ?? {};
  const wilayah = [p.desa, p.kecamatan, p.kabupaten, p.provinsi].filter(Boolean).join(", ");
  return (
    <Card className="mt-4 p-5">
      <SectionTitle>Data Pribadi (KTP)</SectionTitle>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 mt-3 text-sm">
        <Info label="NIK" value={maskNik(p.nik)} />
        <Info label="Jenis Kelamin" value={p.jenisKelamin} />
        <Info label="Tempat/Tgl Lahir" value={k.tempatTglLahir} />
        <Info label="Gol. Darah" value={k.golDarah} />
        <Info label="Agama" value={k.agama} />
        <Info label="Status Perkawinan" value={k.statusPerkawinan} />
        <Info label="Pekerjaan" value={k.pekerjaan} />
        <Info label="Kewarganegaraan" value={k.kewarganegaraan} />
        <Info label="Email" value={p.email} />
        <Info label="No. HP" value={p.nomorHp} />
        <Info label="Alamat KTP" value={[k.alamat, k.rtRw ? `RT/RW ${k.rtRw}` : "", k.kelDesa].filter(Boolean).join(", ")} />
        <Info label="Wilayah" value={wilayah} />
      </dl>
    </Card>
  );
}

/** Samarkan NIK (4 digit terakhir) — UU PDP. */
function maskNik(nik?: string): string {
  if (!nik) return "—";
  return `${"•".repeat(Math.max(0, nik.length - 4))}${nik.slice(-4)}`;
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-ink mt-0.5">{value || "—"}</dd>
    </div>
  );
}
