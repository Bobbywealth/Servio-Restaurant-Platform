#!/bin/bash
# Test Database Restore Script
# Tests that backups can be successfully restored
# Usage: ./test-restore.sh [backup-file]

set -e

# Configuration
BACKUP_FILE=${1:-"latest"}
TEST_DB_NAME="servio_restore_test_$(date +%s)"
TEST_DATABASE_URL="postgresql://localhost/${TEST_DB_NAME}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get latest backup
if [ "$BACKUP_FILE" == "latest" ]; then
    if command -v aws &> /dev/null && [ -n "$S3_BACKUP_BUCKET" ]; then
        log_info "Downloading latest backup from S3..."
        BACKUP_FILE=$(aws s3 ls "s3://${S3_BACKUP_BUCKET}/daily/" | sort | tail -n 1 | awk '{print $4}')
        aws s3 cp "s3://${S3_BACKUP_BUCKET}/daily/$BACKUP_FILE" "/tmp/$BACKUP_FILE"
        BACKUP_FILE="/tmp/$BACKUP_FILE"
    else
        log_error "Cannot download latest backup - AWS CLI not configured"
        exit 1
    fi
fi

log_info "Testing restore from: $BACKUP_FILE"

# Create test database
log_info "Creating test database: $TEST_DB_NAME"
createdb "$TEST_DB_NAME"

# Decompress if needed
RESTORE_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
    log_info "Decompressing backup..."
    RESTORE_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$RESTORE_FILE"
fi

# Restore to test database
log_info "Restoring to test database..."
psql "$TEST_DATABASE_URL" < "$RESTORE_FILE" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    log_error "Restore failed"
    dropdb "$TEST_DB_NAME"
    exit 1
fi

# Run integrity checks
log_info "Running integrity checks..."

# Check table counts
RESTAURANTS=$(psql "$TEST_DATABASE_URL" -t -c "SELECT COUNT(*) FROM restaurants;" | tr -d ' ')
USERS=$(psql "$TEST_DATABASE_URL" -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
ORDERS=$(psql "$TEST_DATABASE_URL" -t -c "SELECT COUNT(*) FROM orders;" | tr -d ' ')

log_info "Records found:"
log_info "  - Restaurants: $RESTAURANTS"
log_info "  - Users: $USERS"
log_info "  - Orders: $ORDERS"

# Verify foreign key integrity
FK_VIOLATIONS=$(psql "$TEST_DATABASE_URL" -t -c "
    SELECT COUNT(*) FROM orders o 
    LEFT JOIN restaurants r ON o.restaurant_id = r.id 
    WHERE r.id IS NULL AND o.deleted_at IS NULL;
" | tr -d ' ')

if [ "$FK_VIOLATIONS" -gt 0 ]; then
    log_error "Found $FK_VIOLATIONS foreign key violations"
    dropdb "$TEST_DB_NAME"
    exit 1
fi

log_info "No foreign key violations found"

# Cleanup
log_info "Cleaning up test database..."
dropdb "$TEST_DB_NAME"

if [[ "$BACKUP_FILE" == *.gz ]] && [ -f "$RESTORE_FILE" ]; then
    rm "$RESTORE_FILE"
fi

log_info "✅ Restore test completed successfully"
