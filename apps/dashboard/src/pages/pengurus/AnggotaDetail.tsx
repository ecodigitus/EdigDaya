import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../../lib/useApi";
import { Card, KpiCard, SectionTitle, StatusPill, EmptyState, Avatar, Icon, Button, FullscreenLoader } from "../../components/ui";
import { DataTable } from "../../components/table";
import { rupiah, angka, tanggal, tanggalWaktu } from "../../lib/format";

type Detail = {
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
  };
  simpanan: {
    byJenis: { jenis: string; paid: number; unpaid: number }[];
    riwayat: { periode_pembayaran: string; jenis: string; jumlah: number; status: string; dibayar_pada: string }[];
  };
};

export function PengurusAnggotaDetail() {
  const { ref = "" } = useParams();
  const nav = useNavigate();
  const { data, isLoading, error } = useApi<Detail>(["pengurus/anggota", ref], `/api/pengurus/anggota/${encodeURIComponent(ref)}`);

  if (isLoading) return <FullscreenLoader />;
  if (error || !data) return <EmptyState icon="error" title="Anggota tidak ditemukan" action={<Button onClick={() => nav("/anggota")}>Kembali</Button>} />;

  const a = data.anggota;
  const totalPaid = data.simpanan.byJenis.reduce((s, x) => s + x.paid, 0);
  const totalUnpaid = data.simpanan.byJenis.reduce((s, x) => s + x.unpaid, 0);
  const wilayah = [a.desa_kelurahan, a.kecamatan, a.kab_kota, a.provinsi].filter(Boolean).join(", ");

  return (
    <>
      <button onClick={() => nav("/anggota")} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-3">
        <Icon name="arrow_back" size={18} /> Daftar Anggota
      </button>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={a.nama} className="size-14 text-lg shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-ink">{a.nama}</h1>
            <p className="text-sm text-muted">{a.anggota_ref} · NIK {a.nik}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={a.status_keanggotaan === "Approved" ? "Aktif" : a.status_keanggotaan} />
              <span className="text-xs text-muted">{a.status_akun}</span>
            </div>
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 mt-5 text-sm">
          <Info label="Pekerjaan" value={a.pekerjaan} />
          <Info label="Terdaftar" value={tanggal(a.tanggal_terdaftar)} />
          <Info label="Gender" value={a.jenis_kelamin === "LAKI-LAKI" ? "Laki-laki" : "Perempuan"} />
          <Info label="Wilayah" value={wilayah || "—"} />
        </dl>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mt-4">
        <KpiCard label="Total Simpanan (lunas)" value={rupiah(totalPaid)} icon="savings" tone="ok" />
        <KpiCard label="Tunggakan" value={rupiah(totalUnpaid)} icon="pending_actions" tone="warn" />
        <KpiCard label="Jenis Simpanan" value={angka(data.simpanan.byJenis.length)} icon="category" tone="accent" />
      </div>

      {data.simpanan.byJenis.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3 mt-4">
          {data.simpanan.byJenis.map((j) => (
            <Card key={j.jenis} className="p-4">
              <p className="text-sm font-semibold text-ink">{j.jenis}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-ok">{rupiah(j.paid)}</p>
              {j.unpaid > 0 && <p className="text-xs text-warn">Tunggakan {rupiah(j.unpaid)}</p>}
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-4">
        <div className="p-4 pb-0"><SectionTitle>Riwayat Simpanan</SectionTitle></div>
        <DataTable
          rows={data.simpanan.riwayat}
          keyOf={(r, i) => r.periode_pembayaran + i}
          empty={<EmptyState icon="savings" title="Belum ada riwayat simpanan" />}
          columns={[
            { key: "periode", header: "Periode", render: (r) => r.periode_pembayaran },
            { key: "jenis", header: "Jenis", render: (r) => r.jenis },
            { key: "bayar", header: "Dibayar", render: (r) => tanggalWaktu(r.dibayar_pada) },
            { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
            { key: "jumlah", header: "Jumlah", align: "right", render: (r) => <span className="tabular-nums">{rupiah(r.jumlah)}</span> },
          ]}
        />
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-ink">{value || "—"}</dd>
    </div>
  );
}
