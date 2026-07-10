-- ============================================================================
--  SCHEMA + SEED untuk Google Cloud SQL (PostgreSQL) — DB milik BOT.
--  Tabel diberi prefix tim "edig_dev_" (samakan dengan DB_TABLE_PREFIX di .env).
--  Versi BERSIH (tanpa fitur khusus Supabase: RLS, role, RPC, grant).
--
--  Cara pakai (fresh install):
--    1. Buat database di Cloud SQL, konek via Cloud SQL Studio / psql.
--    2. Jalankan seluruh file ini.
--  Kalau tabel LAMA (tanpa prefix) sudah terlanjur dibuat, jangan pakai file ini
--  — pakai cloudsql/rename-prefix.sql untuk rename saja.
--
--  Idempoten: aman dijalankan ulang (create if not exists + upsert seed).
--  Semua data = DUMMY untuk demo.
-- ============================================================================

create table if not exists edig_dev_members (
  no_anggota         text primary key,
  phone              text unique,
  nama               text not null,
  sejak              text,
  role               text not null default 'anggota' check (role in ('produsen','anggota')),
  simpanan_pokok     bigint not null default 0,
  simpanan_wajib     bigint not null default 0,
  simpanan_sukarela  bigint not null default 0,
  estimasi_shu       bigint not null default 0,
  poin               integer not null default 0,
  lencana            text,
  skor_keterlibatan  integer not null default 0,
  kode_referral      text,
  nik                text,
  keuangan           jsonb,
  pinjaman           jsonb,
  usaha              jsonb,
  pendaftaran        jsonb,
  updated_at         timestamptz not null default now()
);

create table if not exists edig_dev_pre_orders (
  id                 text primary key,
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
  produsen_kandidat  jsonb,
  produsen_idx       integer not null default 0,
  created_at         timestamptz not null default now()
);

create table if not exists edig_dev_pengurus (
  id          bigint generated always as identity primary key,
  urutan      integer not null default 0,
  nama        text not null,
  jabatan     text not null,
  no_hp       text,
  wilayah     text,
  updated_at  timestamptz not null default now()
);

create table if not exists edig_dev_pengumuman (
  id          bigint generated always as identity primary key,
  judul       text not null,
  isi         text not null,
  penting     boolean not null default false,
  penulis     text,
  created_at  timestamptz not null default now()
);

create table if not exists edig_dev_laporan_transparansi (
  id            bigint generated always as identity primary key,
  kategori      text not null default 'Lainnya',
  isi           text not null,
  anonim        boolean not null default false,
  pelapor_nama  text,
  pelapor_no    text,
  status        text not null default 'BELUM_DIVERIFIKASI'
                  check (status in ('BELUM_DIVERIFIKASI','DITINDAKLANJUTI','SELESAI')),
  created_at    timestamptz not null default now()
);

-- Trigger anti hapus/ubah (laporan permanen — inti fitur anti-tutup-mulut).
create or replace function block_laporan_mutation()
  returns trigger language plpgsql as $$
begin
  raise exception 'laporan bersifat append-only: UPDATE/DELETE tidak diizinkan';
end;
$$;
drop trigger if exists trg_block_laporan_mutation on edig_dev_laporan_transparansi;
create trigger trg_block_laporan_mutation
  before update or delete on edig_dev_laporan_transparansi
  for each row execute function block_laporan_mutation();

-- ---------------------------------------------------------------------------
--  SEED members
-- ---------------------------------------------------------------------------
insert into edig_dev_members
  (no_anggota, phone, nama, sejak, role, simpanan_pokok, simpanan_wajib, simpanan_sukarela,
   estimasi_shu, poin, lencana, skor_keterlibatan, kode_referral, nik, keuangan, pinjaman, usaha, pendaftaran)
