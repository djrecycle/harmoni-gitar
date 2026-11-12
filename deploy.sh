#!/usr/bin/env bash
# Kirim kode ke VPS lalu bangun ulang container Harmoni Gitar (pola yang sama dengan deploy.sh LMS Harmoni).
#
#   ./deploy.sh
#
# Pembangunan berjalan terlepas di VPS (log: /root/harmoni-gitar-deploy.log), jadi koneksi SSH yang putus
# tidak menghentikannya: skrip ini hanya menyambung ulang dan terus mengikuti log sampai selesai.
# Persiapan pertama kali di VPS: lihat bagian "Deploy ke VPS" di docs/RENCANA_TEKNIS.md.
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# Data server ada di .deploy.env (tidak masuk git). Salin dari .deploy.env.example.
[ -f .deploy.env ] && source .deploy.env
VPS_HOST="${VPS_HOST:?Isi VPS_HOST di .deploy.env (mis. root@203.0.113.10)}"
REMOTE_DIR="${REMOTE_DIR:-/opt/harmoni-gitar}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"

LOG=/root/harmoni-gitar-deploy.log
PIDFILE=/root/harmoni-gitar-deploy.pid
EXITFILE=/root/harmoni-gitar-deploy.exit
COMPOSE="docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.vps.yml"

SSH_OPTS=(-i "$SSH_KEY" -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -o ConnectTimeout=15)
SSH=(ssh "${SSH_OPTS[@]}")

# Hanya kode yang sudah di-commit yang di-deploy, supaya setiap versi live bisa dilacak di riwayat git.
if [ -n "$(git status --porcelain)" ]; then
  echo "!! Masih ada perubahan yang belum di-commit. Commit dulu, lalu deploy lagi:" >&2
  git status --short >&2
  exit 1
fi
COMMIT="$(git rev-parse HEAD)"
echo "==> Deploy commit $(git log -1 --format='%h %s' "$COMMIT")"

echo "==> Menyiapkan $VPS_HOST:$REMOTE_DIR"
"${SSH[@]}" "$VPS_HOST" bash -s -- "$REMOTE_DIR" <<'REMOTE'
set -euo pipefail
mkdir -p "$1"
if [ ! -f "$1/.env.docker" ]; then
  echo "!! $1/.env.docker belum ada. Buat dulu dari .env.docker.example (kata sandi dan secret baru," >&2
  echo "   BETTER_AUTH_URL=https://harmoniclass.tech), lalu deploy lagi." >&2
  exit 1
fi
REMOTE

echo "==> Menyalin file ke $VPS_HOST:$REMOTE_DIR"
for attempt in 1 2 3; do
  rsync -az --delete --timeout=60 \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude 'uploads' \
    --exclude 'backups' \
    --exclude 'tsconfig.tsbuildinfo' \
    --exclude '.env.local' \
    --exclude '.env.docker' \
    --exclude '.deploy.env' \
    --exclude '.git' \
    -e "ssh ${SSH_OPTS[*]}" \
    ./ "$VPS_HOST:$REMOTE_DIR/" && break
  [ "$attempt" -eq 3 ] && { echo "!! Penyalinan gagal 3 kali, tidak ada yang dibangun ulang." >&2; exit 1; }
  echo "!! Penyalinan terputus, mencoba lagi dalam 10 detik ($attempt/3)…"
  sleep 10
done

echo "==> Memulai pembangunan ulang di VPS (terlepas)"
# Hanya argumen satu kata di sini: ssh menggabungkannya jadi satu baris perintah.
"${SSH[@]}" "$VPS_HOST" bash -s -- "$REMOTE_DIR" "$LOG" "$PIDFILE" "$EXITFILE" <<'REMOTE'
set -euo pipefail
REMOTE_DIR="$1"; LOG="$2"; PIDFILE="$3"; EXITFILE="$4"
COMPOSE="docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.vps.yml"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "!! Deploy lain masih berjalan (pid $(cat "$PIDFILE")). Ikuti dengan: tail -f $LOG" >&2
  exit 1
fi
rm -f "$EXITFILE"
cd "$REMOTE_DIR"
nohup setsid sh -c "echo \$\$ > $PIDFILE; $COMPOSE up -d --build; echo \$? > $EXITFILE" > "$LOG" 2>&1 < /dev/null &
for _ in 1 2 3 4 5 6 7 8 9 10; do [ -s "$PIDFILE" ] && exit 0; sleep 0.5; done
echo "!! Pembangunan tidak mulai, lihat $LOG" >&2
exit 1
REMOTE

echo "==> Mengikuti $LOG (aman kalau koneksi putus, akan tersambung lagi)"
SHOWN="$(mktemp)"
trap 'rm -f "$SHOWN"' EXIT
for attempt in $(seq 1 60); do
  seen=$(wc -l < "$SHOWN")
  if "${SSH[@]}" "$VPS_HOST" "tail -n +$((seen + 1)) -f --pid=\$(cat $PIDFILE) $LOG" | tee -a "$SHOWN"; then
    if "${SSH[@]}" "$VPS_HOST" "test -f $EXITFILE"; then break; fi
  fi
  echo "!! Koneksi putus, pembangunan tetap jalan di VPS. Menyambung lagi dalam 10 detik ($attempt/60)…"
  sleep 10
done

code=$("${SSH[@]}" "$VPS_HOST" "cat $EXITFILE 2>/dev/null || echo unknown")
if [ "$code" != "0" ]; then
  echo "!! Pembangunan tidak selesai dengan baik (exit: $code). Container lama tetap berjalan. Log: ssh $VPS_HOST tail -n 100 $LOG" >&2
  exit 1
fi

TAG="deploy-$(date +%F-%H%M)"
git tag "$TAG" "$COMMIT"
echo "==> Commit yang live ditandai $TAG"

echo "==> Selesai. Status:"
"${SSH[@]}" "$VPS_HOST" "cd $REMOTE_DIR && $COMPOSE ps"
