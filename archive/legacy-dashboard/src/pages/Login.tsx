import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseReady } from '../lib/supabase';

/** Halaman login admin. Semua data di belakang auth (OWASP A01 — data anggota sensitif). */
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    // Sukses: onAuthStateChange di App.tsx yang akan re-render ke dashboard.
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit}>
        <button type="button" className="link-back" onClick={() => navigate('/')}>← beranda</button>
        <h1>🏦 Dashboard Koperasi</h1>
        <p className="muted">Masuk untuk mengelola anggota & pre-order.</p>

        {!supabaseReady && (
          <div className="alert">
            Kredensial Supabase belum diisi. Set <code>VITE_SUPABASE_URL</code> &{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> di <code>dashboard/.env</code>.
          </div>
        )}

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@koperasi.id"
          required
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        {error && <div className="alert error">{error}</div>}

        <button type="submit" disabled={loading || !supabaseReady}>
          {loading ? 'Masuk…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