values
  ('KMP-2019-0043','628123456789','Bu Sri Rahayu','Agustus 2019','produsen',
   100000,3300000,2500000,540000,3180,'Anggota Teladan 🥇',92,'SRI2019',null,
   '{"modal":5000000,"pengeluaran":3200000}'::jsonb, null,
   '{"namaUsaha":"Warung Keripik Bu Sri","kerugian":150000,"produk":[
      {"nama":"Keripik Singkong","stok":40,"terjual":120,"hargaJual":15000},
      {"nama":"Keripik Pisang","stok":25,"terjual":85,"hargaJual":18000},
      {"nama":"Rempeyek Kacang","stok":60,"terjual":60,"hargaJual":12000}]}'::jsonb,
   '{"nik":"3201234567890043","jenisKelamin":"Perempuan","email":"sri.rahayu@example.com","nomorHp":"6281234567890","provinsi":"Jawa Barat","kabupaten":"Kabupaten Bogor","kecamatan":"Cibinong","desa":"Sukamaju","koperasi":"Koperasi Desa Merah Putih"}'::jsonb),

  ('KMP-2024-0311','628987654321','Pak Budi Santoso','Mei 2024','anggota',
   100000,660000,0,68000,120,'Anggota Baru 🥉',31,'BUDI2024',null,
   '{"modal":760000,"pengeluaran":450000}'::jsonb, null, null,
   '{"nik":"3201234567890311","jenisKelamin":"Laki-laki","email":"budi.santoso@example.com","nomorHp":"6289876543210","provinsi":"Jawa Barat","kabupaten":"Kabupaten Bogor","kecamatan":"Cibinong","desa":"Sukamaju","koperasi":"Koperasi Desa Merah Putih"}'::jsonb),

  ('KMP-2021-0157',null,'Andi Wijaya','Maret 2021','produsen',
   100000,2640000,750000,312000,1240,'Anggota Aktif 🥈',78,'ANDI2021',null,
   '{"modal":4000000,"pengeluaran":2100000}'::jsonb,
   '{"sisa":3500000,"angsuranPerBulan":620000,"tenorSisa":6}'::jsonb,
   '{"namaUsaha":"Kebun Sayur Pak Andi","kerugian":220000,"produk":[
      {"nama":"Sawi Hijau","stok":30,"terjual":95,"hargaJual":8000},
      {"nama":"Tomat","stok":20,"terjual":70,"hargaJual":12000},
      {"nama":"Cabai Merah","stok":15,"terjual":40,"hargaJual":35000}]}'::jsonb,
   '{"nik":"3201234567890157","jenisKelamin":"Laki-laki","email":"andi.wijaya@example.com","nomorHp":"6281200000157","provinsi":"Jawa Barat","kabupaten":"Kabupaten Bogor","kecamatan":"Cibinong","desa":"Sukamaju","koperasi":"Koperasi Desa Merah Putih"}'::jsonb),

  ('KMP-2020-0088',null,'Ibu Wati Ningsih','Januari 2020','produsen',
   100000,1800000,500000,210000,640,'Anggota Aktif 🥈',70,'WATI2020',null,
   '{"modal":3000000,"pengeluaran":1500000}'::jsonb, null,
   '{"namaUsaha":"Katering Bu Wati","kerugian":80000,"produk":[
      {"nama":"Nasi Kotak","stok":50,"terjual":210,"hargaJual":18000},
      {"nama":"Snack Box","stok":80,"terjual":150,"hargaJual":12000},
      {"nama":"Tumpeng Mini","stok":10,"terjual":25,"hargaJual":75000}]}'::jsonb,
   '{"jenisKelamin":"Perempuan","email":"wati.ningsih@example.com","koperasi":"Koperasi Desa Merah Putih"}'::jsonb),

  ('KMP-2022-0145',null,'Pak Joko Susilo','Maret 2022','anggota',
   100000,900000,0,90000,210,'Anggota Baru 🥉',40,'JOKO2022',null,
   '{"modal":1000000,"pengeluaran":600000}'::jsonb,
   '{"sisa":2000000,"angsuranPerBulan":350000,"tenorSisa":6}'::jsonb, null,
   '{"jenisKelamin":"Laki-laki","email":"joko.susilo@example.com","koperasi":"Koperasi Desa Merah Putih"}'::jsonb)
on conflict (no_anggota) do update set
  phone=excluded.phone, nama=excluded.nama, sejak=excluded.sejak, role=excluded.role,
  simpanan_pokok=excluded.simpanan_pokok, simpanan_wajib=excluded.simpanan_wajib,
  simpanan_sukarela=excluded.simpanan_sukarela, estimasi_shu=excluded.estimasi_shu,
  poin=excluded.poin, lencana=excluded.lencana, skor_keterlibatan=excluded.skor_keterlibatan,
  kode_referral=excluded.kode_referral, keuangan=excluded.keuangan, pinjaman=excluded.pinjaman,
  usaha=excluded.usaha, pendaftaran=excluded.pendaftaran, updated_at=now();

-- ---------------------------------------------------------------------------
--  SEED pengurus & pengumuman
-- ---------------------------------------------------------------------------
truncate table edig_dev_pengurus restart identity;
insert into edig_dev_pengurus (urutan, nama, jabatan, no_hp, wilayah) values
  (1,'H. Suryadi','Ketua','628110000001','Desa Sukamaju'),
  (2,'Dewi Lestari','Sekretaris','628110000002','Desa Sukamaju'),
  (3,'Ahmad Fauzi','Bendahara','628110000003','Desa Sukamaju'),
  (4,'Siti Nurhaliza','Pengawas','628110000004','Desa Sukamaju'),
  (5,'Bagus Prakoso','Manajer Usaha','628110000005','Desa Sukamaju');

insert into edig_dev_pengumuman (judul, isi, penting, penulis)
select * from (values
  ('Jadwal e-RAT 2026','Rapat Anggota Tahunan digelar 28 Februari 2026 secara hybrid. Mohon anggota menyiapkan hak suara.', true, 'Sekretaris'),
  ('Simpanan Wajib Februari','Simpanan wajib bulan Februari Rp55.000 sudah dapat disetor via menu 2 → setor.', false, 'Bendahara'),
  ('Bazar Produk Anggota','Bazar produk anggota (keripik, sayur, dll) Minggu depan di balai desa. Yuk ramaikan!', false, 'Manajer Usaha')
) as v(judul, isi, penting, penulis)
where not exists (select 1 from edig_dev_pengumuman);
