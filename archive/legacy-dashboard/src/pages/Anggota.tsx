import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { rupiah, angka } from '../lib/format';
import { totalSimpanan, type Member } from '../types';

/** Halaman daftar Anggota & Simpanan (read-only dari tabel members). */
export default function Anggota() {
  const [rows, setRows] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const { data, error } = await supabase.from('members').select('*').order('nama');
    if (error) setError(error.message);
    else setRows((data ?? []) as Member[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Auto-refresh saat bot menulis (write-through) — Supabase Realtime.
    const ch = supabase
      .channel('members-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  if (loading) return <p className="muted">Memuat data anggota…</p>;
  if (error) return <div className="alert error">Gagal memuat: {error}</div>;

  const totalAset = rows.reduce((s, m) => s + totalSimpanan(m), 0);

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Anggota & Simpanan</h2>
          <p className="muted">{rows.length} anggota · total simpanan {rupiah(totalAset)}</p>
        </div>
        <button className="ghost" onClick={load}>↻ Muat ulang</button>
      </div>

      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>No. Anggota</th>
              <th>Peran</th>
              <th className="num">Pokok</th>
              <th className="num">Wajib</th>
              <th className="num">Sukarela</th>
              <th className="num">Total</th>
              <th className="num">Poin</th>
              <th className="num">Est. SHU</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.no_anggota}>
                <td>
                  <strong>{m.nama}</strong>
                  {m.usaha && <div className="sub">🏪 {m.usaha.namaUsaha}</div>}
                </td>
                <td className="mono">{m.no_anggota}</td>
                <td>
                  <span className={`badge ${m.role === 'produsen' ? 'badge-prod' : 'badge-ang'}`}>
                    {m.role}
                  </span>
                </td>
                <td className="num">{rupiah(m.simpanan_pokok)}</td>
                <td className="num">{rupiah(m.simpanan_wajib)}</td>
                <td className="num">{rupiah(m.simpanan_sukarela)}</td>
                <td className="num"><strong>{rupiah(totalSimpanan(m))}</strong></td>
                <td className="num">{angka(m.poin)}</td>
                <td className="num">{rupiah(m.estimasi_shu)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted center">Belum ada data anggota.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
