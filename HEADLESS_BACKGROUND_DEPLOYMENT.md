# Headless Browser - Background Execution & Deployment

## Your Question:

> **"Since it's a headless browser, what if my computer is not on? Will it work in background and if so how?"**

---

## 🖥️ **Where Does The Automation Actually Run?**

### **IMPORTANT**: The automation runs on **the server**, not your computer!

```
┌─────────────────────────────────────────────────┐
│  YOUR COMPUTER (Frontend)                       │
│  - You just click "Sync" button                │
│  - Sends API request                            │
└─────────────────────────────────────────────────┘
                     ↓ API Request
┌─────────────────────────────────────────────────┐
│  SERVER (Backend - where automation runs)       │
│  - Receives API request                         │
│  - Launches headless Chrome browser             │
│  - Navigates to DoorDash/UberEats              │
│  - Updates menu items                           │
│  - Closes browser                               │
│  - Returns response                             │
└─────────────────────────────────────────────────┘
```

**Your computer can be OFF!** As long as the server is running.

---

## 📍 **Deployment Scenarios**

### **Scenario 1: Local Development (Computer MUST Be On)**

**Current Setup:**
```bash
# Your computer
npm run dev  # Server running on localhost:3002
```

**Limitations:**
- ❌ Computer must be on
- ❌ Automation stops when you close laptop
- ❌ No scheduled syncs while you sleep
- ❌ Only for testing

---

### **Scenario 2: Cloud Deployment (Runs 24/7)** ⭐ RECOMMENDED

**Deploy backend to cloud service:**

#### Option A: Render.com (What you're using!)

```bash
# Your app is already on Render:
https://servio-app.onrender.com (frontend)
https://your-backend.onrender.com (backend)

# Backend runs 24/7 on Render's servers
# Your computer can be OFF
```

**How it works:**
1. You deploy code to Render
2. Render runs your Node.js server 24/7
3. Browser automation happens **on Render's servers**
4. You can close your laptop and go home!

---

#### Option B: AWS / DigitalOcean / Heroku

Similar to Render:
- Deploy backend to cloud
- Server runs 24/7
- Automation happens in cloud
- Your computer not needed

---

#### Option C: VPS (Virtual Private Server)

```bash
# Rent a VPS from:
- DigitalOcean Droplet ($6/month)
- AWS EC2
- Linode
- Vultr

# Deploy your backend
# Runs 24/7 on the VPS
```

---

## 🚀 **Deploying to Render (Step-by-Step)**

### Your app is already deployed! But here's how automation works:

### Step 1: Install Playwright on Render

Add to your `package.json`:
```json
{
  "scripts": {
    "build": "tsc && npx playwright install chromium",
    "start": "node dist/server.js"
  }
}
```

Or in your Dockerfile:
```dockerfile
# Install Playwright browsers
RUN npx playwright install chromium
RUN npx playwright install-deps chromium
```

### Step 2: Set Environment Variable on Render

```bash
# In Render Dashboard → Environment
HEADLESS=true
```

### Step 3: Deploy!

```bash
git push origin main
# Render auto-deploys
# Browser automation now runs on Render's servers!
```

---

## 🤖 **Headless vs Headed - Clarification**

### What "Headless" Means:

```
HEADLESS=true (Production):
- Browser runs WITHOUT visible window
- No GUI displayed
- Runs in memory only
- Perfect for servers (Render, AWS, etc.)
- Your computer can be OFF

HEADLESS=false (Testing):
- Browser window OPENS on screen
- You can SEE what's happening
- Only works on computer with display
- Use for debugging/testing
- Computer MUST be on with monitor
```

---

## ⏰ **Running Automation in Background**

### Option 1: API-Triggered (Manual)

**How it works:**
```bash
# User clicks "Sync Now" button in frontend
→ Sends POST /api/delivery-platforms/sync/doordash
→ Backend (on Render) launches headless browser
→ Updates menu
→ Returns result
→ Browser closes

# Your role: Just click button!
# Backend handles everything
```

