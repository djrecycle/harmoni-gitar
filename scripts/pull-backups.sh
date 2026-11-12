#!/usr/bin/env bash
# Tarik backup harian dari VPS ke laptop: Harmoni Gitar dan LMS Harmoni (satu VPS).
#
#   ./scripts/pull-backups.sh            # tarik sekarang
#   ./scripts/pull-backups.sh --install  # pasang timer systemd user: tiap hari 08.00, menyusul kalau laptop mati
#
# Hanya file baru yang diunduh (rsync). Di laptop disimpan $KEEP_DAYS hari, lebih lama dari VPS (14 backup),
# jadi backup lama masih ada walaupun VPS hilang. Server diambil dari VPS_HOST di .deploy.env.
# Peringatan muncul di log kalau backup terbaru di VPS lebih tua dari 2 hari (cron di VPS mungkin mati).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
SELF="$PWD/scripts/pull-backups.sh"

if [ "${1:-}" = "--install" ]; then
  UNIT_DIR="$HOME/.config/systemd/user"
  mkdir -p "$UNIT_DIR"
  cat > "$UNIT_DIR/harmoni-pull-backups.service" <<EOF
[Unit]
Description=Tarik backup Harmoni Gitar + LMS Harmoni dari VPS
After=network-online.target

[Service]
Type=oneshot
ExecStart=$SELF
EOF
  cat > "$UNIT_DIR/harmoni-pull-backups.timer" <<EOF
[Unit]
Description=Tarik backup Harmoni dari VPS setiap hari

[Timer]
OnCalendar=*-*-* 08:00
Persistent=true
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now harmoni-pull-backups.timer
  systemctl --user list-timers harmoni-pull-backups.timer --no-pager
  exit 0
fi

[ -f .deploy.env ] && source .deploy.env
VPS_HOST="${VPS_HOST:?Isi VPS_HOST di .deploy.env (mis. root@203.0.113.10)}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
DEST="${DEST:-$HOME/harmoni-backups/harian}"
KEEP_DAYS="${KEEP_DAYS:-60}"
SSH="ssh -i $SSH_KEY -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15"

mkdir -p "$DEST"
exec > >(tee -a "$DEST/pull.log") 2>&1
echo "==> $(date '+%F %T') menarik backup dari $VPS_HOST"

status=0
# nama lokal | folder di VPS | pola file
for entry in "harmoni-gitar|/opt/harmoni-gitar/backups|harmoni-gitar-*" "harmoni-lms|/var/backups/harmoni-lms|harmoni-lms-*"; do
  IFS='|' read -r name remote pattern <<< "$entry"
  mkdir -p "$DEST/$name"
  # -t menyimpan waktu file dari VPS, dipakai untuk retensi dan pengecekan umur di bawah.
  if ! rsync -rt --timeout=120 -e "$SSH" --include="$pattern.gz" --include='backup.log' --exclude='*' \
    "$VPS_HOST:$remote/" "$DEST/$name/"; then
    echo "!! $name: gagal menarik dari $remote"
    status=1
    continue
  fi
  find "$DEST/$name" -name "$pattern.gz" -mtime +"$KEEP_DAYS" -delete
  newest=$(ls -1t "$DEST/$name"/*-db-*.sql.gz 2>/dev/null | head -1 || true)
  if [ -z "$newest" ]; then
    echo "!! $name: belum ada dump database"
    status=1
  elif [ -n "$(find "$newest" -mmin +$((48 * 60)))" ]; then
    echo "!! $name: dump terbaru lebih tua dari 2 hari ($(basename "$newest")). Cek cron backup di VPS."
    status=1
  else
    echo "--> $name: $(ls -1 "$DEST/$name"/*.gz | wc -l) file, terbaru $(basename "$newest") ($(du -h "$newest" | cut -f1))"
  fi
done

echo "==> Selesai (status $status)"
exit "$status"
