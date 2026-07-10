-- ============================================================================
--  MIGRASI: kasih prefix "edig_dev_" ke tabel BOT yang sudah terlanjur dibuat
--  tanpa prefix. Jalankan SEKALI di Cloud SQL Studio.
--
--  Non-destruktif: RENAME (data seed tetap terjaga). Trigger append-only pada
--  laporan_transparansi otomatis ikut ke tabel hasil rename.
--  IF EXISTS -> aman kalau sebagian sudah di-rename / tak ada.
-- ============================================================================
alter table if exists members              rename to edig_dev_members;
alter table if exists pre_orders           rename to edig_dev_pre_orders;
alter table if exists pengurus             rename to edig_dev_pengurus;
alter table if exists pengumuman           rename to edig_dev_pengumuman;
alter table if exists laporan_transparansi rename to edig_dev_laporan_transparansi;
