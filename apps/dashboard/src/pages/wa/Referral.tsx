import { useState } from "react";
import { useApi } from "../../lib/useApi";
import { PageHeader } from "../../components/page";
import { Card, Button, Icon, SectionTitle, FullscreenLoader } from "../../components/ui";
import { qrDataUrl } from "../../lib/qr";
import { rupiah, angka } from "../../lib/format";

type Referral = {
  kode_referral?: string;
  poin?: number;
  estimasi_shu?: number;
  jumlah_referral?: number;
  reward_per_referral?: { poin: number; bonus_shu: number };
};

export function WaReferral() {
  const { data, isLoading } = useApi<Referral>(["anggota-wa/referral"], "/api/anggota-wa/referral");
  const [copied, setCopied] = useState(false);

  if (isLoading) return <FullscreenLoader />;

  const r = data;
  const reward = r?.reward_per_referral;
  const kode = r?.kode_referral ?? "";

  return (
    <>
      <PageHeader title="Referral" desc="Bagikan kode Anda — kumpulkan poin & bonus SHU." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle>Kode Referral Anda</SectionTitle>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <code className="text-2xl font-extrabold tracking-wider text-primary bg-primary/5 rounded-lg px-4 py-2">
              {kode || "—"}
            </code>
            {kode && (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(kode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                <Icon name={copied ? "check" : "content_copy"} size={18} /> {copied ? "Tersalin" : "Salin"}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <Stat label="Referral" value={angka(r?.jumlah_referral)} />
            <Stat label="Poin" value={angka(r?.poin)} />
            <Stat label="Bonus SHU" value={rupiah(r?.estimasi_shu)} />
          </div>
          {reward && (
            <p className="text-xs text-muted mt-4">
              Tiap referral sukses: +{reward.poin} poin & {rupiah(reward.bonus_shu)} bonus SHU.
              Ajak anggota lain lewat chat WhatsApp bot.
            </p>
          )}
        </Card>

        <Card className="p-6 flex flex-col items-center text-center">
          <SectionTitle>Bagikan via QR</SectionTitle>
          {kode ? (
            <>
              <div className="rounded-lg bg-white p-2 border border-line mt-1">
                <img src={qrDataUrl(kode, 4, 1)} alt={`QR ${kode}`} width={144} height={144} className="w-36 h-36" />
              </div>
              <p className="mt-3 text-xs text-muted">Tunjukkan QR ini untuk membagikan kode referral Anda.</p>
            </>
          ) : (
            <p className="text-sm text-muted mt-2">Kode referral belum tersedia.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-bold text-ink tabular-nums">{value}</p>
    </div>
  );
}
