import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { koperasi } from '../lib/koperasi';

type WargaDemo = { no_anggota: string; nama: string; role: string; lencana: string | null };

/** "Aktivasi" warga demo: pilih dari daftar atau ketik No. Anggota (mirror dikenali via nomor di WA). */
export default function PortalEntry() {
  const nav = useNavigate();
  const [list, setList] = useState<WargaDemo[]>([]);
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .rpc('portal_daftar_demo')
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setList((data ?? []) as WargaDemo[]);
        setLoading(false);
      });
  }, []);

  function masuk(noAnggota: string) {
    nav(`/portal/${encodeURIComponent(noAnggota.trim())}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (manual.trim()) masuk(manual);
  }

  return (
    <div className="portal-entry">
      <div className="entry-box card">
        <button className="link-back" onClick={() => nav('/')}>← kembali</button>
        <h1>👤 Portal Anggota</h1>
        <p className="muted">
          Pilih warga demo untuk “aktivasi” & lihat datanya, atau ketik No. Anggota.
          Di WhatsApp, kamu dikenali otomatis dari nomormu.
        </p>

        {error && <div className="alert error">{error}</div>}

        <h4>Warga demo</h4>
        {loading ? (
          <p className="muted">Memuat…</p>
        ) : (
          <div className="warga-list">
            {list.map((w) => (
              <button key={w.no_anggota} className="warga-btn" onClick={() => masuk(w.no_anggota)}>
                <div className="warga-ava">{w.nama.charAt(0)}</div>
                <div className="warga-info">
                  <strong>{w.nama}</strong>
                  <span className="sub">
                    {w.no_anggota} ·{' '}
                    <span className={`badge ${w.role === 'produsen' ? 'badge-prod' : 'badge-ang'}`}>{w.role}</span>
                  </span>
                </div>
                <span className="warga-go">→</span>
              </button>
            ))}
            {list.length === 0 && <p className="muted">Belum ada data anggota. Jalankan schema.sql dulu.</p>}
          </div>
        )}

        <form onSubmit={onSubmit} className="manual-form">
          <h4>Atau ketik No. Anggota</h4>
          <div className="row">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="mis. KMP-2019-0043"
            />
            <button type="submit" disabled={!manual.trim()}>Masuk</button>
          </div>
        </form>

        <p className="muted sm demo-note">
          🧪 Mode demo — data dummy. Di produksi, akses tiap anggota dilindungi login pribadi (mis. OTP WhatsApp), bukan tebak No. Anggota.
        </p>
        <p className="muted sm">{koperasi.name}</p>
      </div>
    </div>
  );
}
