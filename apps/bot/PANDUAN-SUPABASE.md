# Panduan Setup — Supabase + Dashboard

Data dummy koperasi kini bisa disimulasikan di **Supabase** sebagai satu sumber data
bersama untuk **bot WhatsApp** dan **dashboard web**.

```
   Dashboard Web (React+Vite)  ──anon key + login──▶ ┐
                                                      ├─ SUPABASE (Postgres + RLS)
   Bot WhatsApp (Bun)          ──service_role key──▶ ┘
```

- Bot: **seed + write-through** — muat data saat start, tulis balik saat ada perubahan.
- Dashboard: baca langsung dari Supabase (auto-refresh via Realtime), semua di belakang login.

---

## 1. Buat project & tabel Supabase

1. Bikin project di https://supabase.com (gratis).
2. Buka **SQL Editor → New query**, paste seluruh isi [supabase/schema.sql](supabase/schema.sql), **Run**.
   → membuat tabel `members` & `pre_orders`, menyalakan **RLS**, dan seed 3 anggota dummy.
3. Query baru lagi, paste [supabase/portal.sql](supabase/portal.sql), **Run**.
   → membuat RPC untuk **Portal Anggota** (POV warga) tanpa membuka RLS tabel.
4. Buat akun admin dashboard: **Authentication → Users → Add user** (isi email + password).

## 2. Ambil kredensial

**Project Settings → API**:
- `Project URL`
- `anon public` key → untuk **dashboard** (aman dipublikasikan)
- `service_role` key → untuk **bot** (RAHASIA, server-side)

> ⚠️ **service_role key JANGAN pernah** ditaruh di folder `dashboard/` atau kode frontend.
> Kalau ke-bundle ke browser = bocor total (bypass RLS). Hanya di `.env` bot.

## 3. Konfigurasi bot (root)

Isi di [.env](.env):
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   (service_role)
```
Jalankan:
```bash
bun run dev
```
Cek log: `🗄️ Data dimuat dari Supabase { members: 3, preOrders: 0 }`.
Kalau `SUPABASE_*` dikosongkan → bot tetap jalan pakai data dummy in-memory (fallback aman).

## 4. Konfigurasi dashboard

Isi di `dashboard/.env`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   (anon public, BUKAN service_role)
```
Jalankan:
```bash
cd dashboard
npm install     # sekali saja
npm run dev
```
Buka URL yang muncul. Halaman depan punya 2 pintu:

- **👤 Masuk sebagai Anggota** → `/portal` → **pilih warga demo** (Bu Sri / Pak Budi / Andi) atau
  ketik No. Anggota → lihat portal 1:1 seperti di WhatsApp (simpanan, SHU, pinjaman, poin & misi,
  referral, dashboard usaha/keuangan, pre-order). Publik, tanpa login — data dibaca lewat RPC aman.
- **🏦 Login Pengurus/Admin** → `/admin` → **login** pakai akun admin (langkah 4) → kelola
  tabel Anggota & Pre-Order.

---

## Cara kerja sinkronisasi

| Aksi | Efek |
|---|---|
| Setor simpanan / nudge "YA" via WA | Saldo & poin di-update → **write-through** ke `members` → dashboard auto-refresh |
| Bikin/quote/finalisasi/batal PO via WA | Row `pre_orders` di-upsert → dashboard auto-refresh |
| Ubah status PO dari dashboard | Row `pre_orders` di-update (RLS: hanya user login) |

> Catatan MVP: perubahan PO **dari dashboard** belum langsung tercermin di memori bot
> (bot memuat PO hanya saat start). Untuk sinkron 2 arah penuh saat bot berjalan,
> tambahkan Supabase Realtime subscribe di sisi bot (opsional, menyusul).

## Tips demo ke juri (alur aktivasi berulang)

Alur pembuka penting: **calon anggota → aktivasi → jadi anggota → data masuk Supabase → tampil di dashboard/portal.**

1. Dari HP demo (nomor yang belum di-seed), ketik `mulai` → muncul welcome **4 pilihan**.
2. Ketik `4` (aktivasi kilat) atau `aktivasi manual` (form 12 langkah).
3. Selesai aktivasi → anggota baru **otomatis tersimpan ke Supabase** (`activateMember` → write-through). Buka dashboard admin / portal → datanya sudah ada.
4. Mau **ulang demo dari awal**? Ketik **`reset`** di chat → nomor balik jadi *calon anggota*, welcome muncul lagi. (Reset ini in-memory saja, non-destruktif — baris di Supabase tidak dihapus.)

> Catatan: nomor seed (Bu Sri `628123456789`, Pak Budi `628987654321`) memang langsung
> ke menu utama karena sudah terdaftar. Untuk memperagakan aktivasi, pakai nomor lain.

## Keamanan (OWASP)

- **RLS nyala** di semua tabel; `anon` (belum login) = **nol akses** ke data anggota (keuangan + data pribadi, UU PDP).
- Frontend hanya pakai **anon key**; penulisan sensitif (saldo, insert anggota) lewat **bot/service_role**.
- Secret via env var, tak ada yang hardcoded. `.env` (bot & dashboard) di-gitignore.
