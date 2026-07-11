import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, SectionTitle, EmptyState, Icon } from "../../components/ui";
import { rupiah, angka } from "../../lib/format";

type Pinjaman = { sisa: number; angsuranPerBulan: number; tenorSisa: number };
type Overview = { member: { pinjaman: Pinjaman | null } };

export function WaPinjaman() {
  const { data, isLoading } = useApi<Overview>(["anggota-wa/overview"], "/api/anggota-wa/overview");
  const p = data?.member?.pinjaman ?? null;

  return (
    <>
      <PageHeader title="Pinjaman Saya" desc="Pinjaman aktif Anda di koperasi." />
      {isLoading ? (
        <Card className="h-40 animate-pulse" />
      ) : !p ? (
        <EmptyState
          icon="account_balance"
          title="Belum ada pinjaman aktif"
          desc="Anda tidak punya pinjaman berjalan saat ini. Ajukan pinjaman lewat chat WhatsApp bot."
        />
      ) : (
        <>
          <div className="rounded-2xl p-5 bg-primary text-primary-fg shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <p className="text-sm text-primary-fg/80">Sisa Pokok Pinjaman</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums">{rupiah(p.sisa)}</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Card className="p-4 flex items-center gap-3">
              <span className="grid place-items-center size-10 rounded-lg bg-primary/10 text-primary shrink-0">
                <Icon name="calendar_month" />
              </span>
              <div>
                <p className="text-xs text-muted">Angsuran / bulan</p>
                <p className="font-bold text-ink tabular-nums">{rupiah(p.angsuranPerBulan)}</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3">
              <span className="grid place-items-center size-10 rounded-lg bg-primary/10 text-primary shrink-0">
                <Icon name="event_repeat" />
              </span>
              <div>
                <p className="text-xs text-muted">Sisa tenor</p>
                <p className="font-bold text-ink tabular-nums">{angka(p.tenorSisa)}x lagi</p>
              </div>
            </Card>
          </div>
          <Card className="mt-4 p-4 flex items-start gap-3">
            <span className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
              <Icon name="chat" size={18} />
            </span>
            <div>
              <SectionTitle>Pembayaran & pengajuan</SectionTitle>
              <p className="text-sm text-muted mt-1">
                Angsuran dan pengajuan pinjaman baru dilakukan lewat chat WhatsApp bot koperasi.
                Data di sini mengikuti pinjaman terbaru dari akun WhatsApp Anda.
              </p>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
