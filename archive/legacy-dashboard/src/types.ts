/** Bentuk baris tabel Supabase (snake_case), mirror src/members.ts & src/preorder.ts. */

export type Produk = { nama: string; stok: number; terjual: number; hargaJual: number };

export type Member = {
  no_anggota: string;
  phone: string | null;
  nama: string;
  sejak: string | null;
  role: 'produsen' | 'anggota';
  simpanan_pokok: number;
  simpanan_wajib: number;
  simpanan_sukarela: number;
  estimasi_shu: number;
  poin: number;
  lencana: string | null;
  skor_keterlibatan: number;
  kode_referral: string | null;
  keuangan: { modal: number; pengeluaran: number } | null;
  pinjaman: { sisa: number; angsuranPerBulan: number; tenorSisa: number } | null;
  usaha: { namaUsaha: string; produk: Produk[]; kerugian: number } | null;
};

export type POStatus = 'MENUNGGU_ADMIN' | 'DIQUOTE' | 'DP_DIBAYAR' | 'FINAL' | 'BATAL';

export type PreOrder = {
  id: string;
  user_jid: string | null;
  user_name: string | null;
  produk: string | null;
  jumlah: string | null;
  catatan: string | null;
  tanggal_butuh: string | null;
  status: POStatus;
  harga_saran: number | null;
  harga: number | null;
  dp: number | null;
  durasi_hari: number | null;
  produsen: string | null;
  created_at: string;
};

export const STATUS_LABEL: Record<POStatus, string> = {
  MENUNGGU_ADMIN: 'Menunggu Admin',
  DIQUOTE: 'Sudah Di-quote',
  DP_DIBAYAR: 'DP Dibayar',
  FINAL: 'Difinalisasi',
  BATAL: 'Dibatalkan',
};

export const totalSimpanan = (m: Member): number =>
  (m.simpanan_pokok ?? 0) + (m.simpanan_wajib ?? 0) + (m.simpanan_sukarela ?? 0);
