#!/usr/bin/env bash
# Backup harian (localhost): dump database dari container `db` + arsip folder uploads.
# Menyimpan $KEEP backup terbaru di $BACKUP_DIR (bawaan ./backups, tidak masuk git).
#
#   ./scripts/backup.sh
#
# Jadwal harian dengan cron (crontab -e), mis. setiap pukul 21.00:
#   0 21 * * * /path/ke/harmoni-gitar/scripts/backup.sh >> /path/ke/harmoni-gitar/backups/backup.log 2>&1
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

BACKUP_DIR="${BACKUP_DIR:-$PWD/backups}"
KEEP="${KEEP:-14}"
TGL="$(date +%F-%H%M)"
DUMP="$BACKUP_DIR/harmoni-gitar-db-$TGL.sql.gz"
COMPOSE=(docker compose --env-file .env.docker)

mkdir -p "$BACKUP_DIR"

echo "==> Dump database: $DUMP"
"${COMPOSE[@]}" exec -T db pg_dump -U harmoni-gitar harmoni_gitar | gzip > "$DUMP"
# Dump kosong tetap ~20 byte setelah gzip; di bawah 1 KB berarti pg_dump gagal.
SIZE=$(stat -c %s "$DUMP")
if [ "$SIZE" -lt 1024 ]; then
  echo "!! Dump hanya $SIZE byte, ada yang salah. Dump dihapus." >&2
  rm -f "$DUMP"
  exit 1
fi
ls -lh "$DUMP"

# File unggahan: volume Docker `uploads` (aplikasi via Docker) dan/atau ./uploads (npm run dev).
if "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx app; then
  UP="$BACKUP_DIR/harmoni-gitar-uploads-$TGL.tar.gz"
  echo "==> Arsip uploads (container app): $UP"
  "${COMPOSE[@]}" exec -T app tar -czf - -C /data uploads > "$UP"
fi
if [ -d uploads ]; then
  UP="$BACKUP_DIR/harmoni-gitar-uploads-local-$TGL.tar.gz"
  echo "==> Arsip uploads (lokal): $UP"
  tar -czf "$UP" uploads
fi

echo "==> Menyimpan $KEEP backup terbaru"
for pola in 'harmoni-gitar-db-*.sql.gz' 'harmoni-gitar-uploads-[0-9]*.tar.gz' 'harmoni-gitar-uploads-local-*.tar.gz'; do
  # Pola tanpa file (mis. uploads lokal di VPS) membuat ls gagal; itu bukan error.
  { ls -1t "$BACKUP_DIR"/$pola 2>/dev/null || true; } | tail -n +$((KEEP + 1)) | xargs -r rm -f
done

echo "==> Backup selesai: $TGL"
