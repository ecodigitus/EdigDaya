import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, SectionTitle, Icon } from "../../components/ui";
import { angka } from "../../lib/format";

type Overview = { member: { poin: number; lencana: string | null; skor_keterlibatan: number } };

const MISI = [
  { label: "Setor simpanan wajib", poin: 50 },
  { label: "Hadir kegiatan koperasi", poin: 100 },
  { label: "Ikut voting e-RAT", poin: 150 },
];

export function WaMisi() {
  const { data, isLoading } = useApi<Overview>(["anggota-wa/overview"], "/api/anggota-wa/overview");
  const m = data?.member;

  return (
    <>
      <PageHeader title="Poin & Misi" desc="Keterlibatan Anda di koperasi." />
      {isLoading ? (
        <Card className="h-40 animate-pulse" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat icon="stars" label="Poin" value={angka(m?.poin)} />
            <Stat icon="military_tech" label="Lencana" value={m?.lencana || "—"} />
            <Stat icon="insights" label="Skor Keterlibatan" value={`${angka(m?.skor_keterlibatan)}/100`} />
          </div>

          <Card className="mt-4 p-4">
            <SectionTitle>Misi Minggu Ini</SectionTitle>
            <ul className="mt-2 divide-y divide-line">
              {MISI.map((x) => (
                <li key={x.label} className="flex items-center gap-3 py-3">
                  <span className="grid place-items-center size-8 rounded-full bg-surface-2 text-muted shrink-0">
                    <Icon name="radio_button_unchecked" size={18} />
                  </span>
                  <span className="flex-1 text-sm text-ink">{x.label}</span>
                  <span className="text-xs font-semibold text-primary">+{x.poin} poin</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted mt-2">
              Selesaikan misi lewat chat WhatsApp bot untuk mengumpulkan poin & bonus SHU.
            </p>
          </Card>
        </>
      )}
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
