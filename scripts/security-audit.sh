#!/bin/bash
# Security Audit Script for Servio Platform
# Runs automated security checks and generates a report
# Usage: ./security-audit.sh

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

REPORT_FILE="security-audit-$(date +%Y%m%d_%H%M%S).txt"

echo "# Servio Platform Security Audit" > "$REPORT_FILE"
echo "Date: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

log_info "Starting security audit..."

# 1. NPM Audit
log_info "Running npm audit..."
echo "## NPM Vulnerabilities" >> "$REPORT_FILE"
cd backend
npm audit --json > ../npm-audit.json 2>&1 || true
npm audit >> "../$REPORT_FILE" 2>&1 || true
cd ..
echo "" >> "$REPORT_FILE"

# 2. Snyk Test (if available)
if command -v snyk &> /dev/null; then
    log_info "Running Snyk security scan..."
    echo "## Snyk Vulnerabilities" >> "$REPORT_FILE"
    cd backend
    snyk test --json > ../snyk-results.json 2>&1 || true
    snyk test >> "../$REPORT_FILE" 2>&1 || true
    cd ..
    echo "" >> "$REPORT_FILE"
else
    log_warn "Snyk not installed. Install with: npm install -g snyk"
fi

# 3. Check for hardcoded secrets
log_info "Checking for hardcoded secrets..."
echo "## Hardcoded Secrets Check" >> "$REPORT_FILE"

# Patterns to search for
PATTERNS=(
    "password\s*=\s*['\"][^'\"]{8,}"
    "api[_-]?key\s*=\s*['\"][^'\"]{20,}"
    "secret\s*=\s*['\"][^'\"]{20,}"
    "token\s*=\s*['\"][^'\"]{20,}"
    "bearer\s+[a-zA-Z0-9\-._~+/]{20,}"
)

FOUND_SECRETS=0
for pattern in "${PATTERNS[@]}"; do
    RESULTS=$(grep -r -i -E "$pattern" backend/src --exclude-dir=node_modules --exclude="*.log" || true)
    if [ -n "$RESULTS" ]; then
        echo "Found potential secret: $pattern" >> "$REPORT_FILE"
        echo "$RESULTS" >> "$REPORT_FILE"
        FOUND_SECRETS=$((FOUND_SECRETS + 1))
    fi
done

if [ $FOUND_SECRETS -eq 0 ]; then
    echo "No hardcoded secrets found" >> "$REPORT_FILE"
    log_info "No hardcoded secrets detected"
else
    log_error "Found $FOUND_SECRETS potential hardcoded secrets"
fi
echo "" >> "$REPORT_FILE"

# 4. Check environment variables
log_info "Checking environment configuration..."
echo "## Environment Configuration" >> "$REPORT_FILE"

REQUIRED_VARS=(
    "DATABASE_URL"
    "JWT_SECRET"
    "OPENAI_API_KEY"
    "REDIS_HOST"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing: $var" >> "$REPORT_FILE"
        log_warn "Missing required environment variable: $var"
    else
        echo "✅ Set: $var" >> "$REPORT_FILE"
    fi
done
echo "" >> "$REPORT_FILE"

# 5. Check file permissions
log_info "Checking file permissions..."
echo "## File Permissions" >> "$REPORT_FILE"

# Check for world-writable files
WRITABLE=$(find backend/src -type f -perm -002 2>/dev/null || true)
if [ -n "$WRITABLE" ]; then
    echo "World-writable files found:" >> "$REPORT_FILE"
    echo "$WRITABLE" >> "$REPORT_FILE"
    log_warn "Found world-writable files"
else
    echo "No world-writable files found" >> "$REPORT_FILE"
    log_info "File permissions OK"
fi
echo "" >> "$REPORT_FILE"

# 6. Check for outdated dependencies
log_info "Checking for outdated dependencies..."
echo "## Outdated Dependencies" >> "$REPORT_FILE"
cd backend
npm outdated >> "../$REPORT_FILE" 2>&1 || true
cd ..
echo "" >> "$REPORT_FILE"

# 7. Check SSL/TLS configuration
log_info "Checking SSL/TLS configuration..."
echo "## SSL/TLS Configuration" >> "$REPORT_FILE"

if [ -n "$API_BASE_URL" ]; then
    # Test SSL configuration (if API is accessible)
    echo "Testing: $API_BASE_URL" >> "$REPORT_FILE"
    
    # Check if using HTTPS
    if [[ "$API_BASE_URL" == https://* ]]; then
        echo "✅ Using HTTPS" >> "$REPORT_FILE"
        log_info "API uses HTTPS"
    else
        echo "❌ Not using HTTPS" >> "$REPORT_FILE"
        log_error "API not using HTTPS"
    fi
else
    echo "API_BASE_URL not set - skipping SSL check" >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"

# 8. Check CORS configuration
log_info "Checking CORS configuration..."
echo "## CORS Configuration" >> "$REPORT_FILE"

if grep -q "origin.*\*" backend/src/config/cors.ts 2>/dev/null; then
    echo "❌ CORS allows all origins (*)" >> "$REPORT_FILE"
    log_error "CORS configured to allow all origins"
else
    echo "✅ CORS properly restricted" >> "$REPORT_FILE"
    log_info "CORS configuration OK"
fi
echo "" >> "$REPORT_FILE"

# 9. Check for console.log statements (security risk in production)
log_info "Checking for console.log statements..."
echo "## Console.log Statements" >> "$REPORT_FILE"

CONSOLE_LOGS=$(grep -r "console\.log" backend/src --exclude-dir=node_modules | wc -l)
echo "Found $CONSOLE_LOGS console.log statements" >> "$REPORT_FILE"

if [ "$CONSOLE_LOGS" -gt 10 ]; then
    log_warn "Found $CONSOLE_LOGS console.log statements (should use logger instead)"
else
    log_info "Console.log usage acceptable"
fi
echo "" >> "$REPORT_FILE"

# 10. Check for SQL injection vulnerabilities
log_info "Checking for potential SQL injection vulnerabilities..."
echo "## SQL Injection Check" >> "$REPORT_FILE"

# Check for string concatenation in SQL queries
SQL_CONCAT=$(grep -r "SELECT.*+\|INSERT.*+\|UPDATE.*+\|DELETE.*+" backend/src --exclude-dir=node_modules --include="*.ts" --include="*.js" | wc -l)

if [ "$SQL_CONCAT" -gt 0 ]; then
    echo "⚠️  Found $SQL_CONCAT potential SQL injection points" >> "$REPORT_FILE"
    log_warn "Found potential SQL injection vulnerabilities"
else
    echo "✅ No obvious SQL injection vulnerabilities" >> "$REPORT_FILE"
    log_info "No SQL injection issues found"
fi
echo "" >> "$REPORT_FILE"

# Summary
echo "## Summary" >> "$REPORT_FILE"
echo "Audit completed at: $(date)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

log_info "Security audit completed"
log_info "Report saved to: $REPORT_FILE"

# Open report
if command -v cat &> /dev/null; then
    echo ""
    echo "=== Security Audit Summary ==="
    tail -20 "$REPORT_FILE"
fi
