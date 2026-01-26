#!/bin/bash

# Browser Automation Test Script
# This script tests the delivery platform browser automation setup

echo "🤖 Testing Browser Automation Setup"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3002"

# Check if server is running
echo "1️⃣  Checking if server is running..."
if curl -s "${BASE_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not running. Start with: npm run dev${NC}"
    exit 1
fi

# Check if Playwright is installed
echo ""
echo "2️⃣  Checking Playwright installation..."
if npm list playwright > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Playwright is installed${NC}"
else
    echo -e "${YELLOW}⚠️  Playwright is not installed${NC}"
    echo "   Install with: npm install playwright && npx playwright install chromium"
fi

# Check supported platforms
echo ""
echo "3️⃣  Checking supported platforms..."
PLATFORMS=$(curl -s "${BASE_URL}/api/delivery-platforms/supported")
if echo "$PLATFORMS" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ API endpoint is working${NC}"
else
    echo -e "${RED}❌ API endpoint failed${NC}"
fi

echo ""
echo "===================================="
echo "For detailed documentation, see: BROWSER_AUTOMATION_GUIDE.md"
echo ""
