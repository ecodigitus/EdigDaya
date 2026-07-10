# EdigDaya — Koperasi Digital (Monorepo)

Satu proyek, dua muka: **WhatsApp bot** untuk warga desa + **dashboard web** untuk
pengurus & nasional. Keduanya berbagi satu database (Google Cloud SQL). Peta lengkap:
[ARCHITECTURE.md](ARCHITECTURE.md).

## Struktur (Bun workspaces)

```
apps/bot/         WhatsApp CS bot (Baileys + AI)          → deploy: GCP VM systemd, outbound-only
apps/dashboard/   Bun API + React SPA (anggota/pengurus)  → deploy: GCP VM systemd + Caddy HTTPS
packages/         (disiapkan; kode bersama menyusul)
```

## Setup

```bash
bun install          # sekali di root (hoist deps, 1 bun.lock)
```

Tiap app punya `.env` sendiri di foldernya (rahasia, gitignored). Salin dari `.env.example`:

```bash
cp apps/bot/.env.example       apps/bot/.env
cp apps/dashboard/.env.example apps/dashboard/.env
```

## Jalankan (lokal)

```bash
bun run dev:bot          # bot WhatsApp (scan QR sekali)
bun run dev:dashboard    # dashboard di http://localhost:3000
```

## Build & produksi

```bash
bun run build:dashboard  # bundling frontend dashboard
bun run start:bot
bun run start:dashboard
```

## Deploy

Kedua app di satu GCE VM — runbook lengkap: **[DEPLOY.md](DEPLOY.md)**
(bot systemd + dashboard systemd + Caddy HTTPS via nip.io). Peta di
[ARCHITECTURE.md](ARCHITECTURE.md).

## Keamanan (OWASP)

Kredensial hanya dari `.env` (tak pernah di-commit). Least-privilege DB: dashboard
pakai akun `koperasi_app` (tulis hanya tabel tim `edig_dev_*`, baca 27 tabel nasional
read-only); bot baca DB nasional read-only. Rahasia bot yang harus ada di server & tak
masuk git: `apps/bot/.env`, `apps/bot/auth/`, `apps/bot/*-sa.json`.
