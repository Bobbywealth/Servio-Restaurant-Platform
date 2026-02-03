#!/bin/bash
# Test Runner Script

# Only run tests if explicitly called
# Usage: ./run-tests.sh

set -e

echo "Running backend tests..."
npm run test:unit

echo "Tests completed!"
