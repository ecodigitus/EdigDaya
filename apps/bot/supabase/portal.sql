-- ============================================================================
--  RPC untuk PORTAL ANGGOTA (POV warga) — dijalankan SEKALI di SQL Editor
--  setelah schema.sql.
--
--  Kenapa RPC (bukan buka RLS)? Portal anggota bersifat publik (tanpa login
--  admin), tapi RLS tabel tetap KETAT. Fungsi SECURITY DEFINER berjalan sebagai
--  owner sehingga bisa mengembalikan HANYA data yang relevan (1 anggota + PO-nya)
--  tanpa membuka akses baca seluruh tabel ke anon (OWASP A01).
--
--  CATATAN DEMO: portal ini memakai data DUMMY. Untuk produksi, ganti dengan
--  autentikasi per-anggota (mis. OTP WhatsApp) agar tiap warga hanya bisa
--  mengakses datanya sendiri — bukan lewat tebak No. Anggota.
-- ============================================================================

-- Daftar warga demo untuk layar "aktivasi" (nama + peran saja, TANPA data keuangan).
create or replace function public.portal_daftar_demo()
returns table (no_anggota text, nama text, role text, lencana text)
language sql
security definer
set search_path = public
as $$
  select no_anggota, nama, role, lencana from public.members order by nama;
$$;

-- Ambil profil lengkap SATU anggota (data yang sama dgn yang dia lihat di WA).
create or replace function public.portal_member(p_no_anggota text)
returns public.members
language sql
security definer
set search_path = public
as $$
  select * from public.members where no_anggota = p_no_anggota;
$$;

-- Ambil daftar Pre-Order milik seorang anggota (dicocokkan via phone di user_jid).
create or replace function public.portal_pos(p_no_anggota text)
returns setof public.pre_orders
language sql
security definer
set search_path = public
as $$
  select p.*
  from public.pre_orders p
  join public.members m on m.no_anggota = p_no_anggota
  where m.phone is not null and p.user_jid like m.phone || '%'
  order by p.created_at desc;
$$;

-- Izinkan dipanggil dari frontend (anon = belum login, authenticated = admin).
grant execute on function public.portal_daftar_demo()      to anon, authenticated;
grant execute on function public.portal_member(text)        to anon, authenticated;
grant execute on function public.portal_pos(text)           to anon, authenticated;
