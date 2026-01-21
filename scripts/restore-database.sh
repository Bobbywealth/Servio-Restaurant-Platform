#!/bin/bash
# Database Restore Script for Servio Platform
# Usage: ./restore-database.sh <backup-file> [target-database-url]

set -e

# Configuration
BACKUP_FILE=$1
TARGET_DATABASE_URL=${2:-$DATABASE_URL}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validation
if [ -z "$BACKUP_FILE" ]; then
    log_error "Usage: $0 <backup-file> [target-database-url]"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

if [ -z "$TARGET_DATABASE_URL" ]; then
    log_error "Target database URL not provided and DATABASE_URL not set"
    exit 1
fi

# Warning
log_warn "======================================================"
log_warn "WARNING: This will REPLACE all data in the database!"
log_warn "Target database: $TARGET_DATABASE_URL"
log_warn "Backup file: $BACKUP_FILE"
log_warn "======================================================"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log_info "Restore cancelled"
    exit 0
fi

# Create restore point
log_info "Creating pre-restore backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PRE_RESTORE_BACKUP="/tmp/servio_pre_restore_${TIMESTAMP}.sql.gz"

pg_dump "$TARGET_DATABASE_URL" | gzip > "$PRE_RESTORE_BACKUP"
log_info "Pre-restore backup saved: $PRE_RESTORE_BACKUP"

# Decompress if needed
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    log_info "Decompressing backup file..."
    RESTORE_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"
fi

# Restore database
log_info "Starting database restore..."
psql "$TARGET_DATABASE_URL" < "$RESTORE_FILE"

if [ $? -eq 0 ]; then
    log_info "Database restore completed successfully"
else
    log_error "Database restore failed!"
    log_warn "You can restore from pre-restore backup: $PRE_RESTORE_BACKUP"
    exit 1
fi

# Verify restore
log_info "Verifying restore..."
RECORD_COUNT=$(psql "$TARGET_DATABASE_URL" -t -c "SELECT COUNT(*) FROM restaurants;")
log_info "Restaurants table records: $RECORD_COUNT"

if [ "$RECORD_COUNT" -gt 0 ]; then
    log_info "Restore verification passed"
else
    log_warn "No restaurants found - database may be empty"
fi

# Cleanup
if [[ "$BACKUP_FILE" == *.gz ]] && [ -f "$RESTORE_FILE" ]; then
    rm "$RESTORE_FILE"
fi

log_info "Database restore completed"
log_info "Pre-restore backup kept at: $PRE_RESTORE_BACKUP"
