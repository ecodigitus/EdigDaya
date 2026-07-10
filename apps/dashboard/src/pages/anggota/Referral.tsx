import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../../lib/useApi";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page";
import { Card, Button, Icon, SectionTitle, FullscreenLoader } from "../../components/ui";
import { rupiah, angka } from "../../lib/format";

type Akun = {
  status_simkopdes: string;
  aktif_platform: boolean;
  bisa_aktivasi: boolean;
  member: unknown;
};
type Referral = {
  enabled: boolean;
  aktif: boolean;
  kode_referral?: string;
  poin?: number;
  estimasi_shu?: number;
  jumlah_referral?: number;
  reward_per_referral?: { poin: number; bonus_shu: number };
};

export function AnggotaReferral() {
  const qc = useQueryClient();
  const akun = useApi<Akun>(["anggota/akun"], "/api/anggota/akun");
  const ref = useApi<Referral>(["anggota/referral"], "/api/anggota/referral");
  const [copied, setCopied] = useState(false);
  const [namaRef, setNamaRef] = useState("");

  const aktivasi = useMutation({
    mutationFn: () => api("/api/anggota/akun/aktivasi", { method: "POST", body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anggota/akun"] });
      qc.invalidateQueries({ queryKey: ["anggota/referral"] });
      qc.invalidateQueries({ queryKey: ["anggota/overview"] });
    },
  });
  const catat = useMutation({
    mutationFn: () => api("/api/anggota/referral/catat", { method: "POST", body: { nama: namaRef } }),
    onSuccess: () => {
      setNamaRef("");
      qc.invalidateQueries({ queryKey: ["anggota/referral"] });
    },
  });
  const nonaktif = useMutation({
    mutationFn: () => api("/api/anggota/akun/nonaktif", { method: "POST", body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anggota/akun"] });
      qc.invalidateQueries({ queryKey: ["anggota/referral"] });
      qc.invalidateQueries({ queryKey: ["anggota/overview"] });
    },
  });

  if (akun.isLoading || ref.isLoading) return <FullscreenLoader />;

  const r = ref.data;
  const reward = r?.reward_per_referral;

  if (!akun.data?.aktif_platform) {
    const punyaSimkopdes = akun.data?.status_simkopdes === "Punya Akun";
    return (
      <>
        <PageHeader title="Referral" desc="Ajak anggota lain — kumpulkan poin & bonus SHU." />
        <Card className="p-8 text-center max-w-lg mx-auto">
          <span className="grid place-items-center size-14 rounded-full bg-accent/10 text-accent mx-auto mb-3">
            <Icon name="rocket_launch" size={28} />
          </span>
          <h2 className="text-lg font-bold text-ink">Aktifkan Akun Digital</h2>
          <p className="text-sm text-muted mt-1">
            {punyaSimkopdes
              ? "Anda sudah tercatat punya akun (simkopdes). Aktivasi lewat platform belum tersedia untuk akun ini."
              : "Dengan mengaktifkan akun digital, Anda mendapat kode referral, mengumpulkan poin & bonus SHU, dan turut menurunkan angka anggota yang belum digital."}
          </p>
          {akun.data?.bisa_aktivasi && (
            <Button variant="accent" className="mt-4" disabled={aktivasi.isPending} onClick={() => aktivasi.mutate()}>
              {aktivasi.isPending ? "Mengaktifkan…" : <>
                <Icon name="check_circle" size={18} /> Aktifkan Sekarang
              </>}
            </Button>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Referral" desc="Ajak anggota lain — kumpulkan poin & bonus SHU." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle>Kode Referral Anda</SectionTitle>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <code className="text-2xl font-extrabold tracking-wider text-primary bg-primary/5 rounded-lg px-4 py-2">
              {r?.kode_referral}
            </code>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(r?.kode_referral ?? "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Icon name={copied ? "check" : "content_copy"} size={18} /> {copied ? "Tersalin" : "Salin"}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <Stat label="Referral" value={angka(r?.jumlah_referral)} />
            <Stat label="Poin" value={angka(r?.poin)} />
            <Stat label="Bonus SHU" value={rupiah(r?.estimasi_shu)} />
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle>Catat Referral Baru</SectionTitle>
          <p className="text-sm text-muted">
            Masukkan nama orang yang Anda ajak. Tiap referral sukses: +{reward?.poin} poin &{" "}
            {rupiah(reward?.bonus_shu)} bonus SHU.
          </p>
          <div className="flex gap-2 mt-3">
            <input
              value={namaRef}
              onChange={(e) => setNamaRef(e.target.value)}
              placeholder="Nama yang direferensikan"
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <Button variant="accent" disabled={!namaRef.trim() || catat.isPending} onClick={() => catat.mutate()}>
              {catat.isPending ? "…" : "Catat"}
            </Button>
          </div>
          {catat.isError && <p className="text-danger text-sm mt-2">Gagal mencatat referral.</p>}
          {catat.isSuccess && <p className="text-ok text-sm mt-2">Referral tercatat! Reward ditambahkan.</p>}
        </Card>
      </div>
      <p className="mt-4 text-center">
        <button
          onClick={() => {
            if (window.confirm("Nonaktifkan akun digital (demo)? Data onboarding Anda akan dihapus agar demo bisa diulang."))
              nonaktif.mutate();
          }}
          className="text-xs text-muted hover:text-danger"
        >
          Nonaktifkan akun digital (demo)
        </button>
      </p>
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
