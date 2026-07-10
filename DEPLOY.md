# Deploy EdigDaya di GCE VM (bot + dashboard, satu VM)

Runbook deploy **monorepo EdigDaya** dari nol di **Google Compute Engine**:
- **Bot WhatsApp** (`apps/bot`) — worker 24/7, outbound-only (tak buka port).
- **Dashboard web** (`apps/dashboard`) — Bun API + React SPA, di belakang **Caddy** (HTTPS).

> Semua perintah dijalankan **di VM** via tombol **SSH** di GCE Console (atau `gcloud`
> dari Cloud Shell — `gcloud` tak perlu terpasang di laptop). Ganti `USER` dengan user
> SSH-mu (cek: `whoami`), dan `IP_VM` dengan IP eksternal VM.

Repo: `https://github.com/ecodigitus/EdigDaya.git` (branch `main`).

---

## 0. Prinsip keamanan (OWASP) & backup

- **Rahasia tak pernah di git.** Diisi manual di VM: `apps/bot/.env`, `apps/bot/*-sa.json`,
  `apps/bot/auth/`, `apps/dashboard/.env`. Set `chmod 600` untuk file `.env` & `*-sa.json`.
- **HTTPS wajib** untuk dashboard (token sesi tak boleh lewat HTTP polos) → Caddy (Bagian 8).
- **Least privilege DB** tetap dipakai: dashboard pakai `koperasi_app` (tulis hanya
  `edig_dev_*`, baca 27 tabel nasional read-only); bot baca DB nasional read-only.
- **Backup-first (untuk update berikutnya):** sebelum `git pull`/perubahan besar, ambil
  **snapshot disk** VM dan salin `auth/` + `.env`. Deploy pertama ini belum ada data VM
  untuk di-backup.

---

## 1. Buat VM

GCE Console → **Compute Engine → VM instances → Create instance**:
- **Name**: `edigdaya`
- **Region/Zone**: `asia-southeast2` (Jakarta) — dekat DB & pengguna
- **Machine type**: `e2-medium` (2 vCPU, 4 GB) — **rekomendasi** (bot + dashboard + Caddy).
  Hemat: `e2-small` (2 GB) bisa, **tambah swap 2 GB** (Bagian 2).
- **Boot disk**: Debian 12, 20–30 GB
- **Firewall**: centang **Allow HTTP** + **Allow HTTPS** (untuk dashboard via Caddy).
  Bot tetap outbound-only (tak perlu port lain). **Jangan** buka port 3000 ke publik.
- **Create.**

Alternatif `gcloud` (Cloud Shell):
```bash
gcloud compute instances create edigdaya \
  --zone=asia-southeast2-a --machine-type=e2-medium \
  --image-family=debian-12 --image-project=debian-cloud \
  --boot-disk-size=30GB --tags=http-server,https-server
```
> Estimasi biaya e2-medium ~$27/bln → credit $300 cukup ±11 bln. e2-small ~$13/bln.

**Firewall (least exposure):** hanya **80/443** yang publik (Caddy). Port **3000 tetap tertutup**
di firewall — dashboard listen di VM tapi hanya dijangkau Caddy via `127.0.0.1`. Batasi **SSH (22)**
ke IP-mu bila bisa (VPC firewall / IAP).

---

## 2. Pasang runtime (Bun + Caddy)

