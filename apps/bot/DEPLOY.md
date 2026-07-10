# Deploy Bot 24/7 di Google Cloud (Compute Engine VM)

Panduan menjalankan bot WhatsApp **online terus** (tanpa laptop nyala) di VM GCP,
memanfaatkan credit $300. Cocok untuk demo/pilot koperasi.

> Bot ini pakai Baileys (WhatsApp Web). Login = scan QR **sekali**; sesi tersimpan
> di folder `auth/` sehingga restart tak perlu scan ulang.

---

## 1. Buat VM

GCP Console → **Compute Engine → VM instances → Create instance**:
- **Name**: `edigkop-bot`
- **Region**: `asia-southeast2` (Jakarta) — dekat DB nasional & pengguna
- **Machine type**: `e2-small` (2 vCPU, 2 GB) — cukup. (`e2-micro` lebih hemat, eligible free tier)
- **Boot disk**: Debian 12, 20 GB
- **Firewall**: TIDAK perlu allow HTTP/HTTPS (bot tak buka port publik — cuma keluar ke WA/API)
- Create.

> Estimasi biaya: e2-small ~$13/bln → $300 cukup ±1.5 tahun. e2-micro bisa ~gratis.

## 2. Masuk & pasang runtime

Klik **SSH** di VM. Lalu:
```bash
sudo apt update && sudo apt install -y unzip git
curl -fsSL https://bun.sh/install | bash        # pasang Bun
source ~/.bashrc
bun --version                                     # pastikan terpasang
```

## 3. Ambil kode

```bash
git clone https://github.com/ecodigitus/edigkop.git
cd edigkop
git checkout ikhsan-dev
bun install
```

## 4. Set konfigurasi (.env)

`.env` TIDAK ikut ke git (rahasia). Buat di server:
```bash
nano .env
```
Isi minimal (samakan dengan lokal): `GROQ_API_KEY` / `ANTHROPIC_API_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `DB_*` (DB nasional), dan `GCP_STT_API_KEY` (voice note).

> ⚠️ Keamanan: jangan commit `.env`. Batasi akses SSH VM. Rotasi key kalau bocor.

## 5. Login WhatsApp (scan QR sekali)

Jalankan sementara di layar yang bisa dilihat:
```bash
bun run src/index.ts
```
QR muncul di terminal → scan dari **WhatsApp → Perangkat Tertaut → Tautkan perangkat**.
Setelah "✅ Terhubung", sesi tersimpan di `auth/`. Hentikan (Ctrl+C).

## 6. Jalankan permanen (systemd — auto-restart & nyala saat boot)

```bash
sudo nano /etc/systemd/system/edigkop.service
```
Isi (ganti `USER` dengan user SSH-mu, cek via `whoami`):
```ini
[Unit]
Description=Edigkop WhatsApp Bot
After=network-online.target

[Service]
Type=simple
User=USER
WorkingDirectory=/home/USER/edigkop
ExecStart=/home/USER/.bun/bin/bun run src/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Aktifkan:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now edigkop
sudo systemctl status edigkop        # cek jalan
journalctl -u edigkop -f             # lihat log real-time
```

## 7. Update kode (saat ada perubahan baru)

```bash
cd ~/edigkop && git pull
bun install
sudo systemctl restart edigkop
```

---

## Catatan

- **Sesi WA putus?** Kalau HP unlink perangkat, hapus folder `auth/` lalu ulangi langkah 5.
- **Backup `auth/`**: berisi kredensial sesi WA — jaga kerahasiaannya.
- **Alternatif** tanpa systemd: pakai `tmux`/`screen` + `bun run src/index.ts` (kurang tahan mati).
- Bot hanya **koneksi keluar** (WA, Supabase, GCP STT, DB nasional) → tak perlu buka port masuk.
