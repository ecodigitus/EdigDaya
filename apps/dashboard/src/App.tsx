import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, type Role } from "./lib/auth";
import { FullscreenLoader } from "./components/ui";
import { AppShell } from "./components/AppShell";
import { Login } from "./pages/Login";
import { Nasional } from "./pages/Nasional";

import { PengurusOverview } from "./pages/pengurus/Overview";
import { PengurusAnggota } from "./pages/pengurus/Anggota";
import { PengurusAnggotaDetail } from "./pages/pengurus/AnggotaDetail";
import { PengurusAnggotaDigital } from "./pages/pengurus/AnggotaDigital";
import { PengurusSimpanan } from "./pages/pengurus/Simpanan";
import { PengurusProduk } from "./pages/pengurus/Produk";
import { PengurusTransaksi } from "./pages/pengurus/Transaksi";
import { PengurusGerai } from "./pages/pengurus/Gerai";

import { AnggotaBeranda } from "./pages/anggota/Beranda";
import { AnggotaSimpanan } from "./pages/anggota/Simpanan";
import { AnggotaProfil } from "./pages/anggota/Profil";
import { AnggotaProduk } from "./pages/anggota/Produk";
import { AnggotaPengajuan } from "./pages/anggota/Pengajuan";
import { AnggotaReferral } from "./pages/anggota/Referral";
import { AnggotaPreOrder } from "./pages/anggota/PreOrder";
import { AnggotaPengumuman } from "./pages/anggota/Pengumuman";
import { AnggotaTransparansi } from "./pages/anggota/Transparansi";
import { PengurusPreOrder } from "./pages/pengurus/PreOrder";
import { PengurusReferral } from "./pages/pengurus/Referral";
import { PengurusPengumuman } from "./pages/pengurus/Pengumuman";
import { PengurusTransparansi } from "./pages/pengurus/Transparansi";
import { PengurusPengajuan } from "./pages/pengurus/Pengajuan";
import { PengurusRAT } from "./pages/pengurus/RAT";
import { PengurusProfilKoperasi } from "./pages/pengurus/ProfilKoperasi";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 },
  },
});

function AuthedApp({ role }: { role: Role }) {
  return (
    <AppShell>
      {role === "pengurus" ? (
        <Routes>
          <Route path="/" element={<PengurusOverview />} />
          <Route path="/anggota" element={<PengurusAnggota />} />
          <Route path="/anggota-digital" element={<PengurusAnggotaDigital />} />
          <Route path="/anggota/:ref" element={<PengurusAnggotaDetail />} />
          <Route path="/simpanan" element={<PengurusSimpanan />} />
          <Route path="/produk" element={<PengurusProduk />} />
          <Route path="/transaksi" element={<PengurusTransaksi />} />
          <Route path="/gerai" element={<PengurusGerai />} />
          <Route path="/pre-order" element={<PengurusPreOrder />} />
          <Route path="/referral" element={<PengurusReferral />} />
          <Route path="/pengumuman" element={<PengurusPengumuman />} />
          <Route path="/transparansi" element={<PengurusTransparansi />} />
          <Route path="/pengajuan" element={<PengurusPengajuan />} />
          <Route path="/rat" element={<PengurusRAT />} />
          <Route path="/profil" element={<PengurusProfilKoperasi />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<AnggotaBeranda />} />
          <Route path="/simpanan" element={<AnggotaSimpanan />} />
          <Route path="/produk" element={<AnggotaProduk />} />
          <Route path="/pengajuan" element={<AnggotaPengajuan />} />
          <Route path="/profil" element={<AnggotaProfil />} />
          <Route path="/referral" element={<AnggotaReferral />} />
          <Route path="/pre-order" element={<AnggotaPreOrder />} />
          <Route path="/pengumuman" element={<AnggotaPengumuman />} />
          <Route path="/transparansi" element={<AnggotaTransparansi />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </AppShell>
  );
}

function Shell() {
  const { session, loading } = useAuth();
  if (loading) return <FullscreenLoader label="Menyiapkan aplikasi…" />;
  return (
    <Routes>
      {/* Public — jury / government facing, no login required */}
      <Route path="/nasional" element={<Nasional />} />
      <Route path="/*" element={session ? <AuthedApp role={session.role} /> : <Login />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
