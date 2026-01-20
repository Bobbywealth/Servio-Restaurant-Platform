#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Servio Development Environment${NC}\n"

# Function to kill processes on specific ports
cleanup_ports() {
    echo -e "${YELLOW}Cleaning up existing processes...${NC}"
    
    # Kill any processes on port 3000 (frontend)
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    
    # Kill any processes on port 3002 (backend)
    lsof -ti:3002 | xargs kill -9 2>/dev/null
    
    # Kill any lingering tsx/next processes
    pkill -f "tsx watch" 2>/dev/null
    pkill -f "next dev" 2>/dev/null
    
    sleep 1
    echo -e "${GREEN}✓ Cleanup complete${NC}\n"
}

# Cleanup on script exit
trap cleanup_ports EXIT INT TERM

# Initial cleanup
cleanup_ports

# Check if node_modules exist
if [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo -e "${RED}node_modules not found. Please run npm install in both directories first.${NC}"
    exit 1
fi

# Start backend
echo -e "${GREEN}Starting Backend Server (Port 3002)...${NC}"
cd backend
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend
echo -e "${GREEN}Starting Frontend Server (Port 3000)...${NC}"
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 3

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Development servers are running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e ""
echo -e "  ${GREEN}Frontend:${NC} http://localhost:3000"
echo -e "  ${GREEN}Backend:${NC}  http://localhost:3002"
echo -e ""
echo -e "  ${YELLOW}Logs:${NC}"
echo -e "    Backend:  tail -f logs/backend.log"
echo -e "    Frontend: tail -f logs/frontend.log"
echo -e ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Wait for user interrupt
wait
