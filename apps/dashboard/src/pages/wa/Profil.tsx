import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, Avatar, StatusPill, FullscreenLoader, EmptyState } from "../../components/ui";
import { rupiah, angka, tanggalWaktu } from "../../lib/format";

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
