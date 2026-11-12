#!/usr/bin/env bash
# Backup VPS sebelum deploy (dijalankan dari laptop, pola yang sama dengan backup.sh LMS Harmoni):
# dump database + arsip uploads di VPS, salinan folder kode, lalu salinannya diunduh ke laptop.
#
#   ./backup.sh && ./deploy.sh
#
# Bedanya dengan scripts/backup.sh: skrip itu membackup Docker di mesin tempat ia berjalan
# (dipakai cron harian di VPS, atau Docker di laptop). Skrip ini menjalankannya di VPS lewat SSH.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

[ -f .deploy.env ] && source .deploy.env
VPS_HOST="${VPS_HOST:?Isi VPS_HOST di .deploy.env (mis. root@203.0.113.10)}"
REMOTE_DIR="${REMOTE_DIR:-/opt/harmoni-gitar}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
KEEP_CODE="${KEEP_CODE:-5}"
TGL="$(date +%F-%H%M)"

echo "==> Backup di $VPS_HOST ($TGL)"
ssh -i "$SSH_KEY" -o BatchMode=yes "$VPS_HOST" bash -s -- "$REMOTE_DIR" "$TGL" "$KEEP_CODE" <<'REMOTE'
set -euo pipefail
REMOTE_DIR="$1"; TGL="$2"; KEEP="$3"
cd "$REMOTE_DIR"

# Dump database + arsip uploads ke $REMOTE_DIR/backups (14 terbaru, sama dengan backup harian).
# </dev/null: skrip ini sendiri dibaca bash dari stdin, dan `docker compose exec` akan ikut menelan sisanya.
./scripts/backup.sh < /dev/null

echo "--> Salinan kode: $REMOTE_DIR.bak-$TGL"
rsync -a --exclude 'backups/' "$REMOTE_DIR/" "$REMOTE_DIR.bak-$TGL/"
ls -1dt "$REMOTE_DIR".bak-* | tail -n +$((KEEP + 1)) | xargs -r rm -rf
REMOTE

echo "==> Mengunduh ke laptop"
./scripts/pull-backups.sh

echo "==> Backup selesai: $TGL"
