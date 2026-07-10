import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { rupiah } from '../lib/format';
import { STATUS_LABEL, type PreOrder, type POStatus } from '../types';

const STATUS_CLASS: Record<POStatus, string> = {
  MENUNGGU_ADMIN: 'st-wait',
  DIQUOTE: 'st-quote',
  DP_DIBAYAR: 'st-dp',
  FINAL: 'st-final',
  BATAL: 'st-batal',
};

/** Halaman kelola Pre-Order. Baca + update status (RLS: authenticated boleh UPDATE). */
export default function PreOrderPage() {
  const [rows, setRows] = useState<PreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setError(null);
    const { data, error } = await supabase.from('pre_orders').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setRows((data ?? []) as PreOrder[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel('po-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pre_orders' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function updateStatus(id: string, status: POStatus) {
    setBusy(id);
    const { error } = await supabase.from('pre_orders').update({ status }).eq('id', id);
    setBusy(null);
    if (error) setError(error.message);
    else load();
  }

  if (loading) return <p className="muted">Memuat pre-order…</p>;
  if (error) return <div className="alert error">Gagal: {error}</div>;

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Pre-Order</h2>
          <p className="muted">{rows.length} pesanan</p>
        </div>
        <button className="ghost" onClick={load}>↻ Muat ulang</button>
      </div>

      <div className="alert info">
        ℹ️ Perubahan status di sini tersimpan ke Supabase. Bot memuat PO saat start —
        untuk sinkron penuh 2 arah saat bot berjalan, aktifkan Realtime di bot (opsional).
      </div>

      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Pemesan</th>
              <th>Produk</th>
              <th>Butuh</th>
              <th>Produsen</th>
              <th className="num">Harga</th>
              <th className="num">DP</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.id}</td>
                <td>{p.user_name ?? '-'}</td>
                <td>
                  {p.produk} <span className="sub">{p.jumlah}</span>
                  {p.catatan && <div className="sub">“{p.catatan}”</div>}
                </td>
                <td>{p.tanggal_butuh ?? '-'}</td>
                <td>{p.produsen ?? '-'}</td>
                <td className="num">{p.harga ? rupiah(p.harga) : '-'}</td>
                <td className="num">{p.dp ? rupiah(p.dp) : '-'}</td>
                <td>
                  <span className={`badge ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </td>
                <td className="actions">
                  {p.status === 'DP_DIBAYAR' && (
                    <button disabled={busy === p.id} onClick={() => updateStatus(p.id, 'FINAL')}>
                      Finalisasi
                    </button>
                  )}
                  {p.status !== 'FINAL' && p.status !== 'BATAL' && (
                    <button
                      className="danger"
                      disabled={busy === p.id}
                      onClick={() => updateStatus(p.id, 'BATAL')}
                    >
                      Batalkan
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted center">Belum ada pre-order.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
