-- ============================================================================
--  Data pendaftaran LENGKAP untuk menu "Informasi Saya".
--  Additive & non-destruktif. Jalankan di Supabase SQL Editor.
--
--  Menyimpan detail hasil pendaftaran (jenis kelamin, email, HP, wilayah,
--  koperasi) dalam 1 kolom JSONB `pendaftaran`. NIK dummy disimpan di sini
--  TAPI ditampilkan tersamar di WhatsApp (hanya 4 digit terakhir) — UU PDP.
-- ============================================================================

-- 1) Kolom baru (idempoten).
alter table public.members add column if not exists pendaftaran jsonb;

-- 2) Isi data pendaftaran untuk anggota demo (UPDATE = non-destruktif).
update public.members set pendaftaran = '{
  "nik":"3201234567890043","jenisKelamin":"Perempuan","email":"sri.rahayu@example.com",
  "nomorHp":"6281234567890","provinsi":"Jawa Barat","kabupaten":"Kabupaten Bogor",
  "kecamatan":"Cibinong","desa":"Sukamaju","koperasi":"Koperasi Desa Merah Putih"
}'::jsonb where no_anggota = 'KMP-2019-0043';

update public.members set pendaftaran = '{
  "nik":"3201234567890311","jenisKelamin":"Laki-laki","email":"budi.santoso@example.com",
  "nomorHp":"6289876543210","provinsi":"Jawa Barat","kabupaten":"Kabupaten Bogor",
  "kecamatan":"Cibinong","desa":"Sukamaju","koperasi":"Koperasi Desa Merah Putih"
}'::jsonb where no_anggota = 'KMP-2024-0311';

update public.members set pendaftaran = '{
  "nik":"3201234567890157","jenisKelamin":"Laki-laki","email":"andi.wijaya@example.com",
  "nomorHp":"6281200000157","provinsi":"Jawa Barat","kabupaten":"Kabupaten Bogor",
  "kecamatan":"Cibinong","desa":"Sukamaju","koperasi":"Koperasi Desa Merah Putih"
}'::jsonb where no_anggota = 'KMP-2021-0157';

update public.members set pendaftaran = '{
  "nik":"3201234567890088","jenisKelamin":"Perempuan","email":"wati.ningsih@example.com",
  "nomorHp":"6281200000088","provinsi":"Jawa Barat","kabupaten":"Kabupaten Bogor",
  "kecamatan":"Cibinong","desa":"Sukamaju","koperasi":"Koperasi Desa Merah Putih"
}'::jsonb where no_anggota = 'KMP-2020-0088';

update public.members set pendaftaran = '{
  "nik":"3201234567890145","jenisKelamin":"Laki-laki","email":"joko.susilo@example.com",
  "nomorHp":"6281200000145","provinsi":"Jawa Barat","kabupaten":"Kabupaten Bogor",
  "kecamatan":"Cibinong","desa":"Sukamaju","koperasi":"Koperasi Desa Merah Putih"
}'::jsonb where no_anggota = 'KMP-2022-0145';
