# Render Deployment Guide for Servio Restaurant Platform

This guide provides step-by-step instructions for deploying both the backend and frontend of Servio Restaurant Platform to Render.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Backend Deployment](#backend-deployment)
3. [Frontend Deployment](#frontend-deployment)
4. [Environment Variables Reference](#environment-variables-reference)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying to Render, ensure you have:

- A Render account (https://render.com)
- GitHub repository with your Servio code
- PostgreSQL database (can be created on Render)
- OpenAI API key (for Assistant features)
- Any optional API keys (Twilio, Vapi, etc.)

---

## Backend Deployment

### Step 1: Create a New Web Service

1. Log into Render Dashboard
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `servio-backend` (or your preferred name)
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your production branch)
   - **Root Directory**: `/` (leave blank if backend is in root)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Starter` (or higher for production)

### Step 2: Configure Environment Variables

⚠️ **CRITICAL**: Set these environment variables in your Render backend service dashboard.

#### Required Environment Variables

Navigate to your backend service → **Environment** tab → Add the following:

```bash
# Node Environment
NODE_ENV=production

# Frontend URL (CRITICAL for CORS)
FRONTEND_URL=https://servio-app.onrender.com
# ⬆️ Replace with YOUR actual frontend URL from Render

# Additional CORS Origins (optional, comma-separated)
ALLOWED_ORIGINS=https://servio-app.onrender.com,https://www.yourdomain.com
# ⬆️ Add any additional domains that need access

# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database
# ⬆️ Use Render PostgreSQL connection string or external database
DATABASE_SSL=true

# Authentication
JWT_SECRET=your_secure_random_secret_here
# ⬆️ Generate a secure random string (use: openssl rand -base64 32)

# OpenAI API (Required for Assistant features)
OPENAI_API_KEY=sk-...your-key-here
OPENAI_TTS_MODEL=tts-1
OPENAI_TTS_VOICE=alloy

# MiniMax API (Alternative to OpenAI - ~96% savings on chat, ~60% on TTS)
# Get credentials at: https://api.minimax.io/
MINIMAX_API_KEY=your-minimax-api-key
MINIMAX_API_BASE=https://api.minimax.io/v1
MINIMAX_CHAT_MODEL=m2.1
MINIMAX_TTS_VOICE=male-shaun-2

# Server Port (Render sets this automatically)
PORT=3002
```

#### Optional Environment Variables

```bash
# Twilio SMS (for marketing features)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Vapi Voice AI (for phone ordering)
VAPI_API_KEY=your_vapi_key
VAPI_WEBHOOK_SECRET=your_webhook_secret
VAPI_ASSISTANT_ID=your_assistant_id
VAPI_PHONE_NUMBER_ID=your_phone_number_id

# Email Configuration (for marketing)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@yourdomain.com

# Uploads Directory (for persistent disk)
UPLOADS_DIR=/var/data/uploads
```

### Step 3: Set Up PostgreSQL Database

**Option A: Use Render PostgreSQL (Recommended)**

1. Click **"New +"** → **"PostgreSQL"**
2. Name: `servio-database`
3. After creation, copy the **Internal Connection String**
4. Add it as `DATABASE_URL` in your backend environment variables
5. Set `DATABASE_SSL=true`

**Option B: Use External Database (Neon, Supabase, etc.)**

1. Create database on your provider
2. Copy the connection string
3. Add it as `DATABASE_URL` in environment variables
4. Set `DATABASE_SSL=true` if SSL is required

### Step 4: Configure Persistent Disk (Optional)

For uploaded files (TTS audio, images, etc.):

1. In your backend service → **Disks** tab
2. Click **"Add Disk"**
3. Configuration:
   - **Name**: `uploads`
   - **Mount Path**: `/var/data/uploads`
   - **Size**: 1 GB (or more as needed)
4. Add environment variable: `UPLOADS_DIR=/var/data/uploads`

### Step 5: Deploy Backend

1. Click **"Create Web Service"**
2. Render will automatically deploy
3. Monitor logs for any errors
4. Once deployed, note your backend URL (e.g., `https://servio-backend-xyz.onrender.com`)

---

## Frontend Deployment

### Step 1: Create a New Static Site

1. Click **"New +"** → **"Static Site"**
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `servio-app` (or your preferred name)
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `frontend/out` (for Next.js static export) OR `frontend/.next` (for Next.js SSR)

### Step 2: Configure Frontend Environment Variables

⚠️ **CRITICAL**: Next.js requires `NEXT_PUBLIC_` prefix for client-side variables.

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=https://servio-backend-xyz.onrender.com
# ⬆️ Replace with YOUR actual backend URL from Step 5

# Alternative: Use BACKEND_URL
NEXT_PUBLIC_BACKEND_URL=https://servio-backend-xyz.onrender.com

# Node Environment
NODE_ENV=production
```

### Step 3: Update Next.js Configuration (if needed)

If deploying as static site, ensure `frontend/next.config.js` has:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // or 'export' for static
  // ... other config
}

module.exports = nextConfig
```

### Step 4: Deploy Frontend

1. Click **"Create Static Site"**
2. Render will automatically deploy
3. Monitor logs for build errors
4. Once deployed, note your frontend URL (e.g., `https://servio-app.onrender.com`)

### Step 5: Update Backend CORS Configuration

⚠️ **CRITICAL STEP**: After getting your frontend URL, update backend environment variables:

1. Go to your **backend service** on Render
2. Navigate to **Environment** tab
3. Update `FRONTEND_URL` to match your frontend URL:
   ```bash
   FRONTEND_URL=https://servio-app.onrender.com
   ```
4. Click **"Save Changes"**
5. Render will automatically redeploy the backend

---

## Environment Variables Reference

### Backend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Environment mode | `production` |
| `FRONTEND_URL` | Yes | Frontend URL for CORS | `https://servio-app.onrender.com` |
| `ALLOWED_ORIGINS` | No | Additional CORS origins | `https://yourdomain.com` |
| `DATABASE_URL` | Yes* | PostgreSQL connection string | `postgresql://...` |
| `DATABASE_SSL` | No | Enable SSL for database | `true` |
| `JWT_SECRET` | Yes | JWT signing secret | `random_secure_string` |
| `OPENAI_API_KEY` | Yes** | OpenAI API key | `sk-...` |
| `MINIMAX_API_KEY` | No | MiniMax API key (alternative) | `...` |
| `MINIMAX_API_BASE` | No | MiniMax API base URL | `https://api.minimax.io/v1` |
| `MINIMAX_CHAT_MODEL` | No | MiniMax chat model | `m2.1` |
| `MINIMAX_TTS_VOICE` | No | MiniMax TTS voice | `male-shaun-2` |
| `PORT` | No | Server port (auto-set by Render) | `3002` |
| `UPLOADS_DIR` | No | Path for uploaded files | `/var/data/uploads` |
| `TWILIO_ACCOUNT_SID` | No | Twilio account SID | `AC...` |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token | `...` |
| `TWILIO_PHONE_NUMBER` | No | Twilio phone number | `+1234567890` |
| `VAPI_API_KEY` | No | Vapi API key | `...` |
| `VAPI_WEBHOOK_SECRET` | No | Vapi webhook secret | `...` |

\* SQLite fallback available in development only
\*\* Required for Assistant features (voice commands, TTS, etc.)

### Frontend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL | `https://servio-backend.onrender.com` |
| `NEXT_PUBLIC_BACKEND_URL` | No | Alternative backend URL variable | Same as above |
| `NODE_ENV` | Yes | Environment mode | `production` |

---

## Troubleshooting

### CORS Errors (Access-Control-Allow-Origin)

**Symptoms:**
- Console error: `Access to XMLHttpRequest has been blocked by CORS policy`
- WebSocket connection failures
- API requests failing from frontend

**Solution:**

1. **Verify Backend `FRONTEND_URL`:**
   ```bash
   # In Render backend environment variables
   FRONTEND_URL=https://servio-app.onrender.com  # Must match EXACTLY
   ```

2. **Check Frontend URL in Logs:**
   - View backend logs on Render
   - Look for "CORS CONFIGURATION" section
   - Verify your frontend URL is listed under "Allowed CORS Origins"

3. **Add Multiple Origins if Needed:**
   ```bash
   ALLOWED_ORIGINS=https://servio-app.onrender.com,https://www.yourdomain.com
   ```

4. **Ensure HTTPS:**
   - Production URLs should use `https://` not `http://`
   - The improved CORS setup automatically handles both protocols

### WebSocket Connection Failures

**Symptoms:**
- `WebSocket connection to 'wss://...' failed`
- Socket disconnected errors in console
- Real-time updates not working

**Solution:**

1. Same as CORS errors above (WebSocket uses same CORS configuration)
2. Verify Socket.IO connection in browser console
3. Check backend logs for `[socket.io] origin not allowed` warnings

### Backend Not Starting

**Symptoms:**
- 502 Bad Gateway
- Service keeps restarting
- Build succeeds but deploy fails

**Solution:**

1. **Check Required Environment Variables:**
   - Verify `DATABASE_URL` is set correctly
   - Verify `JWT_SECRET` is set (not default value)
   - In production, verify `FRONTEND_URL` is set

2. **View Deployment Logs:**
   - Look for "ENVIRONMENT VALIDATION" section
   - Check for any ✗ (failed) validations
   - Fix any missing required variables

3. **Database Connection:**
   - Verify `DATABASE_URL` connection string is correct
   - Ensure database is accessible from Render
   - Check `DATABASE_SSL` setting matches your database provider

### Assistant Features Not Working

**Symptoms:**
- Voice commands not processing
- TTS audio not playing
- "Assistant unavailable" errors

**Solution:**

1. **Verify OpenAI API Key:**
   ```bash
   OPENAI_API_KEY=sk-...  # Must be valid OpenAI key
   ```

2. **Check Logs:**
   - Look for "OPENAI_API_KEY: [CONFIGURED]" in startup logs
   - If shows "[NOT SET]", add the environment variable

3. **Test API Key:**
   - Verify key works: https://platform.openai.com/api-keys
   - Ensure you have credits available

### MiniMax Features Not Working

|**Symptoms:**
|- Assistant using OpenAI instead of MiniMax
|- "MiniMax API key not configured" messages
|- Higher than expected API costs

|**Solution:**

1. **Verify MiniMax Environment Variables:**
   ```bash
   # In Render backend environment variables
   MINIMAX_API_KEY=your-minimax-api-key  # Must be set
   MINIMAX_API_BASE=https://api.minimax.io/v1
   MINIMAX_CHAT_MODEL=m2.1
   MINIMAX_TTS_VOICE=male-shaun-2
   ```

2. **Check Logs:**
   - Look for "[assistant] Using MiniMax" in startup logs
   - If shows "MiniMax not configured", the API key is missing or invalid

3. **Get MiniMax Credentials:**
   - Sign up at: https://api.minimax.io/
   - Create API key in your MiniMax dashboard
   - Add to Render environment variables

4. **Fallback Behavior:**
   - If MiniMax is not configured, Assistant automatically falls back to OpenAI
   - Both keys can be set simultaneously for redundancy

### Database Connection Errors

**Symptoms:**
- "Connection terminated unexpectedly"
- "ECONNREFUSED" errors
- Database queries failing

**Solution:**

1. **Check Connection String:**
   - Ensure `DATABASE_URL` is correct
   - For Render PostgreSQL, use the "Internal Connection String"
   - Format: `postgresql://user:pass@host:port/db?sslmode=require`

2. **SSL Configuration:**
   ```bash
   DATABASE_SSL=true  # Required for most hosted PostgreSQL
   ```

3. **Database Access:**
   - Ensure database is running
   - Check if IP restrictions are blocking Render
   - Verify credentials are correct

### File Upload Issues

**Symptoms:**
- Uploaded files disappear after restart
- 404 errors for uploaded files
- Images/audio not loading

**Solution:**

1. **Set Up Persistent Disk:**
   - Add disk in Render dashboard (see Step 4 above)
   - Set `UPLOADS_DIR=/var/data/uploads`
   - Restart service

2. **For Development:**
   - Local uploads work without persistent disk
   - Files stored in `./uploads` directory

### Checking Logs

**Backend Logs:**
1. Go to Render Dashboard → Your Backend Service
2. Click **"Logs"** tab
3. Look for:
   - ✓ Environment validation passed
   - CORS CONFIGURATION section
   - Database initialized successfully
   - Server running on port...

**Frontend Logs:**
1. Go to Render Dashboard → Your Frontend Site
2. Click **"Logs"** tab
3. Look for build errors or runtime issues

---

## Post-Deployment Checklist

- [ ] Backend service is running (green status)
- [ ] Frontend site is deployed (green status)
- [ ] Backend logs show "Environment validation passed"
- [ ] Backend logs show correct CORS origins
- [ ] Frontend can connect to backend API
- [ ] WebSocket connection working (check browser console)
- [ ] Database connection successful
- [ ] Assistant features working (if OpenAI or MiniMax key provided)
- [ ] MiniMax API configured (optional - for cost savings)
- [ ] File uploads working (if persistent disk configured)
- [ ] Custom domain configured (optional)

---

## Getting Help

If you continue to have issues:

1. **Check Logs:** Always check both backend and frontend logs first
2. **Environment Variables:** Double-check all required variables are set
3. **GitHub Issues:** Report issues at https://github.com/Bobbywealth/Servio-Restaurant-Platform/issues
4. **Render Support:** https://render.com/docs

---

## Quick Reference: Common Commands

### View Backend Logs
```bash
# In Render Dashboard
Backend Service → Logs tab
```

### Restart Services
```bash
# In Render Dashboard
Service → Manual Deploy → Deploy latest commit
```

### Update Environment Variable
```bash
# In Render Dashboard
Service → Environment → Add/Edit Variable → Save Changes
# Service will auto-redeploy
```

### Check Service Health
```bash
# Backend health check
curl https://your-backend-url.onrender.com/health

# Should return:
{
  "status": "ok",
  "timestamp": "...",
  "services": {
    "database": "connected",
    "assistant": "available",
    ...
  }
}
```

---

**Last Updated:** 2026-01-24
**Version:** 1.0.0