Klik **SSH** di VM, lalu:
```bash
sudo apt update && sudo apt install -y git unzip curl debian-keyring debian-archive-keyring apt-transport-https
# Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version                       # pastikan terpasang (mis. 1.3.x)

# Caddy (repo resmi)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

**(Opsional, hanya jika pakai e2-small) tambah swap 2 GB:**
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 3. Ambil kode & install

```bash
cd ~
git clone https://github.com/ecodigitus/EdigDaya.git
cd EdigDaya
bun install                         # sekali di ROOT (Bun workspaces, 1 bun.lock)
```

---

## 4. Isi rahasia (secrets)

### Bot — `apps/bot/.env`
```bash
cp apps/bot/.env.example apps/bot/.env
nano apps/bot/.env      # isi lalu simpan
chmod 600 apps/bot/.env
```
Isi minimal:
- **AI**: `AI_PROVIDER=vertex` + `VERTEX_SA_KEY_FILE=/home/USER/EdigDaya/apps/bot/edig-sa.json`,
  `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`, `VERTEX_MODEL` (atau provider lain: Groq/Claude/Gemini).
- **DB bot (mirror, tulis)**: `CLOUDSQL_HOST`, `CLOUDSQL_PORT=5432`, `CLOUDSQL_DB`,
  `CLOUDSQL_USER`, `CLOUDSQL_PASSWORD`, `DB_TABLE_PREFIX=edig_dev_`.
- **DB nasional (read-only)**: `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`.
- (opsional) `GCP_STT_API_KEY`, `GCP_VISION_API_KEY`, `SIMKOPDES_*`, `ADMIN_NUMBERS`.

### Bot — service-account Vertex (JSON)
Upload file SA JSON ke VM (mis. via `nano` tempel isi, atau `gcloud compute scp`), simpan sebagai
`apps/bot/edig-sa.json`, lalu:
```bash
chmod 600 apps/bot/edig-sa.json     # gitignored (*-sa.json). VERTEX_SA_KEY_FILE menunjuk ke sini.
```

### Dashboard — `apps/dashboard/.env`
```bash
cp apps/dashboard/.env.example apps/dashboard/.env
nano apps/dashboard/.env
chmod 600 apps/dashboard/.env
```
Isi:
- **DB mirror**: `DB_HOST`, `DB_PORT=5432`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` (akun read-only).
- **Akun app (tulis edig_dev_*)**: `APP_DB_USERNAME=koperasi_app`, `APP_DB_PASSWORD=...`.
- `TEAM_NAME=edig_dev`, `PORT=3000`, `NODE_ENV=production`.
- **`SESSION_SECRET`** — WAJIB, buat acak: `openssl rand -hex 32` lalu tempel.

---

## 5. Login WhatsApp (scan QR sekali)

```bash
cd ~/EdigDaya/apps/bot
bun run src/index.ts        # QR muncul di terminal
```
Scan dari **WhatsApp → Perangkat Tertaut → Tautkan perangkat**. Setelah log "✅ Terhubung",
sesi tersimpan di `apps/bot/auth/`. Hentikan dengan **Ctrl+C**.

> **Punya sesi WA lokal yang sudah aktif?** Lewati scan: salin folder `auth/` dari laptop ke
> `~/EdigDaya/apps/bot/auth/` (mis. `gcloud compute scp --recurse ./auth edigdaya:~/EdigDaya/apps/bot/`).
> Jaga kerahasiaannya — isinya setara token login.

---

## 6. systemd — Bot (auto-restart, nyala saat boot)

`BUN=$(which bun)` untuk tahu path bun (biasanya `/home/USER/.bun/bin/bun`).
```bash
sudo nano /etc/systemd/system/edig-bot.service
```
```ini
[Unit]
Description=EdigDaya WhatsApp Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=USER
WorkingDirectory=/home/USER/EdigDaya/apps/bot
ExecStart=/home/USER/.bun/bin/bun run src/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now edig-bot
sudo systemctl status edig-bot          # aktif?
journalctl -u edig-bot -f               # log real-time (cari "Terhubung")
```

---

## 7. systemd — Dashboard

```bash
sudo nano /etc/systemd/system/edig-dashboard.service
```
```ini
[Unit]
Description=EdigDaya Dashboard (Bun API + SPA)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=USER
WorkingDirectory=/home/USER/EdigDaya/apps/dashboard
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/home/USER/.bun/bin/bun run src/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now edig-dashboard
sudo systemctl status edig-dashboard
curl -sSf http://127.0.0.1:3000/api/health   # cek lokal: {"ok":true,...}
```
> Server serve API + SPA dari import-graph Bun (tak butuh `bun run build`). Listen di `0.0.0.0:3000`
> tapi **hanya dijangkau Caddy** karena firewall menutup 3000 dari publik.

