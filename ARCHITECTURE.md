# Arsitektur Sistem — Koperasi Digital (Hackathon 2026)

**Satu solusi, dua muka.** Warga desa berinteraksi lewat **WhatsApp**; pengurus
& tingkat nasional lewat **dashboard web**. Keduanya berbagi **satu database**,
sehingga apa pun yang masuk dari WhatsApp langsung tampil di dashboard, dan
sebaliknya.

Ini **bukan dua proyek terpisah** — melainkan dua antarmuka di atas satu sumber
data yang sama.

---

## Peta komponen (monorepo Bun workspaces)

| App | Peran | Bentuk runtime | Deploy |
|------|-------|----------------|--------|
| **`apps/bot/`** | **Bot WhatsApp CS** (Baileys + AI). Menjawab warga, mendaftarkan anggota, terima pre-order, kirim broadcast. | Worker hidup terus, pegang sesi WhatsApp, **koneksi keluar saja** (tak buka port). | GCP VM + `systemd`, 24/7 (lihat `apps/bot/DEPLOY.md`). |
| **`apps/dashboard/`** | **Dashboard web**. Portal anggota, portal pengurus, ringkasan nasional. | Server HTTP biasa (Bun API + React SPA), request–response, stateless. | GCP VM yang sama, `systemd` service kedua di belakang Caddy (HTTPS). |
| ~~`archive/legacy-dashboard/`~~ | **DIARSIPKAN.** Dashboard lama (Vite + Supabase langsung dari frontend). Digantikan `apps/dashboard/`. | — | — (jangan dipakai) |

---

## Diagram alur data

```
        Warga desa                                   Pengurus / Nasional
            │                                                 │
       WhatsApp chat                                     Browser (web)
            │                                                 │
            ▼                                                 ▼
 ┌──────────────────────┐                      ┌───────────────────────────┐
 │  apps/bot   (BOT)    │                      │ apps/dashboard (DASHBOARD)│
 │  Baileys + AI        │                      │  Bun API  +  React SPA    │
 │ (Vertex/Groq/Claude) │                      │  auth + otorisasi server  │
 └──────────┬───────────┘                      └─────────────┬─────────────┘
            │  tulis/baca                        baca/tulis   │
            │                                                 │
            ▼                                                 ▼
 ╔═══════════════════════════════════════════════════════════════════════╗
 ║            Cloud SQL (PostgreSQL) — SATU sumber data bersama           ║
 ║                                                                       ║
 ║   ▸ Tabel TIM  (prefix edig_dev_ , boleh tulis)                       ║
 ║       edig_dev_members            · pendaftaran anggota               ║
 ║       edig_dev_pre_orders         · pre-order produk                  ║
 ║       edig_dev_pengumuman         · pengumuman                        ║
 ║       edig_dev_pengurus           · data pengurus                     ║
 ║       edig_dev_laporan_transparansi · laporan transparansi            ║
 ║                                                                       ║
 ║   ▸ 27 tabel NASIONAL  (milik panitia, READ-ONLY)                     ║
 ║       anggota_koperasi · profil_koperasi · pengurus_koperasi ·        ║
 ║       simpanan_anggota · transaksi_penjualan · gerai_koperasi · …     ║
 ╚═══════════════════════════════════════════════════════════════════════╝
```

**Kunci integrasi:** kedua sistem menulis/membaca **nama tabel yang sama**
(`edig_dev_*`) di **host Cloud SQL yang sama**. Tidak ada sinkronisasi/kopi data
antar-sistem — mereka memang satu database. Contoh: warga daftar via WhatsApp →
bot `INSERT` ke `edig_dev_members` → pengurus langsung melihatnya di dashboard.

---

## Kenapa tetap 2 proses (bukan digabung jadi 1)?

Menggabung bot dan dashboard menjadi satu aplikasi **merugikan**, bukan
menyederhanakan:

1. **Sifat runtime berbeda.** Bot adalah worker *stateful* yang memegang socket
   WhatsApp + sesi QR dan harus hidup terus. Dashboard adalah server
   *stateless* request–response. Menyatukannya berarti **setiap deploy/restart
   dashboard memutus sesi WhatsApp** → harus scan QR ulang. Itu fatal untuk
   layanan yang harus online 24/7.
2. **Permukaan jaringan berbeda.** Bot **tidak membuka port masuk** (aman —
   hanya koneksi keluar ke WhatsApp/DB/AI). Dashboard justru harus membuka
   HTTP. Memisahkan keduanya menjaga bot tetap tak terekspos (prinsip
   *least exposure*).
3. **Skala & rilis independen.** Dashboard bisa di-scale/rilis sering tanpa
   menyentuh bot, dan sebaliknya.

**Titik penyatuan yang benar adalah database — dan itu sudah tercapai.**

---

## Model keamanan (ringkas, OWASP-minded)

- **Kredensial hanya dari `.env`**, tak pernah di-hardcode (A05). Lihat
  `apps/bot/src/config.ts` dan `apps/dashboard/src/server/config.ts`.
- **Hak akses berjenjang (least privilege):**
  - Data nasional diakses lewat akun **read-only**.
  - Tulis hanya ke tabel tim `edig_dev_*` lewat akun aplikasi terbatas
    (`koperasi_app`).
  - Bot **tidak pernah** menulis ke tabel nasional.
- **Anti SQL-injection (A03):** semua nilai di-*parameter*-kan (tagged template
  Bun.SQL). Nama tabel/kolom berasal dari *whitelist* di kode
  (`apps/dashboard/src/server/tables.ts`), bukan input pengguna.
- **Dashboard:** otorisasi dilakukan **di sisi server**, bukan mengandalkan
  kunci anon di frontend (alasan dashboard lama diarsipkan).
- **Rahasia bot** yang harus ada di server & gitignored: `apps/bot/.env`,
  sesi WhatsApp `apps/bot/auth/` (kredensial WA), dan service-account Vertex
  `apps/bot/*-sa.json`.

> Dokumen ini tidak memuat host/kredensial asli. Semua nilai nyata ada di file
> `.env` masing-masing app (tidak di-commit).

---

## Cara menjalankan (ringkas)

Sekali di root: `bun install` (Bun workspaces, satu `bun.lock`).

**Bot WhatsApp** — `apps/bot/`
```bash
cp apps/bot/.env.example apps/bot/.env   # isi CLOUDSQL_*, DB_* (nasional), AI (VERTEX_* / key)
bun run dev:bot                          # scan QR sekali; sesi tersimpan di apps/bot/auth/
```
Deploy 24/7: lihat `apps/bot/DEPLOY.md` (GCP VM + systemd).

**Dashboard web** — `apps/dashboard/`
```bash
cp apps/dashboard/.env.example apps/dashboard/.env   # DB_* (mirror), TEAM_NAME=edig_dev, SESSION_SECRET, APP_DB_*
bun run dev:dashboard                                # http://localhost:3000
```

---

## Riwayat / catatan migrasi

- Sisi **bot** dulu memakai Supabase, kini pindah ke **Cloud SQL**
  (`apps/bot/src/db.ts`). Variabel `SUPABASE_*` dipertahankan sebagai *legacy*
  opsional dan boleh dikosongkan.
- **Dashboard lama** (Vite + Supabase) **diarsipkan** di `archive/legacy-dashboard/`
  dan digantikan `apps/dashboard/`. Kode lamanya sengaja tidak dihapus (arsip).
- Kedua project dulu terpisah (`edigkop` = repo git; `hackathon2026` = belum di-git),
  kini disatukan jadi monorepo **EdigDaya** dengan histori bot terjaga (git subtree).
