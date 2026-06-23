#!/bin/sh
# pg_dump backup for all 4 fuel management databases
# Usage: docker compose -f docker-compose.backup.yml run --rm backup
# Restore: docker exec -i fuel_postgres psql -U $PGUSER $DB < /backups/auth_db_YYYYMMDD_HHMMSS.sql

set -e

PGHOST="${PGHOST:-postgres}"
PGUSER="${PGUSER:-fuelapp}"
PGPASSWORD="${PGPASSWORD:-fuelapp_secret}"
export PGPASSWORD

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

for DB in auth_db station_db fuel_db import_db; do
  OUTFILE="$BACKUP_DIR/${DB}_${TIMESTAMP}.sql"
  echo "[backup] Dumping $DB → $OUTFILE"
  pg_dump -h "$PGHOST" -U "$PGUSER" "$DB" > "$OUTFILE"
  echo "[backup] Done: $OUTFILE ($(du -sh "$OUTFILE" | cut -f1))"
done

echo "[backup] All databases backed up at $TIMESTAMP"
