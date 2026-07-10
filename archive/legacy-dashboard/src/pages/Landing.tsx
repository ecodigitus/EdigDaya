import { useNavigate } from 'react-router-dom';
import { koperasi } from '../lib/koperasi';

/** Halaman depan: pilih masuk sebagai Anggota (portal) atau Admin (pengurus). */
export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="landing">
      <div className="landing-head">
        <h1>🌾 {koperasi.name}</h1>
        <p className="muted">{koperasi.tagline}</p>
      </div>
      <div className="landing-cards">
        <button className="pick-card" onClick={() => nav('/portal')}>
          <div className="pick-emoji">👤</div>
          <h3>Masuk sebagai Anggota</h3>
          <p className="muted">Lihat simpanan, SHU, poin, usaha & pre-order — sama seperti di WhatsApp.</p>
        </button>
        <button className="pick-card" onClick={() => nav('/admin')}>
          <div className="pick-emoji">🏦</div>
          <h3>Login Pengurus / Admin</h3>
          <p className="muted">Kelola data anggota & pre-order (perlu akun admin).</p>
        </button>
      </div>
    </div>
  );
}