---

### Option 2: Scheduled/Automated (Cron Jobs)

**Schedule syncs to run automatically:**

#### Using Node-Cron (In Your App)

```typescript
// src/scheduler.ts
import cron from 'node-cron';
import { BrowserAutomationService } from './services/BrowserAutomationService';

// Run every day at 8 AM
cron.schedule('0 8 * * *', async () => {
  console.log('Running scheduled sync...');

  const restaurants = await getAllRestaurants();

  for (const restaurant of restaurants) {
    try {
      await BrowserAutomationService.getInstance().syncMenuToPlatform(
        restaurant.id,
        'doordash',
        'stock_update'
      );

      // Wait 5 minutes before next restaurant
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    } catch (error) {
      console.error(`Sync failed for ${restaurant.id}:`, error);
    }
  }
});
```

**Install:**
```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

---

#### Using Render Cron Jobs

```yaml
# render.yaml
services:
  - type: cron
    name: menu-sync
    env: node
    schedule: "0 8 * * *"  # Every day at 8 AM
    buildCommand: npm install && npm run build
    startCommand: node dist/scripts/sync-all-restaurants.js
```

---

#### Using External Cron (EasyCron, cron-job.org)

```bash
# Set up at cron-job.org:
URL: https://your-backend.onrender.com/api/delivery-platforms/sync-all
Method: POST
Schedule: Daily at 8:00 AM
Headers: Authorization: Bearer YOUR_API_KEY
```

---

### Option 3: Worker Process (Advanced)

**Separate worker service that runs syncs:**

```typescript
// src/worker.ts
import { BrowserAutomationService } from './services/BrowserAutomationService';
import { DatabaseService } from './services/DatabaseService';

async function syncWorker() {
  await DatabaseService.initialize();

  // Run forever
  while (true) {
    try {
      // Get all restaurants that need syncing
      const restaurants = await getRestaurantsNeedingSync();

      for (const restaurant of restaurants) {
        await syncRestaurant(restaurant);
        await sleep(5 * 60 * 1000); // 5 min between each
      }

      // Wait 1 hour before checking again
      await sleep(60 * 60 * 1000);
    } catch (error) {
      console.error('Worker error:', error);
      await sleep(5 * 60 * 1000);
    }
  }
}

syncWorker();
```

**Deploy worker to Render:**
```yaml
# render.yaml
services:
  - type: worker
    name: sync-worker
    env: node
    buildCommand: npm install && npm run build
    startCommand: node dist/worker.js
```

---

## 🏗️ **Architecture Diagram**

### Current Setup (Deployed):

```
┌─────────────────────────────────────────┐
│  YOUR COMPUTER                          │
│  (Can be OFF)                          │
│                                         │
│  [Browser] → Frontend on Render        │
│              Click "Sync Now"          │
└─────────────────────────────────────────┘
              ↓ HTTPS Request
