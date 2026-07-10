-- ============================================================================
--  Menu baru: Daftar Pengurus, Pengumuman, Anggota Jaga Anggota (transparansi)
--  Additive — TIDAK menyentuh schema.sql yang sudah ada. Aman dijalankan ulang.
--
--  Cara pakai:
--    1. Supabase Dashboard > SQL Editor > New query
--    2. Paste seluruh file ini, Run.
--
--  Keamanan (OWASP A01/A05, UU PDP 27/2022):
--    - RLS NYALA di semua tabel. `anon` (belum login) = nol akses.
--    - Dashboard (role authenticated) hanya boleh SELECT (baca).
--    - Bot menulis via service_role (bypass RLS) — key hanya di .env bot.
--    - `laporan_transparansi` bersifat APPEND-ONLY: TIDAK ada policy UPDATE/DELETE
--      untuk siapa pun lewat API. Ditambah TRIGGER yang memblokir UPDATE/DELETE
--      bahkan untuk service_role → laporan tak bisa dihapus/diubah admin.
--      (Ini inti fitur "anti-tutup-mulut": laporan permanen & bisa dibaca semua anggota.)
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Tabel: pengurus  (Menu 11 — Daftar Pengurus)
-- ---------------------------------------------------------------------------
create table if not exists public.pengurus (
  id          bigint generated always as identity primary key,
  urutan      integer not null default 0,          -- untuk urutan tampil (ketua dulu, dst)
  nama        text not null,
  jabatan     text not null,
  no_hp       text,                                 -- opsional; ditampilkan apa adanya (data pengurus, publik ke anggota)
  wilayah     text,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Tabel: pengumuman  (Menu 12 — Pengumuman)
-- ---------------------------------------------------------------------------
create table if not exists public.pengumuman (
  id          bigint generated always as identity primary key,
  judul       text not null,
  isi         text not null,
  penting     boolean not null default false,       -- tandai pengumuman penting (📌)
  penulis     text,                                 -- nama pengurus yang mengumumkan
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Tabel: laporan_transparansi  (Menu 13 — Anggota Jaga Anggota)
--  APPEND-ONLY. Laporan kejanggalan dari anggota. Tak bisa dihapus/diubah.
-- ---------------------------------------------------------------------------
create table if not exists public.laporan_transparansi (
  id            bigint generated always as identity primary key,
  kategori      text not null default 'Lainnya',
  isi           text not null,
  anonim        boolean not null default false,
  pelapor_nama  text,                               -- null jika anonim (privasi pelapor / whistleblower)
  pelapor_no    text,                               -- null jika anonim — tak disimpan demi perlindungan pelapor (UU PDP)
  status        text not null default 'BELUM_DIVERIFIKASI'
                  check (status in ('BELUM_DIVERIFIKASI','DITINDAKLANJUTI','SELESAI')),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Row Level Security
-- ---------------------------------------------------------------------------
alter table public.pengurus             enable row level security;
alter table public.pengumuman           enable row level security;
alter table public.laporan_transparansi enable row level security;

-- Idempoten: bersihkan policy lama
drop policy if exists "auth read pengurus"   on public.pengurus;
drop policy if exists "auth read pengumuman" on public.pengumuman;
drop policy if exists "auth read laporan"    on public.laporan_transparansi;

-- Dashboard (authenticated) boleh BACA. Tulis tetap lewat bot (service_role).
create policy "auth read pengurus" on public.pengurus
  for select to authenticated using (true);

create policy "auth read pengumuman" on public.pengumuman
  for select to authenticated using (true);

-- Laporan: authenticated boleh BACA semua (transparansi). TIDAK ada policy
-- update/delete → dashboard/admin tak bisa mengubah maupun menghapus laporan.
create policy "auth read laporan" on public.laporan_transparansi
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
--  TRIGGER anti-hapus/ubah untuk laporan_transparansi.
--  RLS bisa di-bypass service_role, tapi TRIGGER tetap jalan untuk semua role.
--  Jadi laporan benar-benar permanen (append-only) — bahkan bot pun tak bisa
--  menghapusnya. Sesuai kebijakan "no destructive" + inti fitur transparansi.
-- ---------------------------------------------------------------------------
create or replace function public.block_laporan_mutation()
  returns trigger
  language plpgsql
as $$
begin
  raise exception 'laporan_transparansi bersifat append-only: UPDATE/DELETE tidak diizinkan';
end;
$$;

drop trigger if exists trg_block_laporan_mutation on public.laporan_transparansi;
create trigger trg_block_laporan_mutation
  before update or delete on public.laporan_transparansi
  for each row execute function public.block_laporan_mutation();

-- ---------------------------------------------------------------------------
--  SEED data contoh (upsert-safe untuk pengurus; pengumuman diisi contoh sekali)
-- ---------------------------------------------------------------------------

-- Pengurus (hapus dulu isi lama biar seed tidak dobel saat dijalankan ulang).
-- Aman: tabel referensi, bukan data transaksi anggota.
truncate table public.pengurus restart identity;
insert into public.pengurus (urutan, nama, jabatan, no_hp, wilayah) values
  (1, 'H. Suryadi',        'Ketua',            '628110000001', 'Desa Sukamaju'),
  (2, 'Dewi Lestari',      'Sekretaris',       '628110000002', 'Desa Sukamaju'),
  (3, 'Ahmad Fauzi',       'Bendahara',        '628110000003', 'Desa Sukamaju'),
  (4, 'Siti Nurhaliza',    'Pengawas',         '628110000004', 'Desa Sukamaju'),
  (5, 'Bagus Prakoso',     'Manajer Usaha',    '628110000005', 'Desa Sukamaju');

-- Pengumuman contoh (hanya jika masih kosong, agar tak menumpuk saat re-run).
insert into public.pengumuman (judul, isi, penting, penulis)
select * from (values
  ('Jadwal e-RAT 2026', 'Rapat Anggota Tahunan akan digelar 28 Februari 2026 secara hybrid. Mohon anggota menyiapkan hak suara.', true,  'Sekretaris'),
  ('Simpanan Wajib Februari', 'Simpanan wajib bulan Februari Rp55.000 sudah dapat disetor via menu 1 → setor.', false, 'Bendahara'),
  ('Bazar Produk Anggota', 'Bazar produk anggota (keripik, sayur, dll) Minggu depan di balai desa. Yuk ramaikan!', false, 'Manajer Usaha')
) as v(judul, isi, penting, penulis)
where not exists (select 1 from public.pengumuman);

-- laporan_transparansi sengaja KOSONG — diisi anggota lewat menu 13 di bot.
