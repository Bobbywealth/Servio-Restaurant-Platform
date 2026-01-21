#!/bin/bash
# Run all k6 load tests
# Usage: ./run-all-tests.sh [environment]

set -e

ENVIRONMENT=${1:-staging}

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    source ".env.${ENVIRONMENT}"
else
    echo "Environment file .env.${ENVIRONMENT} not found"
    exit 1
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    log_warn "k6 is not installed. Install from: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Create results directory
RESULTS_DIR="results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

log_info "Starting load tests for environment: $ENVIRONMENT"
log_info "Results will be saved to: $RESULTS_DIR"

# Test 1: Order Creation
log_info "Running order creation load test..."
k6 run \
    --out json="${RESULTS_DIR}/order-creation.json" \
    --summary-export="${RESULTS_DIR}/order-creation-summary.json" \
    order-creation.js

# Test 2: Assistant Queries
log_info "Running assistant queries load test..."
k6 run \
    --out json="${RESULTS_DIR}/assistant-queries.json" \
    --summary-export="${RESULTS_DIR}/assistant-queries-summary.json" \
    assistant-queries.js

# Test 3: API Endpoints (add more tests as needed)
# Add additional test scenarios here

log_info "All load tests completed"
log_info "Results saved to: $RESULTS_DIR"

# Generate HTML report (if k6-reporter is installed)
if command -v k6-reporter &> /dev/null; then
    log_info "Generating HTML reports..."
    k6-reporter "${RESULTS_DIR}/order-creation.json" --output "${RESULTS_DIR}/order-creation-report.html"
    k6-reporter "${RESULTS_DIR}/assistant-queries.json" --output "${RESULTS_DIR}/assistant-queries-report.html"
fi

log_info "✅ Load testing complete"
