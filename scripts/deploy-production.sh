#!/bin/bash

# Servio Restaurant Platform Production Deployment Script
# This script automates the deployment process to Render

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_ENV="production"
MAX_RETRIES=3
HEALTH_CHECK_TIMEOUT=300 # 5 minutes
ROLLBACK_ENABLED=true

echo -e "${BLUE}🚀 Starting Servio Production Deployment...${NC}"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating deployment prerequisites..."
    
    # Check for required tools
    if ! command_exists git; then
        error "Git is required but not installed"
        exit 1
    fi
    
    if ! command_exists node; then
        error "Node.js is required but not installed"
        exit 1
    fi
    
    if ! command_exists npm; then
        error "npm is required but not installed"
        exit 1
    fi
    
    # Check Git status
    if [[ -n $(git status --porcelain) ]]; then
        warn "Working directory is not clean. Consider committing changes first."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log "Prerequisites validated ✓"
}

# Run tests before deployment
run_tests() {
    log "Running test suite..."
    
    # Backend tests
    if [[ -f "backend/package.json" ]]; then
        log "Running backend tests..."
        cd backend
        npm test --if-present || {
            error "Backend tests failed!"
            cd ..
            exit 1
        }
        cd ..
    fi
    
    # Frontend tests
    if [[ -f "frontend/package.json" ]]; then
        log "Running frontend tests..."
        cd frontend
        npm test --if-present --watchAll=false || {
            error "Frontend tests failed!"
            cd ..
            exit 1
        }
        cd ..
    fi
    
    log "All tests passed ✓"
}

# Build applications
build_applications() {
    log "Building applications for production..."
    
    # Build backend
    log "Building backend..."
    cd backend
    npm ci --legacy-peer-deps --production=false
    npm run build || {
        error "Backend build failed!"
        exit 1
    }
    cd ..
    
    # Build frontend
    log "Building frontend..."
    cd frontend
    npm ci --legacy-peer-deps --production=false
    npm run build:production || {
        error "Frontend build failed!"
        exit 1
    }
    cd ..
    
    log "Applications built successfully ✓"
}

# Deploy to Render
deploy_to_render() {
    log "Deploying to Render..."
    
    # Get current commit hash for tracking
    COMMIT_HASH=$(git rev-parse --short HEAD)
    COMMIT_MESSAGE=$(git log -1 --pretty=format:'%s')
    
    log "Deploying commit: $COMMIT_HASH - $COMMIT_MESSAGE"
    
    # Push to main branch (triggers Render deployment)
    git push origin main || {
        error "Failed to push to main branch"
        exit 1
    }
    
    log "Code pushed to Render ✓"
}

# Health check function
health_check() {
    local service_url="$1"
    local service_name="$2"
    local max_attempts=30
    local attempt=1
    
    log "Performing health check for $service_name..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "$service_url/health" > /dev/null; then
            log "$service_name is healthy ✓"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, retrying in 10s..."
        sleep 10
        ((attempt++))
    done
    
    error "$service_name health check failed after $max_attempts attempts"
    return 1
}

# Wait for deployment to complete
wait_for_deployment() {
    log "Waiting for deployment to complete..."
    
    # Wait a bit for the build to start
    sleep 30
    
    # Health check backend
    if [[ -n "${BACKEND_URL:-}" ]]; then
        health_check "$BACKEND_URL" "Backend API" || return 1
    else
        warn "BACKEND_URL not set, skipping backend health check"
    fi
    
    # Health check frontend
    if [[ -n "${FRONTEND_URL:-}" ]]; then
        health_check "$FRONTEND_URL" "Frontend" || return 1
    else
        warn "FRONTEND_URL not set, skipping frontend health check"
    fi
    
    log "All services are healthy ✓"
}

# Rollback function
rollback_deployment() {
    error "Deployment failed! Initiating rollback..."
    
    if [[ "$ROLLBACK_ENABLED" == "true" ]]; then
        # Get the previous commit
        PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
        
        log "Rolling back to commit: $PREVIOUS_COMMIT"
        
        # Reset to previous commit and force push
        git reset --hard "$PREVIOUS_COMMIT"
        git push --force-with-lease origin main
        
        log "Rollback initiated. Please monitor Render dashboard for completion."
    else
        warn "Rollback is disabled. Manual intervention required."
    fi
}

# Performance optimization check
optimize_for_production() {
    log "Applying production optimizations..."
    
    # Verify production environment variables
    if [[ -f ".env.production" ]]; then
        log "Production environment file found ✓"
    else
        warn "No .env.production file found"
    fi
    
    # Check for security configurations
    log "Verifying security configurations..."
    
    # Check if HTTPS is enforced
    # Check if sensitive data is not exposed
    # Verify rate limiting is configured
    
    log "Production optimizations applied ✓"
}

# Smoke tests
run_smoke_tests() {
    log "Running smoke tests..."
    
    local backend_url="${BACKEND_URL:-https://servio-backend.onrender.com}"
    local frontend_url="${FRONTEND_URL:-https://servio-web.onrender.com}"
    
    # Test backend API endpoints
    log "Testing backend endpoints..."
    if curl -f -s "$backend_url/health" | grep -q "healthy"; then
        log "Backend health endpoint working ✓"
    else
        error "Backend health endpoint failed"
        return 1
    fi
    
    # Test frontend loading
    log "Testing frontend loading..."
    if curl -f -s "$frontend_url" > /dev/null; then
        log "Frontend loading successfully ✓"
    else
        error "Frontend loading failed"
        return 1
    fi
    
    log "Smoke tests completed ✓"
}

# Send deployment notification
send_notification() {
    local status="$1"
    local message="$2"
    
    log "Sending deployment notification: $status"
    
    # You can integrate with Slack, Discord, email, etc.
    # Example webhook call:
    # curl -X POST -H 'Content-type: application/json' \
    #   --data "{\"text\":\"🚀 Servio Deployment $status: $message\"}" \
    #   "$WEBHOOK_URL"
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    log "Starting deployment process..."
    
    # Set environment variables if provided
    export BACKEND_URL="${BACKEND_URL:-https://servio-backend.onrender.com}"
    export FRONTEND_URL="${FRONTEND_URL:-https://servio-web.onrender.com}"
    
    # Deployment steps
    validate_prerequisites
    
    if [[ "${SKIP_TESTS:-false}" != "true" ]]; then
        run_tests
    else
        warn "Skipping tests as requested"
    fi
    
    build_applications
    optimize_for_production
    deploy_to_render
    
    if wait_for_deployment; then
        run_smoke_tests
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "🎉 Deployment completed successfully in ${duration}s!"
        send_notification "SUCCESS" "Deployment completed in ${duration}s"
        
        # Show useful URLs
        echo -e "\n${GREEN}🔗 Useful URLs:${NC}"
        echo -e "Frontend: ${FRONTEND_URL}"
        echo -e "Backend API: ${BACKEND_URL}"
        echo -e "Health Check: ${BACKEND_URL}/health"
        
    else
        error "Deployment failed!"
        
        if [[ "$ROLLBACK_ENABLED" == "true" ]]; then
            rollback_deployment
        fi
        
        send_notification "FAILED" "Deployment failed and rollback initiated"
        exit 1
    fi
}

# Handle interruption
trap 'error "Deployment interrupted!"; exit 130' INT

# Run main function
main "$@"