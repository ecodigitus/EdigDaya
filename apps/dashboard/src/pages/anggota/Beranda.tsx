import { Link } from "react-router-dom";
import { useApi } from "../../lib/useApi";
import { Card, SectionTitle, StatusPill, EmptyState, Icon } from "../../components/ui";
import { qrDataUrl } from "../../lib/qr";
import { rupiah, angka, tanggalWaktu } from "../../lib/format";

type Overview = {
  profil: {
    anggota_ref: string;
    nama: string;
    nik: string;
    status_keanggotaan: string;
    status_akun: string;
    pekerjaan: string;
    nama_koperasi: string;
  };
  saldo: { paid: number; unpaid: number; n_unpaid: number };
  byJenis: { jenis: string; paid: number }[];
  riwayat: { periode_pembayaran: string; jenis: string; jumlah: number; status: string; dibayar_pada: string }[];
};

export function AnggotaBeranda() {
  const { data, isLoading } = useApi<Overview>(["anggota/overview"], "/api/anggota/overview");
  const akun = useApi<{ bisa_aktivasi: boolean; aktif_platform: boolean }>(["anggota/akun"], "/api/anggota/akun");

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-52 animate-pulse" />
        ))}
      </div>
    );
  }

  const p = data.profil;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">Halo, {p.nama} 👋</h1>
        <p className="text-sm text-muted">{p.nama_koperasi}</p>
      </div>

      {akun.data?.bisa_aktivasi ? (
        <Link
          to="/referral"
          className="mb-4 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4 hover:bg-accent/10 transition"
        >
          <span className="grid place-items-center size-10 rounded-lg bg-accent text-accent-fg shrink-0">
            <Icon name="rocket_launch" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Aktifkan Akun Digital Anda</p>
            <p className="text-sm text-muted">Dapatkan kode referral + bonus SHU, dan jadi bagian dari transformasi digital koperasi.</p>
          </div>
          <Icon name="arrow_forward" className="text-accent" />
        </Link>
      ) : akun.data?.aktif_platform ? (
        <Link
          to="/referral"
          className="mb-4 flex items-center gap-3 rounded-xl border border-ok/30 bg-ok-bg p-3 hover:opacity-90 transition"
        >
          <span className="grid place-items-center size-9 rounded-lg bg-ok text-white shrink-0">
            <Icon name="verified" size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink text-sm">Akun digital aktif ✓</p>
            <p className="text-xs text-muted">Lihat kode referral & bonus SHU Anda.</p>
          </div>
          <Icon name="arrow_forward" className="text-ok" />
        </Link>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Savings hero */}
        <div className="rounded-2xl p-5 lg:col-span-2 bg-primary text-primary-fg shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-primary-fg/80">Total Simpanan (lunas)</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums">{rupiah(data.saldo.paid)}</p>
          {data.saldo.unpaid > 0 && (
            <p className="mt-1 text-sm text-primary-fg/80">
              Tunggakan {rupiah(data.saldo.unpaid)} · {angka(data.saldo.n_unpaid)} periode
            </p>
          )}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {["Simpanan Pokok", "Simpanan Wajib", "Simpanan Sukarela"].map((j) => {
              const v = data.byJenis.find((x) => x.jenis === j)?.paid ?? 0;
              return (
                <div key={j} className="rounded-lg bg-white/10 p-3">
                  <p className="text-[11px] text-primary-fg/70">{j.replace("Simpanan ", "")}</p>
                  <p className="mt-0.5 font-bold tabular-nums text-sm">{rupiah(v)}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Member card with QR */}
        <Card className="p-5 flex flex-col items-center text-center">
          <SectionTitle>Kartu Anggota</SectionTitle>
          <div className="rounded-lg bg-white p-2 border border-line">
            <img
              src={qrDataUrl(p.anggota_ref, 4, 1)}
              alt={`QR ${p.anggota_ref}`}
              width={144}
              height={144}
              className="w-36 h-36"
            />
          </div>
          <p className="mt-3 font-semibold text-ink">{p.nama}</p>
          <p className="text-xs text-muted">{p.anggota_ref}</p>
          <div className="mt-2">
            <StatusPill status={p.status_keanggotaan === "Approved" ? "Aktif" : p.status_keanggotaan} />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="p-4 pb-0"><SectionTitle>Riwayat Simpanan Terbaru</SectionTitle></div>
        {data.riwayat.length === 0 ? (
          <EmptyState icon="savings" title="Belum ada riwayat" />
        ) : (
          <ul className="divide-y divide-line">
            {data.riwayat.map((r, i) => (
              <li key={r.periode_pembayaran + i} className="flex items-center gap-3 px-4 py-3">
                <span className={`grid place-items-center size-9 rounded-full ${r.status === "PAID" ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"}`}>
                  <Icon name={r.status === "PAID" ? "arrow_downward" : "schedule"} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{r.periode_pembayaran}</p>
                  <p className="text-xs text-muted">{tanggalWaktu(r.dibayar_pada)}</p>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${r.status === "PAID" ? "text-ok" : "text-muted"}`}>
                  {rupiah(r.jumlah)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
