import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth, type Role } from "../lib/auth";
import { useApi } from "../lib/useApi";
import { Button, Card, Icon, Spinner } from "../components/ui";
import { SearchInput } from "../components/page";

type Kop = { koperasi_ref: string; nama_koperasi: string };
type Agt = { anggota_ref: string; nama: string; status_keanggotaan?: string };

function useDebounced<T>(v: T, ms = 300): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function Login() {
  const { login } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [kop, setKop] = useState<Kop | null>(null);
  const [agt, setAgt] = useState<Agt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kopQ, setKopQ] = useState("");
  const [agtQ, setAgtQ] = useState("");
  const kopQd = useDebounced(kopQ);
  const agtQd = useDebounced(agtQ);

  const kopList = useApi<{ data: Kop[] }>(
    ["login/koperasi", kopQd],
    `/api/auth/koperasi?q=${encodeURIComponent(kopQd)}&limit=20`,
    !!role && !kop,
  );
  const agtList = useApi<{ data: Agt[] }>(
    ["login/anggota", kop?.koperasi_ref, agtQd],
    `/api/auth/anggota?koperasi_ref=${encodeURIComponent(kop?.koperasi_ref ?? "")}&q=${encodeURIComponent(agtQd)}&limit=20`,
    role === "anggota" && !!kop && !agt,
  );

  const skin = role === "anggota" ? "member" : undefined;
  const canSubmit = role === "pengurus" ? !!kop : !!kop && !!agt;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (role === "pengurus") await login({ role: "pengurus", koperasi_ref: kop!.koperasi_ref });
      else await login({ role: "anggota", anggota_ref: agt!.anggota_ref });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal masuk.");
      setBusy(false);
    }
  }

  return (
    <div data-skin={skin} className="min-h-screen bg-bg text-ink grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-primary text-primary-fg p-10">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center size-10 rounded-xl bg-white/15">
            <Icon name="hub" />
          </span>
          <span className="font-bold text-lg">Koperasi Merah Putih</span>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">
            Dashboard Koperasi Desa/Kelurahan
          </h1>
          <p className="mt-4 text-primary-fg/80 max-w-md">
            Kelola anggota, simpanan, produk, dan transaksi koperasi — atau pantau simpanan &
            pengajuan Anda sebagai anggota.
          </p>
        </div>
        <p className="text-xs text-primary-fg/60">
          Program Koperasi Merah Putih · Data demo (read-only)
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold">Masuk</h2>
          <p className="text-sm text-muted mt-1">Pilih peran, lalu koperasi Anda.</p>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <RoleCard
              active={role === "pengurus"}
              onClick={() => {
                setRole("pengurus");
                setAgt(null);
              }}
              icon="admin_panel_settings"
              title="Pengurus"
              desc="Kelola koperasi"
            />
            <RoleCard
              active={role === "anggota"}
              onClick={() => setRole("anggota")}
              icon="person"
              title="Anggota"
              desc="Layanan mandiri"
            />
          </div>

          {role && (
            <div className="mt-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                Koperasi
              </label>
              {kop ? (
                <SelectedRow
                  icon="hub"
                  title={kop.nama_koperasi}
                  sub={kop.koperasi_ref}
                  onClear={() => {
                    setKop(null);
                    setAgt(null);
                  }}
                />
              ) : (
                <>
                  <SearchInput
                    value={kopQ}
                    onChange={setKopQ}
                    placeholder="Cari nama / kode koperasi…"
                    className="mt-1.5"
                  />
                  <PickList
                    loading={kopList.isLoading}
                    items={kopList.data?.data ?? []}
                    keyOf={(k) => k.koperasi_ref}
                    onPick={setKop}
                    render={(k) => (
                      <>
                        <p className="font-medium text-ink truncate">{k.nama_koperasi}</p>
                        <p className="text-xs text-muted">{k.koperasi_ref}</p>
                      </>
                    )}
                  />
                </>
              )}
            </div>
          )}

          {role === "anggota" && kop && (
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                Anggota
              </label>
              {agt ? (
                <SelectedRow
                  icon="person"
                  title={agt.nama}
                  sub={agt.anggota_ref}
                  onClear={() => setAgt(null)}
                />
              ) : (
                <>
                  <SearchInput
                    value={agtQ}
                    onChange={setAgtQ}
                    placeholder="Cari nama / ref anggota…"
                    className="mt-1.5"
                  />
                  <PickList
                    loading={agtList.isLoading}
                    items={agtList.data?.data ?? []}
                    keyOf={(a) => a.anggota_ref}
                    onPick={setAgt}
                    render={(a) => (
                      <>
                        <p className="font-medium text-ink truncate">{a.nama}</p>
                        <p className="text-xs text-muted">{a.anggota_ref}</p>
                      </>
                    )}
                  />
                </>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <Button className="w-full mt-6" variant="accent" disabled={!canSubmit || busy} onClick={submit}>
            {busy ? <Spinner /> : <>Masuk <Icon name="arrow_forward" size={18} /></>}
          </Button>
          <p className="mt-3 text-center text-xs text-muted">
            Login bypass untuk demo — tanpa kata sandi.
          </p>
          <p className="mt-4 text-center">
            <Link
              to="/nasional"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <Icon name="public" size={16} /> Lihat Dashboard Nasional (juri / pemerintah)
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition ${
        active ? "border-accent bg-accent/5 ring-2 ring-accent/30" : "border-line bg-surface hover:bg-surface-2"
      }`}
    >
      <span
        className={`grid place-items-center size-10 rounded-lg ${
          active ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted"
        }`}
      >
        <Icon name={icon} />
      </span>
      <p className="mt-2.5 font-semibold text-ink">{title}</p>
      <p className="text-xs text-muted">{desc}</p>
    </button>
  );
}

function SelectedRow({
  icon,
  title,
  sub,
  onClear,
}: {
  icon: string;
  title: string;
  sub: string;
  onClear: () => void;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
      <span className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink truncate">{title}</p>
        <p className="text-xs text-muted truncate">{sub}</p>
      </div>
      <button onClick={onClear} className="text-muted hover:text-ink" aria-label="Ganti">
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}

function PickList<T>({
  loading,
  items,
  keyOf,
  onPick,
  render,
}: {
  loading?: boolean;
  items: T[];
  keyOf: (item: T) => string;
  onPick: (item: T) => void;
  render: (item: T) => ReactNode;
}) {
  return (
    <Card className="mt-2 max-h-64 overflow-y-auto divide-y divide-line">
      {loading ? (
        <div className="p-4 text-center text-sm text-muted">
          <Spinner className="text-accent" /> Memuat…
        </div>
      ) : items.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted">Tidak ada hasil.</div>
      ) : (
        items.map((it) => (
          <button
            key={keyOf(it)}
            onClick={() => onPick(it)}
            className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition"
          >
            {render(it)}
          </button>
        ))
      )}
    </Card>
  );
}
