#!/usr/bin/env bash
# =====================================================================
# deploy-vm.sh — setup bot + dashboard + Caddy di GCE VM (monorepo EdigDaya)
#
# Jalankan DI VM, dari root repo (~/EdigDaya):
#     bash scripts/deploy-vm.sh <SITE_ADDRESS>
# contoh:
#     bash scripts/deploy-vm.sh 34.142.204.106.nip.io       # tanpa domain (Let's Encrypt via nip.io)
#     bash scripts/deploy-vm.sh dashboard.namamu.com         # dengan domain
#
# Prasyarat sebelum jalan:
#   - apps/bot/.env & apps/dashboard/.env sudah di-upload (scp)
#   - (opsional AI) apps/bot/edig-sa.json sudah di-upload
#   - firewall VM buka 80 & 443
#
# NON-DESTRUKTIF & idempoten (aman diulang). Tak pernah hapus data.
# =====================================================================
set -euo pipefail

SITE="${1:-}"
if [ -z "$SITE" ]; then
  echo "Usage: bash scripts/deploy-vm.sh <SITE_ADDRESS>  (mis. 34.142.204.106.nip.io atau dashboard.namamu.com)"
  exit 1
fi

REPO="$(cd "$(dirname "$0")/.." && pwd)"
BUN="$HOME/.bun/bin/bun"
echo "==> Repo=$REPO  User=$USER  Site=$SITE"

# --- 1. Paket dasar + Bun ---
sudo apt-get update -y
sudo apt-get install -y git unzip curl debian-keyring debian-archive-keyring apt-transport-https
if [ ! -x "$BUN" ]; then
  echo "==> Pasang Bun..."
  curl -fsSL https://bun.sh/install | bash
fi
"$BUN" --version

# --- 2. Caddy ---
if ! command -v caddy >/dev/null 2>&1; then
  echo "==> Pasang Caddy..."
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y && sudo apt-get install -y caddy
fi

# --- 3. Dependencies ---
echo "==> bun install (root workspaces)..."
cd "$REPO" && "$BUN" install

# --- 4. Cek & kunci rahasia ---
[ -f "$REPO/apps/bot/.env" ]       || { echo "!! apps/bot/.env belum ada — upload dulu (scp), lalu ulangi."; exit 1; }
[ -f "$REPO/apps/dashboard/.env" ] || { echo "!! apps/dashboard/.env belum ada — upload dulu (scp), lalu ulangi."; exit 1; }
chmod 600 "$REPO/apps/bot/.env" "$REPO/apps/dashboard/.env" || true
[ -f "$REPO/apps/bot/edig-sa.json" ] && chmod 600 "$REPO/apps/bot/edig-sa.json" || true

# --- 5. systemd units ---
echo "==> Tulis systemd units..."
sudo tee /etc/systemd/system/edig-bot.service >/dev/null <<EOF
[Unit]
Description=EdigDaya WhatsApp Bot
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=$USER
WorkingDirectory=$REPO/apps/bot
ExecStart=$BUN run src/index.ts
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/edig-dashboard.service >/dev/null <<EOF
[Unit]
Description=EdigDaya Dashboard (Bun API + SPA)
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=$USER
WorkingDirectory=$REPO/apps/dashboard
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=$BUN run src/index.ts
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF

# --- 6. Caddyfile (HTTPS otomatis) ---
echo "==> Tulis /etc/caddy/Caddyfile untuk $SITE..."
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$SITE {
    reverse_proxy 127.0.0.1:3000
    encode gzip
}
EOF

# --- 7. Jalankan ---
sudo systemctl daemon-reload
sudo systemctl enable --now edig-dashboard
sudo systemctl reload caddy 2>/dev/null || sudo systemctl restart caddy

# Bot: start hanya jika sesi WA (auth/) sudah ada; kalau belum, minta scan QR dulu.
if [ -d "$REPO/apps/bot/auth" ] && [ -n "$(ls -A "$REPO/apps/bot/auth" 2>/dev/null)" ]; then
  sudo systemctl enable --now edig-bot
  echo "==> edig-bot dijalankan (sesi WA ditemukan)."
else
  echo ""
  echo "!!  Sesi WhatsApp belum ada. Scan QR dulu (sekali):"
  echo "      cd $REPO/apps/bot && $BUN run src/index.ts     # scan, tunggu 'Terhubung', lalu Ctrl+C"
  echo "    lalu jalankan:  sudo systemctl enable --now edig-bot"
fi

# --- 8. Cek kesehatan dashboard ---
echo ""
echo "==> Verifikasi dashboard..."
curl -sf --retry 15 --retry-delay 1 --retry-connrefused http://127.0.0.1:3000/api/health \
  && echo "  <== dashboard OK" \
  || echo "  (dashboard belum merespons — cek: journalctl -u edig-dashboard -n 40)"

echo ""
echo "==> SELESAI. Akses dashboard:  https://$SITE"
echo "    Status : systemctl status edig-bot edig-dashboard caddy --no-pager"
echo "    Log    : journalctl -u edig-bot -f   |   -u edig-dashboard -f   |   -u caddy -f"
