#!/bin/bash
# Database Backup Script for Servio Platform
# Run this script daily via cron job
# Usage: ./backup-database.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="servio_backup_${ENVIRONMENT}_${TIMESTAMP}.sql"
BACKUP_DIR="/var/backups/servio"
S3_BUCKET="${S3_BACKUP_BUCKET:-servio-backups}"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump not found. Please install PostgreSQL client tools."
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        log_warn "AWS CLI not found. S3 upload will be skipped."
    fi
    
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable not set."
        exit 1
    fi
}

# Create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Perform database backup
backup_database() {
    log_info "Starting database backup: $BACKUP_FILE"
    
    # Full backup
    pg_dump "$DATABASE_URL" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        --verbose \
        > "$BACKUP_DIR/$BACKUP_FILE" 2>&1
    
    if [ $? -eq 0 ]; then
        log_info "Database backup completed successfully"
        
        # Get file size
        SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
        log_info "Backup size: $SIZE"
    else
        log_error "Database backup failed"
        exit 1
    fi
}

# Compress backup
compress_backup() {
    log_info "Compressing backup..."
    
    gzip -f "$BACKUP_DIR/$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        log_info "Backup compressed: ${BACKUP_FILE}.gz"
        BACKUP_FILE="${BACKUP_FILE}.gz"
    else
        log_error "Backup compression failed"
        exit 1
    fi
}

# Upload to S3
upload_to_s3() {
    if ! command -v aws &> /dev/null; then
        log_warn "Skipping S3 upload (AWS CLI not available)"
        return
    fi
    
    log_info "Uploading backup to S3: s3://${S3_BUCKET}/daily/"
    
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://${S3_BUCKET}/daily/" \
        --storage-class STANDARD_IA \
        --metadata "environment=${ENVIRONMENT},timestamp=${TIMESTAMP}"
    
    if [ $? -eq 0 ]; then
        log_info "Backup uploaded to S3 successfully"
    else
        log_error "S3 upload failed"
        exit 1
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "servio_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
    DELETED_LOCAL=$(find "$BACKUP_DIR" -name "servio_backup_*.sql.gz" -mtime +${RETENTION_DAYS} | wc -l)
    log_info "Deleted $DELETED_LOCAL old local backup(s)"
    
    # S3 cleanup
    if command -v aws &> /dev/null; then
        CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)
        
        aws s3 ls "s3://${S3_BUCKET}/daily/" | while read -r line; do
            CREATE_DATE=$(echo $line | awk '{print $1}')
            FILE_NAME=$(echo $line | awk '{print $4}')
            
            if [[ "$CREATE_DATE" < "$CUTOFF_DATE" ]]; then
                log_info "Deleting old S3 backup: $FILE_NAME"
                aws s3 rm "s3://${S3_BUCKET}/daily/$FILE_NAME"
            fi
        done
    fi
}

# Verify backup integrity
verify_backup() {
    log_info "Verifying backup integrity..."
    
    # Check if file exists and is not empty
    if [ ! -s "$BACKUP_DIR/$BACKUP_FILE" ]; then
        log_error "Backup file is empty or does not exist"
        exit 1
    fi
    
    # Check if gzip file is valid
    gzip -t "$BACKUP_DIR/$BACKUP_FILE" 2>&1
    
    if [ $? -eq 0 ]; then
        log_info "Backup integrity verified"
    else
        log_error "Backup integrity check failed"
        exit 1
    fi
}

# Send notification
send_notification() {
    STATUS=$1
    MESSAGE=$2
    
    # Log to syslog
    logger -t servio-backup "[$STATUS] $MESSAGE"
    
    # Send email notification (if configured)
    if [ -n "$NOTIFICATION_EMAIL" ]; then
        echo "$MESSAGE" | mail -s "Servio Backup $STATUS" "$NOTIFICATION_EMAIL"
    fi
    
    # Send Slack notification (if configured)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"Servio Backup $STATUS: $MESSAGE\"}"
    fi
}

# Main execution
main() {
    log_info "=== Servio Database Backup Started ==="
    log_info "Environment: $ENVIRONMENT"
    log_info "Timestamp: $TIMESTAMP"
    
    check_prerequisites
    create_backup_dir
    backup_database
    compress_backup
    verify_backup
    upload_to_s3
    cleanup_old_backups
    
    log_info "=== Servio Database Backup Completed ==="
    
    send_notification "SUCCESS" "Database backup completed: $BACKUP_FILE"
}

# Error handler
error_handler() {
    log_error "Backup failed at line $1"
    send_notification "FAILED" "Database backup failed at line $1"
    exit 1
}

trap 'error_handler $LINENO' ERR

# Run main function
main
