# Servio Development Guide

## Quick Start

### Starting Development Servers

**Option 1: Using the startup script (Recommended)**
```bash
./start-dev.sh
```

This will:
- Kill any existing dev servers
- Start backend on port 3002
- Start frontend on port 3000
- Show logs in `logs/` directory

**Option 2: Manual start**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### Accessing the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3002

### Viewing Logs

```bash
# Backend logs
tail -f logs/backend.log

# Frontend logs
tail -f logs/frontend.log
```

### Stopping Servers

- If using `start-dev.sh`: Press `Ctrl+C`
- Manual: Close terminal windows or run:
  ```bash
  # Kill frontend
  lsof -ti:3000 | xargs kill -9
  
  # Kill backend
  lsof -ti:3002 | xargs kill -9
  ```

## Troubleshooting

### Issue: Constant page reloading

**Cause:** Multiple dev servers running simultaneously

**Solution:**
1. Run the cleanup script:
   ```bash
   pkill -f "tsx watch"
   pkill -f "next dev"
   ```
2. Use `./start-dev.sh` to ensure only one instance runs

### Issue: Port already in use

**Solution:**
```bash
# Check what's using the port
lsof -i :3000  # for frontend
lsof -i :3002  # for backend

# Kill the process
kill -9 <PID>
```

### Issue: Changes not reflecting

1. Check if dev server is running: `lsof -i :3000`
2. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
3. Clear Next.js cache:
   ```bash
   cd frontend
   rm -rf .next
   npm run dev
   ```

### Issue: Too many terminals open

Close unused terminals regularly. The system performs better with fewer open sessions.

## Development Tips

1. **Use only ONE terminal per service** (frontend/backend)
2. **Use the start-dev.sh script** to avoid duplicate processes
3. **Check running processes** if you experience issues:
   ```bash
   ps aux | grep -E "(next dev|tsx watch)"
   ```
4. **Monitor logs** in the `logs/` directory for debugging

## Architecture

```
Servio Restaurant Platform/
├── backend/          # Express.js API (Port 3002)
├── frontend/         # Next.js App (Port 3000)
├── logs/            # Development logs
└── start-dev.sh     # Unified dev server launcher
```
