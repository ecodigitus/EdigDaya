-- ============================================================================
--  Skema + RLS + seed data dummy koperasi (Supabase / Postgres)
--  Sumber data 1:1 dari src/members.ts (Member type) & src/preorder.ts (PreOrder)
--
--  Cara pakai:
--    1. Buka Supabase Dashboard > SQL Editor > New query
--    2. Paste seluruh file ini, Run.
--    3. Buat 1 user admin: Authentication > Users > Add user (email + password).
--       Dashboard web login pakai akun ini.
--
--  Keamanan (OWASP A01/A05, UU PDP):
--    - RLS NYALA di semua tabel. Data keuangan/pribadi anggota TIDAK dibuka ke
--      role `anon`. Dashboard wajib login (role `authenticated`).
--    - Bot memakai service_role key (bypass RLS) untuk load awal + write-through.
--      service_role key HANYA ada di .env bot, TIDAK pernah di frontend.
--
--  Idempoten: aman dijalankan ulang (drop policy IF EXISTS + upsert seed).
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Tabel: members  (dari Member type — src/members.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  no_anggota         text primary key,                                  -- kunci alami (unik)
  phone              text unique,                                       -- key JID, mis. '628123456789' (null = profil demo)
  nama               text not null,
  sejak              text,
  role               text not null default 'anggota' check (role in ('produsen','anggota')),
  simpanan_pokok     bigint not null default 0,
  simpanan_wajib     bigint not null default 0,
  simpanan_sukarela  bigint not null default 0,
  estimasi_shu       bigint not null default 0,
  poin               integer not null default 0,
  lencana            text,
  skor_keterlibatan  integer not null default 0,                        -- 0..100
  kode_referral      text,
  keuangan           jsonb,                                             -- { modal, pengeluaran }
  pinjaman           jsonb,                                             -- { sisa, angsuranPerBulan, tenorSisa } | null
  usaha              jsonb,                                             -- { namaUsaha, produk[], kerugian } | null
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Tabel: pre_orders  (dari PreOrder type — src/preorder.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.pre_orders (
  id                 text primary key,                                  -- 'PO-001'
  user_jid           text,
  user_name          text,
  produk             text,
  jumlah             text,
  qty_num            integer,
  catatan            text,
  tanggal_butuh      text,
  status             text not null default 'MENUNGGU_ADMIN'
                       check (status in ('MENUNGGU_ADMIN','DIQUOTE','DP_DIBAYAR','FINAL','BATAL')),
  harga_saran        bigint,
  harga              bigint,
  dp                 bigint,
  durasi_hari        integer,
  produsen           text,
  produsen_kandidat  jsonb,                                             -- string[]
  produsen_idx       integer not null default 0,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Row Level Security
-- ---------------------------------------------------------------------------
alter table public.members    enable row level security;
alter table public.pre_orders enable row level security;

-- Bersihkan policy lama biar idempoten
drop policy if exists "auth read members"   on public.members;
drop policy if exists "auth read pos"        on public.pre_orders;
drop policy if exists "auth update pos"      on public.pre_orders;

-- Hanya user yang SUDAH LOGIN (authenticated) yang boleh baca.
create policy "auth read members" on public.members
  for select to authenticated using (true);

create policy "auth read pos" on public.pre_orders
  for select to authenticated using (true);

-- Dashboard boleh kelola PO (quote/final/batal) = UPDATE.
create policy "auth update pos" on public.pre_orders
  for update to authenticated using (true) with check (true);

-- Catatan: INSERT/UPDATE members & INSERT pre_orders TIDAK diberi policy anon/auth
-- -> hanya lewat bot (service_role, bypass RLS). anon (belum login) = nol akses.

-- ---------------------------------------------------------------------------
--  SEED data dummy (persis dari src/members.ts). Upsert -> aman diulang.
-- ---------------------------------------------------------------------------
insert into public.members
  (no_anggota, phone, nama, sejak, role,
   simpanan_pokok, simpanan_wajib, simpanan_sukarela,
   estimasi_shu, poin, lencana, skor_keterlibatan, kode_referral,
   keuangan, pinjaman, usaha)
values
  -- Bu Sri Rahayu — PRODUSEN (poin 2), punya usaha Warung Keripik
  ('KMP-2019-0043', '628123456789', 'Bu Sri Rahayu', 'Agustus 2019', 'produsen',
   100000, 3300000, 2500000,
   540000, 3180, 'Anggota Teladan 🥇', 92, 'SRI2019',
   '{"modal":5000000,"pengeluaran":3200000}'::jsonb,
   null,
   '{"namaUsaha":"Warung Keripik Bu Sri","kerugian":150000,"produk":[
       {"nama":"Keripik Singkong","stok":40,"terjual":120,"hargaJual":15000},
       {"nama":"Keripik Pisang","stok":25,"terjual":85,"hargaJual":18000},
       {"nama":"Rempeyek Kacang","stok":60,"terjual":60,"hargaJual":12000}
     ]}'::jsonb),

  -- Pak Budi Santoso — ANGGOTA/konsumen biasa (poin 3), tanpa usaha
  ('KMP-2024-0311', '628987654321', 'Pak Budi Santoso', 'Mei 2024', 'anggota',
   100000, 660000, 0,
   68000, 120, 'Anggota Baru 🥉', 31, 'BUDI2024',
   '{"modal":760000,"pengeluaran":450000}'::jsonb,
   null,
   null),

  -- Andi Wijaya — profil DEMO (fallback nomor tak dikenal), produsen + pinjaman
  ('KMP-2021-0157', null, 'Andi Wijaya', 'Maret 2021', 'produsen',
   100000, 2640000, 750000,
   312000, 1240, 'Anggota Aktif 🥈', 78, 'ANDI2021',
   '{"modal":4000000,"pengeluaran":2100000}'::jsonb,
   '{"sisa":3500000,"angsuranPerBulan":620000,"tenorSisa":6}'::jsonb,
   '{"namaUsaha":"Kebun Sayur Pak Andi","kerugian":220000,"produk":[
       {"nama":"Sawi Hijau","stok":30,"terjual":95,"hargaJual":8000},
       {"nama":"Tomat","stok":20,"terjual":70,"hargaJual":12000},
       {"nama":"Cabai Merah","stok":15,"terjual":40,"hargaJual":35000}
     ]}'::jsonb)
on conflict (no_anggota) do update set
  phone             = excluded.phone,
  nama              = excluded.nama,
  sejak             = excluded.sejak,
  role              = excluded.role,
  simpanan_pokok    = excluded.simpanan_pokok,
  simpanan_wajib    = excluded.simpanan_wajib,
  simpanan_sukarela = excluded.simpanan_sukarela,
  estimasi_shu      = excluded.estimasi_shu,
  poin              = excluded.poin,
  lencana           = excluded.lencana,
  skor_keterlibatan = excluded.skor_keterlibatan,
  kode_referral     = excluded.kode_referral,
  keuangan          = excluded.keuangan,
  pinjaman          = excluded.pinjaman,
  usaha             = excluded.usaha,
  updated_at        = now();

-- pre_orders sengaja dibiarkan KOSONG — diisi saat demo lewat alur PO di bot.
