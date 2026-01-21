# Servio Backend Deployment Guide

## **Choose Your Platform**

### **🚅 Option 1: Railway (Recommended - Easiest)**

**Why Railway?**
- ✅ Best for beginners
- ✅ Automatic builds from GitHub
- ✅ Built-in persistent volumes
- ✅ Generous free tier
- ✅ Great dashboard

**Steps:**
1. **Sign up** at [railway.app](https://railway.app)
2. **Connect GitHub** and select your repository
3. **Add Environment Variables** in Railway dashboard:
   ```
   NODE_ENV=production
   PORT=3002
   FRONTEND_URL=https://your-netlify-app.netlify.app
   JWT_SECRET=generate-a-secure-random-string
   OPENAI_API_KEY=your-openai-key-here
   ```
4. **Deploy** - Railway will automatically detect and deploy
5. **Copy your Railway URL** (e.g., `https://servio-backend-production.up.railway.app`)

---

### **🎨 Option 2: Render (Good Free Tier)**

**Why Render?**
- ✅ Generous free tier
- ✅ Automatic SSL
- ✅ Built-in persistent disks
- ✅ Good for static + dynamic combo

**Steps:**
1. **Sign up** at [render.com](https://render.com)
2. **Connect GitHub** repository
3. **Create Web Service** with these settings:
   - **Build Command:** `cd backend && npm install && npm run build`
   - **Start Command:** `cd backend && npm start`
   - **Health Check Path:** `/health`
4. **Add Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3002
   FRONTEND_URL=https://your-netlify-app.netlify.app
   JWT_SECRET=generate-a-secure-random-string
   OPENAI_API_KEY=your-openai-key-here
   DATABASE_URL=postgres://...
   DATABASE_SSL=true
   ```
5. **Provision a Postgres database** (Render Postgres or external) and paste its `DATABASE_URL`
6. **Deploy** and copy your Render URL

---

### **⚡ Option 3: Fly.io (Best Performance)**

**Why Fly.io?**
- ✅ Global edge deployment
- ✅ Excellent performance
- ✅ Great for databases
- ✅ More control

**Steps:**
1. **Install Fly CLI:** `brew install flyctl` (or from [fly.io](https://fly.io/docs/getting-started/installing-flyctl/))
2. **Login:** `fly auth login`
3. **Navigate to project root** and deploy:
   ```bash
   cd /path/to/Servio Restaurant Platform
   fly launch --no-deploy
   fly volumes create servio_data --size 1
   fly deploy
   ```
4. **Set Environment Variables:**
   ```bash
   fly secrets set NODE_ENV=production
   fly secrets set JWT_SECRET=generate-a-secure-random-string
   fly secrets set OPENAI_API_KEY=your-openai-key-here
   fly secrets set FRONTEND_URL=https://your-netlify-app.netlify.app
   ```
5. **Copy your Fly.io URL**

---

## **Update Your Frontend**

After deploying the backend, update your Netlify environment variables:

1. **Go to Netlify Dashboard** → Your Site → Site Settings → Environment Variables
2. **Add/Update:**
   ```
   BACKEND_URL=https://your-backend-url-here
   ```
3. **Redeploy** your frontend

---

## **Required Environment Variables**

### **Essential (Required)**
- `NODE_ENV=production`
- `PORT=3002` (or platform default)
- `FRONTEND_URL=https://your-netlify-app.netlify.app`
- `JWT_SECRET=your-secure-random-string` (generate with: `openssl rand -base64 32`)
- `OPENAI_API_KEY=your-openai-api-key`

### **Optional (Marketing Features)**
- `TWILIO_ACCOUNT_SID=your-twilio-sid`
- `TWILIO_AUTH_TOKEN=your-twilio-token`
- `TWILIO_PHONE_NUMBER=your-twilio-number`
- `EMAIL_HOST=smtp.gmail.com`
- `EMAIL_PORT=587`
- `EMAIL_USER=your-email@gmail.com`
- `EMAIL_PASS=your-app-password`
- `EMAIL_FROM=your-from-email@gmail.com`
- `BASE_URL=https://your-backend-url`

---

## **Database Notes**

- **Database** is PostgreSQL via `DATABASE_URL` (Render)
- **Automatic migrations** run on startup
- **Demo data** seeds automatically on first run

---

## **Troubleshooting**

### **Common Issues**

1. **"Cannot find module" errors**
   - Ensure build command runs: `cd backend && npm run build`
   - Check TypeScript compilation

2. **Database errors**
   - Verify `DATABASE_URL` is set correctly
   - If your provider requires SSL, set `DATABASE_SSL=true`

3. **CORS errors**
   - Verify `FRONTEND_URL` matches your Netlify domain exactly
   - Include protocol (https://)

4. **Health check failures**
   - Verify app starts on correct PORT
   - Check `/health` endpoint responds

### **Logs & Debugging**

- **Railway:** Check logs in dashboard
- **Render:** View logs in service dashboard  
- **Fly.io:** `fly logs`

---

## **Scaling Considerations**

For production use, consider:

1. **Database:** Migrate to PostgreSQL for better concurrent access
2. **File Storage:** Use cloud storage (AWS S3, Cloudinary) instead of local files
3. **Caching:** Add Redis for better performance
4. **Monitoring:** Set up proper logging and monitoring

---

**🎉 Your backend should now be deployed and accessible!**