import { useApi } from "../../lib/useApi";
import { Card, SectionTitle, Icon } from "../../components/ui";
import { qrDataUrl } from "../../lib/qr";
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
    simpanan_pokok: number;
    simpanan_wajib: number;
    simpanan_sukarela: number;
    updated_at: string;
  };
  total_simpanan: number;
};

export function WaBeranda() {
  const { data, isLoading } = useApi<Overview>(["anggota-wa/overview"], "/api/anggota-wa/overview");

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-52 animate-pulse" />
        ))}
      </div>
    );
  }

  const m = data.member;
  const jenis: [string, number][] = [
    ["Pokok", m.simpanan_pokok],
    ["Wajib", m.simpanan_wajib],
    ["Sukarela", m.simpanan_sukarela],
  ];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink">Halo, {m.nama} 👋</h1>
        <p className="text-sm text-muted">
          Akun digital via WhatsApp · {m.no_anggota}
          {m.role === "produsen" ? " · Produsen" : ""}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Savings hero */}
        <div className="rounded-2xl p-5 lg:col-span-2 bg-primary text-primary-fg shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-primary-fg/80">Total Simpanan</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums">{rupiah(data.total_simpanan)}</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {jenis.map(([label, v]) => (
              <div key={label} className="rounded-lg bg-white/10 p-3">
                <p className="text-[11px] text-primary-fg/70">{label}</p>
                <p className="mt-0.5 font-bold tabular-nums text-sm">{rupiah(v)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Member card with QR */}
        <Card className="p-5 flex flex-col items-center text-center">
          <SectionTitle>Kartu Anggota</SectionTitle>
          <div className="rounded-lg bg-white p-2 border border-line">
            <img
              src={qrDataUrl(m.no_anggota, 4, 1)}
              alt={`QR ${m.no_anggota}`}
              width={144}
              height={144}
              className="w-36 h-36"
            />
          </div>
          <p className="mt-3 font-semibold text-ink">{m.nama}</p>
          <p className="text-xs text-muted">{m.no_anggota}</p>
          {m.phone && <p className="text-xs text-muted mt-0.5">{m.phone}</p>}
        </Card>
      </div>

      {/* Reward / engagement */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat icon="stars" label="Poin" value={angka(m.poin)} />
        <Stat icon="savings" label="Estimasi SHU" value={rupiah(m.estimasi_shu)} />
        <Stat icon="share" label="Kode Referral" value={m.kode_referral ?? "—"} />
      </div>

      <Card className="mt-4 p-4">
        <SectionTitle>Info Akun</SectionTitle>
        <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted">Bergabung sejak</dt>
          <dd className="text-ink text-right">{m.sejak ?? "—"}</dd>
          <dt className="text-muted">Lencana</dt>
          <dd className="text-ink text-right">{m.lencana || "—"}</dd>
          <dt className="text-muted">Skor keterlibatan</dt>
          <dd className="text-ink text-right">{angka(m.skor_keterlibatan)}</dd>
          <dt className="text-muted">Update terakhir</dt>
          <dd className="text-ink text-right">{tanggalWaktu(m.updated_at)}</dd>
        </dl>
      </Card>
    </>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className="grid place-items-center size-10 rounded-lg bg-primary/10 text-primary shrink-0">
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="font-bold text-ink truncate">{value}</p>
      </div>
    </Card>
  );
}
