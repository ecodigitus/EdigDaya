import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Icon, Avatar } from "./ui";

type NavItem = { to: string; label: string; icon: string; end?: boolean };

const PENGURUS_NAV: NavItem[] = [
  { to: "/", label: "Ringkasan", icon: "dashboard", end: true },
  { to: "/anggota", label: "Anggota", icon: "group" },
  { to: "/anggota-digital", label: "Anggota Digital", icon: "smartphone" },
  { to: "/simpanan", label: "Simpanan", icon: "savings" },
  { to: "/produk", label: "Produk", icon: "inventory_2" },
  { to: "/transaksi", label: "Transaksi", icon: "receipt_long" },
  { to: "/gerai", label: "Gerai", icon: "storefront" },
  { to: "/pre-order", label: "Pre-Order", icon: "shopping_cart" },
  { to: "/referral", label: "Referral", icon: "campaign" },
  { to: "/pengumuman", label: "Pengumuman", icon: "notifications_active" },
  { to: "/transparansi", label: "Transparansi", icon: "gavel" },
  { to: "/pengajuan", label: "Pengajuan", icon: "assignment" },
  { to: "/rat", label: "RAT", icon: "how_to_vote" },
  { to: "/profil", label: "Profil Koperasi", icon: "corporate_fare" },
];

const ANGGOTA_NAV: NavItem[] = [
  { to: "/", label: "Beranda", icon: "home", end: true },
  { to: "/simpanan", label: "Simpanan", icon: "savings" },
  { to: "/produk", label: "Produk", icon: "storefront" },
  { to: "/referral", label: "Referral", icon: "campaign" },
  { to: "/pre-order", label: "Pre-Order", icon: "shopping_cart" },
  { to: "/pengumuman", label: "Pengumuman", icon: "notifications_active" },
  { to: "/transparansi", label: "Transparansi", icon: "gavel" },
  { to: "/pengajuan", label: "Pembiayaan", icon: "request_quote" },
  { to: "/profil", label: "Profil", icon: "person" },
];

// Anggota yang login via akun WhatsApp — menu disamakan dengan portal anggota nasional.
// Beranda/Simpanan/Referral/Profil pakai data WA (edig_dev_members); Produk/Pre-Order/
// Pengumuman/Transparansi/Pembiayaan pakai halaman nasional (konten koperasi).
const WA_NAV: NavItem[] = [
  { to: "/", label: "Beranda", icon: "home", end: true },
  { to: "/simpanan", label: "Simpanan", icon: "savings" },
  { to: "/produk", label: "Produk", icon: "storefront" },
  { to: "/referral", label: "Referral", icon: "campaign" },
  { to: "/pre-order", label: "Pre-Order", icon: "shopping_cart" },
  { to: "/pengumuman", label: "Pengumuman", icon: "notifications_active" },
  { to: "/transparansi", label: "Transparansi", icon: "gavel" },
  { to: "/pengajuan", label: "Pembiayaan", icon: "request_quote" },
  { to: "/pinjaman", label: "Pinjaman", icon: "account_balance" },
  { to: "/profil", label: "Profil", icon: "person" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const role = session?.role;
  const isWa = role === "anggota_wa";
  const isMemberish = role === "anggota" || isWa;
  const nav = isWa ? WA_NAV : role === "anggota" ? ANGGOTA_NAV : PENGURUS_NAV;
  const roleLabel = isWa ? "Anggota (WA)" : role === "anggota" ? "Anggota" : "Pengurus";
  const brand = isMemberish ? "Portal Anggota" : "Koperasi Ops";
  const scopeLabel = session?.koperasi_ref || session?.no_anggota || "";

  const links = (
    <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2">
      {nav.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive ? "bg-primary text-primary-fg" : "text-muted hover:bg-surface-2 hover:text-ink"
            }`
          }
        >
          <Icon name={n.icon} size={20} />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div data-skin={isMemberish ? "member" : undefined} className="min-h-screen bg-bg text-ink">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-line bg-surface">
        <Brand brand={brand} />
        {links}
        <UserFooter nama={session?.nama} roleLabel={roleLabel} onLogout={logout} />
      </aside>

      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 flex flex-col border-r border-line bg-surface">
            <Brand brand={brand} />
            {links}
            <UserFooter nama={session?.nama} roleLabel={roleLabel} onLogout={logout} />
          </aside>
        </div>
      )}

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/85 backdrop-blur px-4 py-2.5">
          <button
            className="md:hidden grid place-items-center size-9 rounded-lg hover:bg-surface-2"
            onClick={() => setOpen(true)}
            aria-label="Menu"
          >
            <Icon name="menu" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink truncate">{session?.nama ?? "—"}</p>
            <p className="text-xs text-muted truncate">
              {roleLabel}
              {scopeLabel ? ` · ${scopeLabel}` : ""}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 text-accent px-3 py-1 text-xs font-semibold">
            <Icon name="verified_user" size={16} /> Mode Demo
          </span>
        </header>
        <main className="mx-auto w-full max-w-[1400px] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function Brand({ brand }: { brand: string }) {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16 border-b border-line shrink-0">
      <span className="grid place-items-center size-9 rounded-lg bg-primary text-primary-fg">
        <Icon name="hub" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold text-ink">Merah Putih</p>
        <p className="text-[11px] text-muted">{brand}</p>
      </div>
    </div>
  );
}

function UserFooter({
  nama,
  roleLabel,
  onLogout,
}: {
  nama?: string;
  roleLabel: string;
  onLogout: () => void;
}) {
  return (
    <div className="border-t border-line p-3 flex items-center gap-2 shrink-0">
      <Avatar name={nama} className="size-9 text-sm shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink truncate">{nama ?? "—"}</p>
        <p className="text-xs text-muted">{roleLabel}</p>
      </div>
      <button
        onClick={onLogout}
        className="grid place-items-center size-9 rounded-lg hover:bg-surface-2 text-muted"
        aria-label="Keluar"
        title="Keluar"
      >
        <Icon name="logout" size={20} />
      </button>
    </div>
  );
}
