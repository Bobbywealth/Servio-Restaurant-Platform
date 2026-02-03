#!/bin/bash
#
# Servio Restaurant Platform - Test Runner
#
# This script runs all tests for the application:
# - Backend unit tests (Jest)
# - Backend integration tests (Jest)
# - Frontend E2E tests (Playwright)
#
# Usage:
#   ./run-tests.sh              # Run all tests
#   ./run-tests.sh backend      # Run backend tests only
#   ./run-tests.sh frontend     # Run frontend tests only
#   ./run-tests.sh unit         # Run unit tests only
#   ./run-tests.sh e2e          # Run E2E tests only
#   ./run-tests.sh watch        # Run tests in watch mode
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test type argument
TEST_TYPE=${1:-all}

# Function to print colored output
print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Backend test function
run_backend_tests() {
    print_status "Running backend tests..."
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_warning "Installing backend dependencies..."
        npm install
    fi
    
    # Run Jest tests
    npm run test:unit
    
    print_success "Backend tests completed!"
}

# Frontend test function
run_frontend_tests() {
    print_status "Running frontend tests..."
    
    # Check if frontend dependencies are installed
    if [ ! -d "frontend/node_modules" ]; then
        print_warning "Installing frontend dependencies..."
        cd frontend && npm install && cd ..
    fi
    
    # Run Playwright tests
    cd frontend && npm run test:e2e
    
    print_success "Frontend tests completed!"
}

# Unit tests only
run_unit_tests() {
    print_status "Running unit tests..."
    
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    npm run test:unit
    
    print_success "Unit tests completed!"
}

# E2E tests only
run_e2e_tests() {
    print_status "Running E2E tests..."
    
    if [ ! -d "frontend/node_modules" ]; then
        cd frontend && npm install && cd ..
    fi
    
    cd frontend && npm run test:e2e
    
    print_success "E2E tests completed!"
}

# Watch mode
run_watch_tests() {
    print_status "Running tests in watch mode..."
    
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    npm run test:unit:watch
    
    print_success "Watch mode stopped."
}

# Integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    npm run test:integration
    
    print_success "Integration tests completed!"
}

# Type check
run_typecheck() {
    print_status "Running type check..."
    
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    npm run typecheck
    
    print_success "Type check passed!"
}

# Linting
run_lint() {
    print_status "Running linter..."
    
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    npm run lint
    
    print_success "Linting passed!"
}

# Main logic
main() {
    echo ""
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  Servio Test Suite Runner${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
    
    case $TEST_TYPE in
        backend)
            run_typecheck
            run_lint
            run_backend_tests
            ;;
        frontend)
            run_frontend_tests
            ;;
        unit)
            run_unit_tests
            ;;
        e2e)
            run_e2e_tests
            ;;
        watch)
            run_watch_tests
            ;;
        integration)
            run_integration_tests
            ;;
        all|*)
            echo "Running full test suite..."
            echo ""
            
            print_status "Step 1: Type checking..."
            run_typecheck
            
            echo ""
            print_status "Step 2: Linting..."
            run_lint
            
            echo ""
            print_status "Step 3: Backend unit tests..."
            run_backend_tests
            
            echo ""
            print_status "Step 4: Backend integration tests..."
            run_integration_tests
            
            echo ""
            print_status "Step 5: Frontend E2E tests..."
            run_frontend_tests
            
            echo ""
            echo -e "${GREEN}======================================${NC}"
            echo -e "${GREEN}  All tests completed successfully!${NC}"
            echo -e "${GREEN}======================================${NC}"
            ;;
    esac
}

# Run main function
main
