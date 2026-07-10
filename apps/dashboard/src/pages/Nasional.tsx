import { Link } from "react-router-dom";
import { useApi } from "../lib/useApi";
import { Card, KpiCard, SectionTitle, Icon, FullscreenLoader } from "../components/ui";
import { BarList, Donut, Meter } from "../components/charts";
import { angka, rupiah, rupiahShort, persen } from "../lib/format";

type Overview = {
  koperasi: { total: number };
  anggota: { total: number; tanpa_akun: number; punya_akun: number; approved: number; requested: number; laki: number; perempuan: number };
  digital: { simkopdes: number; platform: number; total_digital: number; belum: number; gap_pct: number; gap_awal_pct: number };
  simpanan: { paid: number; unpaid: number; n_paid: number; n_unpaid: number };
  gerai: { total: number; aktif: number };
  produk: { total: number };
  transaksi: { total: number; nilai: number };
  rat: { status: string; n: number }[];
  provinsi: { provinsi: string; anggota: number }[];
  provinsi_count: number;
  kemitraan: { status: string; n: number }[];
  generated_at: string;
};

export function Nasional() {
  const { data, isLoading } = useApi<Overview>(["nasional/overview"], "/api/nasional/overview");
  if (isLoading || !data) return <FullscreenLoader label="Menghitung agregat nasional…" />;

  const a = data.anggota;
  const dig = data.digital;
  const collTotal = data.simpanan.paid + data.simpanan.unpaid;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center size-9 rounded-lg bg-red-600 text-white">
              <Icon name="account_balance" size={20} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold">Dashboard Nasional</p>
              <p className="text-[11px] text-slate-500">Koperasi Merah Putih</p>
            </div>
          </div>
          <Link to="/" className="text-sm font-semibold text-red-700 hover:text-red-800 inline-flex items-center gap-1">
            Masuk Dashboard <Icon name="arrow_forward" size={16} />
          </Link>
        </div>
      </header>

      {/* Hero — the "scale of the problem" for jury / government */}
      <section className="bg-gradient-to-br from-red-600 to-red-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-white/70">Skala Nasional · Bukti Data</p>
          <div className="mt-3 grid gap-8 lg:grid-cols-[auto_1fr] lg:items-end">
            <div>
              <p className="text-6xl md:text-7xl font-extrabold tabular-nums leading-none">{persen(dig.gap_pct)}</p>
              <p className="mt-2 max-w-md text-lg text-white/90">
                anggota koperasi <strong>belum memiliki akun digital</strong> — {angka(dig.belum)} dari {angka(a.total)} anggota di {angka(data.koperasi.total)} koperasi.
              </p>
              {dig.platform > 0 && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm">
                  <Icon name="trending_down" size={16} /> {angka(dig.platform)} anggota di-onboarding lewat platform (dari {persen(dig.gap_awal_pct)})
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:justify-items-end">
              <HeroStat value={angka(data.koperasi.total)} label="Koperasi" />
              <HeroStat value={angka(a.total)} label="Anggota" />
              <HeroStat value={angka(data.provinsi_count)} label="Provinsi" />
              <HeroStat value={rupiahShort(data.simpanan.paid)} label="Simpanan" />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* KPI */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Koperasi" value={angka(data.koperasi.total)} icon="hub" />
          <KpiCard label="Total Anggota" value={angka(a.total)} icon="group" tone="accent"
            sub={`${angka(a.approved)} aktif · ${angka(a.requested)} menunggu`} />
          <KpiCard label="Simpanan Terkumpul" value={rupiahShort(data.simpanan.paid)} icon="savings" tone="ok"
            sub={`${angka(data.simpanan.n_paid)} setoran lunas`} />
          <KpiCard label="Gerai Aktif" value={angka(data.gerai.aktif)} icon="storefront" tone="primary"
            sub={`dari ${angka(data.gerai.total)} gerai`} />
        </div>

        {/* Digital adoption + collection + gender */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <SectionTitle>Adopsi Akun Digital</SectionTitle>
            <Donut
              segments={[
                { label: "Belum digital", value: dig.belum, color: "#dc2626" },
                { label: "Digital (simkopdes)", value: dig.simkopdes, color: "#16a34a" },
                { label: "Onboarding platform", value: dig.platform, color: "#2563eb" },
              ]}
              centerValue={persen(dig.gap_pct)}
              centerLabel="belum digital"
              format={(v) => angka(v)}
            />
          </Card>
          <Card className="p-4">
            <SectionTitle>Tingkat Penagihan Simpanan (Nasional)</SectionTitle>
            <Meter value={data.simpanan.paid} total={collTotal} valueLabel="Lunas" restLabel="Tunggakan" format={rupiahShort} />
            <p className="mt-3 text-xs text-slate-500">
              {angka(data.simpanan.n_paid)} setoran lunas dari {angka(data.simpanan.n_paid + data.simpanan.n_unpaid)} total setoran.
            </p>
          </Card>
          <Card className="p-4">
            <SectionTitle>Komposisi Gender</SectionTitle>
            <Donut
              segments={[
                { label: "Laki-laki", value: a.laki },
                { label: "Perempuan", value: a.perempuan, color: "#d97706" },
              ]}
              centerValue={angka(a.total)}
              centerLabel="anggota"
              format={angka}
            />
          </Card>
        </div>

        {/* Province distribution */}
        <Card className="p-4">
          <SectionTitle>Sebaran Anggota per Provinsi (Top 12)</SectionTitle>
          <BarList items={data.provinsi.slice(0, 12).map((p) => ({ label: p.provinsi, value: p.anggota }))} format={angka} />
          <p className="mt-3 text-xs text-slate-500">Menjangkau {angka(data.provinsi_count)} provinsi.</p>
        </Card>

        {/* RAT + Kemitraan */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <SectionTitle>Status RAT Koperasi</SectionTitle>
            <BarList items={data.rat.map((r) => ({ label: r.status, value: r.n }))} format={angka} />
          </Card>
          <Card className="p-4">
            <SectionTitle>Pengajuan Kemitraan</SectionTitle>
            <BarList items={data.kemitraan.map((k) => ({ label: k.status, value: k.n }))} format={angka} />
          </Card>
        </div>

        <p className="text-center text-xs text-slate-400">
          Sumber: data Program Koperasi Merah Putih · {angka(data.koperasi.total)} koperasi ·
          transaksi usaha {rupiah(data.transaksi.nilai)} · diperbarui berkala.
        </p>
      </main>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3 w-full">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-white/70">{label}</p>
    </div>
  );
}
