/**
 * DASHBOARD USAHA & KEUANGAN ANGGOTA (WhatsApp).
 * Implementasi papan tulis Hackathon — POV MEMBER lewat WhatsApp (poin 2 & 3).
 *
 * Dua PERAN anggota, DITANDAI PER-NOMOR di members.ts (field `role`):
 *
 *   PRODUSEN (poin 2) — anggota yang punya usaha & menitip-jual lewat koperasi:
 *     2A  Data terjual, stok, keuntungan, kerugian
 *     2B  Pengeluaran & modal
 *     2C  Poin referral   → referral.ts (menu 8)
 *     2D  SHU tracker      → menu 3
 *
 *   ANGGOTA (poin 3) — anggota/konsumen biasa:
 *     3A  Pengeluaran & modal
 *     3B  Poin referral   → referral.ts (menu 8)
 *     3C  SHU tracker      → menu 3
 *
 * Semua angka DUMMY (MVP demo). Keuntungan bersih dihitung dari data mentah
 * (omzet − pengeluaran − kerugian) agar selalu rekonsiliasi & transparan.
 * Tiap anggota hanya melihat DATANYA SENDIRI (berbasis JID) — kontrol akses
 * sejalan OWASP A01 (Broken Access Control).
 */
import { rupiah } from './format';
import { stats } from './referral';
import { totalSimpanan, type Member, type MemberRole, type UsahaProdusen } from './members';

// ── Demo aid: "lihat sebagai" — agar 1 nomor bisa mendemokan 2 POV ke juri ──
const viewAs = new Map<string, MemberRole>();

// Usaha cadangan bila anggota-biasa memakai mode "lihat sebagai produsen".
const SAMPLE_USAHA: UsahaProdusen = {
  namaUsaha: 'Usaha Contoh (demo)',
  produk: [
    { nama: 'Produk A', stok: 25, terjual: 60, hargaJual: 15_000 },
    { nama: 'Produk B', stok: 40, terjual: 30, hargaJual: 20_000 },
  ],
  kerugian: 100_000,
};

/** Peran yang sedang "dilihat" untuk nomor ini (override demo bila ada). */
export function effectiveRole(jid: string, m: Member): MemberRole {
  return viewAs.get(jid) ?? m.role;
}

/** Set/hapus mode "lihat sebagai" (dipakai command demo di router). */
export function setViewRole(jid: string, role: MemberRole | null): string {
  if (role) viewAs.set(jid, role);
  else viewAs.delete(jid);
  const label = role === 'produsen' ? '🏪 PRODUSEN' : role === 'anggota' ? '🧺 ANGGOTA (konsumen)' : 'sesuai data nomor';
  return (
    `🔎 Mode tampilan diubah ke *${label}*.\n\n` +
    `Ketik *dashboard* untuk melihat datanya, atau *menu* untuk kembali.`
  );
}

// ── Hitungan usaha (dari data mentah, biar transparan) ──
function omzet(u: UsahaProdusen): number {
  return u.produk.reduce((s, p) => s + p.terjual * p.hargaJual, 0);
}

/** Dashboard sesuai peran EFEKTIF nomor ini (menghormati mode "lihat sebagai"). */
export function dashboard(jid: string, m: Member): string {
  const role = effectiveRole(jid, m);
  if (role === 'produsen') return produsenDashboard(m, m.usaha ?? SAMPLE_USAHA);
  return anggotaKeuangan(m);
}

/** POIN 2 — Dashboard usaha anggota produsen. */
function produsenDashboard(m: Member, u: UsahaProdusen): string {
  const om = omzet(u);
  const laba = om - m.keuangan.pengeluaran - u.kerugian; // keuntungan bersih
  const untung = laba >= 0;
  const totalTerjual = u.produk.reduce((s, p) => s + p.terjual, 0);
  const totalStok = u.produk.reduce((s, p) => s + p.stok, 0);
  const ref = stats(m.kodeReferral);

  const produkLines = u.produk
    .map((p) => `• *${p.nama}*\n   terjual ${p.terjual} · stok ${p.stok} · ${rupiah(p.hargaJual)}/unit`)
    .join('\n');

  return (
    `🏪 *Dashboard Usaha — ${u.namaUsaha}*\n` +
    `👤 ${m.nama} · _Anggota Produsen_\n\n` +
    `📦 *Penjualan & Stok*\n` +
    `${produkLines}\n` +
    `_Total: terjual ${totalTerjual} unit · sisa stok ${totalStok} unit_\n\n` +
    `━━━━━━━━━━━━━━\n` +
    `💵 Omzet penjualan  : *${rupiah(om)}*\n` +
    `💼 Modal usaha       : ${rupiah(m.keuangan.modal)}\n` +
    `🧾 Pengeluaran       : ${rupiah(m.keuangan.pengeluaran)}\n` +
    `📉 Kerugian (susut)  : ${rupiah(u.kerugian)}\n` +
    `━━━━━━━━━━━━━━\n` +
    `${untung ? '✅' : '⚠️'} *${untung ? 'Keuntungan' : 'Kerugian'} bersih: ${rupiah(Math.abs(laba))}*\n` +
    `_(= omzet − pengeluaran − kerugian)_\n\n` +
    `🤝 Poin referral: *${ref.poin}* (${ref.ajakan} ajakan) → ketik *7*\n` +
    `📈 Estimasi SHU: *${rupiah(m.estimasiSHU)}* → ketik *2*\n\n` +
    `_Data periode berjalan (dummy demo). Ketik *menu* untuk kembali._`
  );
}

/** POIN 3 — Ringkasan keuangan anggota/konsumen biasa. */
function anggotaKeuangan(m: Member): string {
  const modal = totalSimpanan(m); // modal = kontribusi simpanan anggota ke koperasi
  const ref = stats(m.kodeReferral);
  return (
    `📊 *Ringkasan Keuangan Saya*\n` +
    `👤 ${m.nama} · _Anggota (Konsumen)_\n\n` +
    `💼 *Modal & Pengeluaran*\n` +
    `• Modal (simpanan): *${rupiah(modal)}*\n` +
    `• Belanja di koperasi (bln ini): *${rupiah(m.keuangan.pengeluaran)}*\n\n` +
    `━━━━━━━━━━━━━━\n` +
    `🤝 Poin referral: *${ref.poin}* (${ref.ajakan} ajakan) → ketik *7*\n` +
    `📈 Estimasi SHU: *${rupiah(m.estimasiSHU)}* → ketik *2*\n\n` +
    `_Sebagai anggota konsumen kamu belum punya data usaha. Mau jualan lewat koperasi? Ketik *pengurus*._\n` +
    `_Data dummy demo. Ketik *menu* untuk kembali._`
  );
}
