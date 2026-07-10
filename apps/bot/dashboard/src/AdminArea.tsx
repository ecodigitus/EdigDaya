import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Anggota from './pages/Anggota';
import PreOrderPage from './pages/PreOrder';

/** Area ADMIN/pengurus — di belakang Supabase Auth. Dipasang di rute /admin/*. */
export default function AdminArea() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="center full">Memuat…</div>;
  if (!session) return <Login />;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">🏦 Admin Koperasi</div>
        <nav>
          <NavLink to="/admin/anggota">👥 Anggota & Simpanan</NavLink>
          <NavLink to="/admin/pre-order">📦 Pre-Order</NavLink>
          <NavLink to="/portal">👤 Lihat Portal Anggota →</NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="muted sm">{session.user.email}</div>
          <button
            className="ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/');
            }}
          >
            Keluar
          </button>
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="anggota" element={<Anggota />} />
          <Route path="pre-order" element={<PreOrderPage />} />
          <Route path="*" element={<Navigate to="/admin/anggota" replace />} />
        </Routes>
      </main>
    </div>
  );
}
