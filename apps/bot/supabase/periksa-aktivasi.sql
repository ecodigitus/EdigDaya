-- ============================================================================
--  Fitur "Periksa Aktivasi" — untuk anggota yang SUDAH terdaftar di sistem
--  koperasi (di produksi: sinkron dari sistem pemerintah). Additive & aman
--  dijalankan ulang. Jalankan di Supabase SQL Editor.
--
--  Keamanan (UU PDP / OWASP):
--    - Verifikasi cukup pakai *Nomor Anggota* — TIDAK meminta/menyimpan NIK
--      (minimalisasi data pribadi). NIK dianggap terlalu sensitif untuk ini.
--    - Seed di bawah = data DUMMY (bukan warga asli). phone = null → belum
--      terhubung ke nomor WA mana pun (menunggu diklaim lewat "Periksa Aktivasi").
-- ============================================================================

-- Seed anggota "sudah terdaftar" (phone null = belum diklaim). Data lengkap
-- supaya begitu diaktivasi, semua menu (simpanan, SHU, pinjaman, usaha, poin)
-- langsung terisi. on conflict do nothing → tidak menimpa klaim saat re-run.
insert into public.members
  (no_anggota, phone, nama, sejak, role,
   simpanan_pokok, simpanan_wajib, simpanan_sukarela,
   estimasi_shu, poin, lencana, skor_keterlibatan, kode_referral,
   keuangan, pinjaman, usaha)
values
  -- Ibu Wati — PRODUSEN (punya usaha katering), belum klaim nomor WA
  ('KMP-2020-0088', null, 'Ibu Wati Ningsih', 'Januari 2020', 'produsen',
   100000, 1800000, 500000,
   210000, 640, 'Anggota Aktif 🥈', 70, 'WATI2020',
   '{"modal":3000000,"pengeluaran":1500000}'::jsonb,
   null,
   '{"namaUsaha":"Katering Bu Wati","kerugian":80000,"produk":[
       {"nama":"Nasi Kotak","stok":50,"terjual":210,"hargaJual":18000},
       {"nama":"Snack Box","stok":80,"terjual":150,"hargaJual":12000},
       {"nama":"Tumpeng Mini","stok":10,"terjual":25,"hargaJual":75000}
     ]}'::jsonb),

  -- Pak Joko — ANGGOTA/konsumen biasa, punya pinjaman aktif, belum klaim nomor WA
  ('KMP-2022-0145', null, 'Pak Joko Susilo', 'Maret 2022', 'anggota',
   100000, 900000, 0,
   90000, 210, 'Anggota Baru 🥉', 40, 'JOKO2022',
   '{"modal":1000000,"pengeluaran":600000}'::jsonb,
   '{"sisa":2000000,"angsuranPerBulan":350000,"tenorSisa":6}'::jsonb,
   null)
on conflict (no_anggota) do nothing;

-- Catatan demo: setelah nomor WA "mengklaim" salah satu anggota di atas (phone
-- terisi), nomor yang SAMA tetap bisa verifikasi ulang (dianggap pemilik sah).
-- Untuk melepas klaim (ganti nomor), update phone=null lewat SQL (bukan delete).

-- ============================================================================
--  RESET DEMO (opsional) — lepas tautan nomor WA dari anggota "Periksa Aktivasi"
--  supaya bisa demo ULANG dari nol (atau dari nomor berbeda).
--  Ini UPDATE (bukan DELETE) → NON-DESTRUKTIF, datanya tetap ada, cuma phone
--  dikosongkan. Jalankan HANYA saat ingin mengulang demo.
-- ----------------------------------------------------------------------------
--  update public.members
--     set phone = null
--   where no_anggota in ('KMP-2020-0088', 'KMP-2022-0145');
-- ============================================================================
