# EdigDaya — Dashboard Web Koperasi Digital

Dashboard web untuk koperasi digital: **portal anggota**, **portal pengurus**,
dan **ringkasan nasional**. Full-stack di atas Bun — satu proses menyajikan
**REST API** sekaligus **React SPA**.

Bagian dari sistem yang lebih besar — **satu solusi, dua muka**: dashboard ini
adalah muka **web**, sedangkan `../bot/` adalah muka **WhatsApp bot**.
Keduanya berbagi **satu database** (Cloud SQL). Peta lengkap:
[**`../ARCHITECTURE.md`**](../ARCHITECTURE.md).

## Teknologi

- **Server:** Bun (`src/server/*`) — router + REST API, sesi ber-HMAC (`SESSION_SECRET`)
- **Frontend:** React 19 + React Router + TanStack Query + Tailwind 4 (`src/pages/*`, `src/components/*`)
- **Data:** Google Cloud SQL (PostgreSQL) — baca 27 tabel nasional (read-only) + baca/tulis tabel tim `edig_dev_*`

## Struktur

| Path | Isi |
|------|-----|
| `src/server/routes/*` | endpoint API: `auth`, `anggota`, `pengurus`, `preorder`, `konten`, `nasional`, `profilkop`, `akun`, `health` |
| `src/server/db.ts`, `sdb.ts`, `tables.ts` | pool Cloud SQL + whitelist nama tabel (anti identifier-injection) |
| `src/server/auth.ts`, `scope.ts`, `validate.ts` | autentikasi, otorisasi per-peran, validasi input |
| `src/pages/anggota/*` | portal anggota (beranda, simpanan, pengajuan, pre-order, referral, transparansi) |
| `src/pages/pengurus/*` | portal pengurus (overview, anggota, gerai, produk, RAT, transaksi, dsb.) |
| `src/pages/Nasional.tsx` | ringkasan tingkat nasional |
| `scripts/*` | introspeksi & migrasi mirror (`mirror-*`, `supabase-*`), smoke test |

## Menjalankan (lokal)

```bash
bun install
# buat .env: DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD,
#            TEAM_NAME=edig_dev, SESSION_SECRET, APP_DB_USERNAME, APP_DB_PASSWORD
bun dev            # server + HMR di http://localhost:3000 (default PORT)
```

Produksi:

```bash
bun run build      # bundling frontend (build.ts)
bun start          # NODE_ENV=production
```

Cek koneksi & identitas DB: `GET /api/health`.

## Keamanan (OWASP-minded)

- Kredensial **hanya dari `.env`** (A05); tak ada secret di kode/ frontend.
- **Otorisasi di sisi server** (`scope.ts`) — bukan mengandalkan kunci anon di
  browser.
- Query **di-parameter-kan** (A03); nama tabel/kolom dari **whitelist**
  (`tables.ts`), bukan input pengguna.
- **Least privilege:** data nasional **read-only**; tulis hanya ke tabel tim
  `edig_dev_*` via akun aplikasi terbatas.