---

## 8. Caddy — HTTPS tanpa domain (via nip.io)

Tanpa domain, pakai **`IP_VM.nip.io`** (DNS gratis → resolve ke IP VM) supaya dapat sertifikat
**Let's Encrypt asli**. Ganti `IP_VM` dengan IP eksternal (mis. `34.101.22.33` → `34.101.22.33.nip.io`).

```bash
sudo nano /etc/caddy/Caddyfile
```
```caddy
IP_VM.nip.io {
    reverse_proxy 127.0.0.1:3000
    encode gzip
}
```
```bash
sudo systemctl reload caddy
journalctl -u caddy -f          # pastikan sertifikat terbit (obtained certificate)
```
Akses dashboard: **`https://IP_VM.nip.io`**

**Fallback** bila Let's Encrypt gagal (mis. rate-limit nip.io) — HTTPS self-signed (browser warning,
tapi tetap terenkripsi):
```caddy
https://IP_VM.nip.io {
    tls internal
    reverse_proxy 127.0.0.1:3000
}
```
Nanti saat sudah punya domain: ganti `IP_VM.nip.io` jadi `dashboard.domainmu.com`, arahkan A record
ke IP VM, `sudo systemctl reload caddy` — HTTPS penuh otomatis.

---

## 9. Verifikasi end-to-end

```bash
systemctl status edig-bot edig-dashboard caddy      # ketiganya active (running)
journalctl -u edig-bot -n 30 | grep -i terhubung    # bot konek WA
curl -sSf https://IP_VM.nip.io/api/health           # {"ok":true,"db":{...},"team":"edig_dev"}
```
Lalu buka `https://IP_VM.nip.io` di browser → login pengurus/anggota → data koperasi tampil
(bukti DB terakses via layout baru). Kirim pesan WA ke nomor bot → balasan menu muncul.

---

## 10. Operasional & update (backup-first)

**Update kode:**
```bash
cd ~/EdigDaya
# (backup dulu bila ada perubahan berisiko: snapshot disk + salin auth/ & .env)
git pull
bun install
sudo systemctl restart edig-bot edig-dashboard
```
**Snapshot backup (sebelum perubahan besar):** GCE Console → disk `edigdaya` → **Create snapshot**;
atau `gcloud compute disks snapshot edigdaya --zone=asia-southeast2-a`.

**Sesi WA putus** (HP unlink): `sudo systemctl stop edig-bot`, hapus `apps/bot/auth/`, ulangi Bagian 5,
`sudo systemctl start edig-bot`.

---

## 11. Checklist keamanan (OWASP)

- [ ] Firewall publik hanya **80/443**; **3000 tertutup**; **SSH(22)** dibatasi ke IP-mu / IAP.
- [ ] Semua `.env` & `*-sa.json` **chmod 600**, gitignored, tak pernah di-commit.
- [ ] **`SESSION_SECRET`** di-set acak (`openssl rand -hex 32`), bukan kosong.
- [ ] Dashboard diakses via **HTTPS** (Caddy) — bukan HTTP polos.
- [ ] Akun DB **least privilege**: `koperasi_app` (tulis `edig_dev_*` saja) + akun read-only nasional.
      Kredensial admin **tidak** ada di `.env` runtime (hanya untuk skrip migrasi manual).
- [ ] Bot **outbound-only** (tak buka port masuk).
- [ ] OS update rutin: `sudo apt update && sudo apt upgrade`. Pertimbangkan `unattended-upgrades`.
- [ ] Bila kredensial pernah bocor / repo public → **rotasi** password DB app + `SESSION_SECRET`.
```
