import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { rupiah, angka } from '../lib/format';
import { koperasi, misiMingguan } from '../lib/koperasi';
import { STATUS_LABEL, totalSimpanan, type Member, type POStatus, type PreOrder } from '../types';

const STATUS_CLASS: Record<POStatus, string> = {
  MENUNGGU_ADMIN: 'st-wait',
  DIQUOTE: 'st-quote',
  DP_DIBAYAR: 'st-dp',
  FINAL: 'st-final',
  BATAL: 'st-batal',
};

/** Portal anggota (POV warga) — cerminan 1:1 menu WhatsApp (menu 1–9). */
export default function MemberPortal() {
  const { noAnggota } = useParams();
  const nav = useNavigate();
  const [m, setM] = useState<Member | null>(null);
  const [pos, setPos] = useState<PreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!noAnggota) return;
    const [mem, po] = await Promise.all([
      supabase.rpc('portal_member', { p_no_anggota: noAnggota }),
      supabase.rpc('portal_pos', { p_no_anggota: noAnggota }),
    ]);
    if (mem.error || !mem.data) setNotFound(true);
    else setM(mem.data as Member);
    if (!po.error) setPos((po.data ?? []) as PreOrder[]);
    setLoading(false);
  }, [noAnggota]);

  useEffect(() => {
    load();
    // Polling ringan → data dari WA (write-through) muncul di portal tanpa refresh manual.
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <div className="center full">Memuat data anggota…</div>;
  if (notFound || !m)
    return (
      <div className="center full">
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p>Anggota <b>{noAnggota}</b> tidak ditemukan.</p>
          <button onClick={() => nav('/portal')}>← Pilih warga lain</button>
        </div>
      </div>
    );

  const pokokLunas = m.simpanan_pokok >= koperasi.simpananPokok;
  const isProdusen = m.role === 'produsen' && m.usaha;

  // Hitungan usaha (mirror usaha.ts): omzet & laba bersih dari data mentah.
  const omzet = m.usaha ? m.usaha.produk.reduce((s, p) => s + p.terjual * p.hargaJual, 0) : 0;
  const laba = m.usaha ? omzet - (m.keuangan?.pengeluaran ?? 0) - m.usaha.kerugian : 0;

  return (
    <div className="portal">
      <header className="portal-top">
        <button className="link-back" onClick={() => nav('/portal')}>← ganti warga</button>
        <div className="portal-id">
          <div className="ava-lg">{m.nama.charAt(0)}</div>
          <div>
            <h1>{m.nama}</h1>
            <p className="muted">
              {m.no_anggota} · anggota sejak {m.sejak} ·{' '}
              <span className={`badge ${isProdusen ? 'badge-prod' : 'badge-ang'}`}>{m.role}</span>
            </p>
          </div>
        </div>
        <span className="lencana">{m.lencana}</span>
      </header>

      <div className="grid">
        {/* 1 — Simpanan */}
        <section className="card">
          <h3>💰 Simpanan Saya</h3>
          <div className="kv"><span>Pokok</span><b>{rupiah(m.simpanan_pokok)} {pokokLunas ? '✅' : '⚠️'}</b></div>
          <div className="kv"><span>Wajib</span><b>{rupiah(m.simpanan_wajib)}</b></div>
          <div className="kv"><span>Sukarela</span><b>{rupiah(m.simpanan_sukarela)}</b></div>
          <div className="kv total"><span>Total</span><b>{rupiah(totalSimpanan(m))}</b></div>
          {!pokokLunas && <p className="muted sm">Simpanan pokok belum lunas.</p>}
        </section>

        {/* 2 — Estimasi SHU */}
        <section className="card">
          <h3>📈 Estimasi SHU</h3>
          <div className="big-num">{rupiah(m.estimasi_shu)}</div>
          <p className="muted sm">
            Dihitung dari besar simpanan & keaktifan. Final dibagikan saat e-RAT ({koperasi.eRat.tanggal}).
          </p>
        </section>

        {/* 3 — Pinjaman */}
        <section className="card">
          <h3>🏦 Pinjaman</h3>
          {m.pinjaman ? (
            <>
              <div className="kv"><span>Sisa pokok</span><b>{rupiah(m.pinjaman.sisa)}</b></div>
              <div className="kv"><span>Angsuran</span><b>{rupiah(m.pinjaman.angsuranPerBulan)}/bln</b></div>
              <div className="kv"><span>Sisa tenor</span><b>{m.pinjaman.tenorSisa}x</b></div>
            </>
          ) : (
            <p className="muted">Belum ada pinjaman aktif 👍<br />Plafon s/d {rupiah(koperasi.pinjaman.plafon)}, jasa {koperasi.pinjaman.jasa}.</p>
          )}
        </section>

        {/* 5 — Poin & Misi */}
        <section className="card">
          <h3>🎯 Poin & Keterlibatan</h3>
          <div className="kv"><span>⭐ Poin</span><b>{angka(m.poin)}</b></div>
          <div className="kv"><span>🏅 Lencana</span><b>{m.lencana}</b></div>
          <div className="kv"><span>📊 Skor</span><b>{m.skor_keterlibatan}/100</b></div>
          <div className="bar"><div className="bar-fill" style={{ width: `${m.skor_keterlibatan}%` }} /></div>
          <p className="muted sm" style={{ marginTop: 10 }}><b>Misi minggu ini:</b></p>
          <ul className="misi">{misiMingguan.map((x) => <li key={x}>☐ {x}</li>)}</ul>
        </section>

        {/* 7 — Referral / Gotong Royong */}
        <section className="card">
          <h3>🤝 Ajak Teman (Gotong Royong)</h3>
          <p className="muted sm">Kode referral kamu:</p>
          <div className="kode">{m.kode_referral}</div>
          <p className="muted sm">
            Tiap teman yang aktivasi pakai kodemu, kamu dapat poin Gotong Royong untuk bonus SHU 🎁
          </p>
        </section>

        {/* 4 — e-RAT */}
        <section className="card">
          <h3>🗳️ e-RAT & Voting</h3>
          <div className="kv"><span>Jadwal</span><b>{koperasi.eRat.tanggal}</b></div>
          <p className="muted sm">{koperasi.eRat.agenda}</p>
          <p className="muted sm">Metode: {koperasi.eRat.metode}. Kamu punya 1 hak suara.</p>
        </section>

        {/* 9 — Dashboard Usaha (produsen) / Ringkasan Keuangan (anggota) */}
        {isProdusen && m.usaha ? (
          <section className="card wide">
            <h3>🏪 Dashboard Usaha — {m.usaha.namaUsaha}</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Produk</th><th className="num">Terjual</th><th className="num">Stok</th><th className="num">Harga/unit</th></tr></thead>
                <tbody>
                  {m.usaha.produk.map((p) => (
                    <tr key={p.nama}>
                      <td>{p.nama}</td>
                      <td className="num">{angka(p.terjual)}</td>
                      <td className="num">{angka(p.stok)}</td>
                      <td className="num">{rupiah(p.hargaJual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="kv"><span>💵 Omzet penjualan</span><b>{rupiah(omzet)}</b></div>
            <div className="kv"><span>💼 Modal usaha</span><b>{rupiah(m.keuangan?.modal ?? 0)}</b></div>
            <div className="kv"><span>🧾 Pengeluaran</span><b>{rupiah(m.keuangan?.pengeluaran ?? 0)}</b></div>
            <div className="kv"><span>📉 Kerugian (susut)</span><b>{rupiah(m.usaha.kerugian)}</b></div>
            <div className="kv total">
              <span>{laba >= 0 ? '✅ Keuntungan bersih' : '⚠️ Kerugian bersih'}</span>
              <b>{rupiah(Math.abs(laba))}</b>
            </div>
            <p className="muted sm">= omzet − pengeluaran − kerugian</p>
          </section>
        ) : (
          <section className="card wide">
            <h3>📊 Ringkasan Keuangan Saya</h3>
            <div className="kv"><span>💼 Modal (simpanan)</span><b>{rupiah(totalSimpanan(m))}</b></div>
            <div className="kv"><span>🛒 Belanja di koperasi (bln ini)</span><b>{rupiah(m.keuangan?.pengeluaran ?? 0)}</b></div>
            <p className="muted sm">Sebagai anggota konsumen kamu belum punya data usaha.</p>
          </section>
        )}

        {/* 8 — Pre-Order */}
        <section className="card wide">
          <h3>📦 Pre-Order Saya</h3>
          {pos.length === 0 ? (
            <p className="muted">Belum ada pesanan. Buat lewat WhatsApp: ketik <code>pre-order</code>.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Produk</th><th>Butuh</th><th className="num">Harga</th><th className="num">DP</th><th>Status</th></tr></thead>
                <tbody>
                  {pos.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.id}</td>
                      <td>{p.produk} <span className="sub">{p.jumlah}</span></td>
                      <td>{p.tanggal_butuh ?? '-'}</td>
                      <td className="num">{p.harga ? rupiah(p.harga) : '-'}</td>
                      <td className="num">{p.dp ? rupiah(p.dp) : '-'}</td>
                      <td><span className={`badge ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <p className="muted sm portal-foot">
        🔄 Data tersinkron dari WhatsApp (auto-refresh tiap 10 dtk). Coba <code>setor</code> simpanan di WA, lalu lihat saldonya berubah di sini.
      </p>
    </div>
  );
}