┌─────────────────────────────────────────┐
│  RENDER.COM SERVERS                     │
│  (Always Running 24/7)                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Backend Node.js                 │   │
│  │ - Receives API request          │   │
│  │ - Launches Chrome headless      │   │
│  │ - Browser runs IN MEMORY        │   │
│  │ - No window/GUI needed          │   │
│  └─────────────────────────────────┘   │
│              ↓                          │
│  ┌─────────────────────────────────┐   │
│  │ Headless Chrome Process         │   │
│  │ - Navigates to DoorDash         │   │
│  │ - Updates menu items            │   │
│  │ - Returns results               │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              ↓ Internet
┌─────────────────────────────────────────┐
│  DOORDASH.COM                           │
│  (Thinks it's a normal browser)         │
└─────────────────────────────────────────┘
```

---

## 💻 **Server Requirements**

### Minimum Requirements for Browser Automation:

```
CPU: 1 vCPU
RAM: 512 MB (minimum), 1 GB (recommended)
Disk: 1 GB free space
OS: Linux (Ubuntu/Debian)
```

### Render.com Free Tier:
```
✅ CPU: 0.5 vCPU
✅ RAM: 512 MB
✅ Disk: 1 GB
⚠️ Spins down after 15 min inactivity
```

**Note**: Free tier sleeps when inactive. Upgrade to $7/month for 24/7 uptime.

---

## 🔄 **Process Flow**

### When You Click "Sync Now":

```
1. You click button in web app (your computer)
   ↓
2. Frontend sends API request to Render
   ↓
3. Render backend receives request
   ↓
4. Backend launches headless Chrome (on Render's server)
   ↓
5. Chrome navigates to DoorDash (all in Render's memory)
   ↓
6. Updates menu items
   ↓
7. Chrome closes
   ↓
8. Backend returns results to frontend
   ↓
9. You see "Sync successful!" message
   ↓
10. You can close your computer - it's done!
```

**Total time: ~30-60 seconds**

**Your computer's role: Just click button and wait for response!**

---

## 📱 **Can I Trigger From Phone?**

**YES!** Because backend runs on Render:

```bash
# From phone browser:
https://servio-app.onrender.com
→ Login
→ Click "Sync Menu"
→ Backend (on Render) does the work
→ Your phone just waits for response

# Or via API from phone:
curl https://your-backend.onrender.com/api/delivery-platforms/sync/doordash \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🛠️ **Setup Checklist for 24/7 Operation**

### Step 1: Ensure Backend is Deployed

```bash
# Check if backend is running:
curl https://your-backend.onrender.com/health

# Should return: {"status": "ok"}
```

### Step 2: Install Playwright on Server

Add to `package.json`:
```json
{
  "scripts": {
    "postinstall": "npx playwright install chromium"
  }
}
```

Or Dockerfile:
```dockerfile
RUN npx playwright install chromium
RUN npx playwright install-deps chromium
```

### Step 3: Set Environment Variables

```bash
# On Render Dashboard:
HEADLESS=true
JWT_SECRET=your_secret
```

### Step 4: Test Automation

```bash
# From anywhere (your computer, phone, etc.):
curl -X POST https://your-backend.onrender.com/api/delivery-platforms/sync/doordash \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"syncType": "stock_update"}'

# Backend on Render will:
# - Launch headless Chrome
# - Sync menu
# - Return results
# (All while your computer is OFF)
```

### Step 5: Set Up Scheduled Syncs (Optional)

```bash
# Option A: Add node-cron to your app
npm install node-cron

# Option B: Use Render Cron Jobs
# Add to render.yaml

# Option C: Use external service (cron-job.org)
```

---

## 🚨 **Common Misconceptions**

### ❌ WRONG:
> "Headless browser runs on my computer in background even when it's off"

**NO!** Your computer can't run anything when it's off.

### ✅ CORRECT:
> "Headless browser runs on the **server** (Render/AWS/etc.) which is always on. My computer just sends API requests to trigger it."

---

## 🎯 **Summary / TL;DR**

### Q: "What if my computer is not on?"

**A: Your computer doesn't need to be on!**

1. **Backend runs on Render** (or other cloud service)
2. **Render's servers are always on** (24/7)
3. **Browser automation runs on Render**, not your computer
4. **Headless = no GUI**, perfect for servers
5. **You just send API requests** (from computer, phone, cron job, etc.)
6. **Your computer can be OFF** - backend does the work

### Deployment Checklist:

- ✅ Backend deployed to Render (done)
- ✅ Playwright installed on server
- ✅ HEADLESS=true in environment
- ✅ Test automation works
- ✅ Set up scheduled syncs (optional)
- ✅ Close laptop and relax!

---

**Your computer is just the remote control. The work happens on the server!** 🎮 → 🖥️

