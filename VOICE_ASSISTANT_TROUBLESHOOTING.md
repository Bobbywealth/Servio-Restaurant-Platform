# Voice Assistant Troubleshooting Guide

## Issue: Voice Assistant Not Working (API Key Already Configured)

This guide addresses issues when the OpenAI API key is already set but the voice assistant still doesn't respond when clicking the microphone button.

---

## Quick Diagnostic Checklist

Run through these checks in order:

### ✅ **1. Backend Server Running?**
```bash
# Check if backend is running
curl http://localhost:3002/health

# Should return: {"status":"healthy"}
# If connection refused → Backend not running
```

**Fix:** Start the backend server
```bash
npm run dev
```

---

### ✅ **2. User Authentication**
The voice assistant requires authentication. Check browser console for 401 errors.

**Symptoms:**
- Microphone button appears but nothing happens
- Console shows: `401 Unauthorized` or `UnauthorizedError`
- Network tab shows failed `/api/assistant/process-audio` requests

**Fix:** Ensure you're logged in
```bash
# Check if tokens exist in localStorage
# Browser Console:
localStorage.getItem('servio_access_token')
localStorage.getItem('servio_refresh_token')

# If null → You're not logged in
```

**Solution:** Log out and log back in to refresh tokens

---

### ✅ **3. Microphone Permissions**
Browser needs microphone access.

**Check:** Look for browser permission prompt or icon in address bar

**Fix:**
- **Chrome:** Click lock icon → Site settings → Microphone → Allow
- **Firefox:** Click lock icon → Permissions → Microphone → Allow
- **Safari:** Safari menu → Settings → Websites → Microphone → Allow

**Test:** Browser console should show:
```javascript
navigator.mediaDevices.getUserMedia({audio: true})
  .then(() => console.log('✅ Microphone access granted'))
  .catch(err => console.error('❌ Microphone denied:', err))
```

---

### ✅ **4. OpenAI API Key Valid**
Even if configured, the key might be invalid or expired.

**Test the API endpoint:**
```bash
curl http://localhost:3002/api/assistant/status

# Should show:
# {
#   "features": {
#     "speechToText": "available",
#     "textToSpeech": "available",
#     "llm": "available"
#   }
# }
```

**If shows "unavailable":** API key not loaded properly

**Fix:**
1. Verify `.env` file has the key:
   ```bash
   grep OPENAI_API_KEY .env
   ```

2. Restart backend server (it only loads `.env` on startup)

3. Test key directly:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY_HERE"

   # Should return list of models
   # If 401 → Key is invalid
   ```

---

### ✅ **5. Frontend-Backend Connection**
Frontend might be pointing to wrong backend URL.

**Check:** Browser console → Network tab → Look for failed API calls

**Common Issues:**
- Frontend on `localhost:3000` trying to reach `localhost:3002` ✅ OK
- Frontend on production trying to reach `localhost:3002` ❌ WRONG
- CORS errors ❌ Backend not configured properly

**Fix:** Set frontend environment variables
```bash
# In frontend/.env.local
NEXT_PUBLIC_BACKEND_URL=http://localhost:3002

# For production:
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
```

---

### ✅ **6. Audio Format Compatibility**
Some browsers send audio in formats OpenAI can't process.

**Check:** Browser console for errors during recording

**The Code Handles:**
- `audio/webm;codecs=opus` (Chrome)
- `audio/webm` (Firefox)
- `audio/mp4` (Safari)

**If you see errors:** Try different browser
- ✅ Chrome/Edge (best compatibility)
- ✅ Firefox (good)
- ⚠️ Safari (may have issues)

---

### ✅ **7. OpenAI API Rate Limits**
You might be hitting rate limits or quota exceeded.

**Symptoms:**
- First few requests work, then stop
- Backend logs show `429 Too Many Requests`
- Error: "Rate limit exceeded"

**Check:**
1. Go to https://platform.openai.com/usage
2. Check your quota and limits
3. Look for rate limit errors

**Fix:**
- Wait a few minutes if rate limited
- Upgrade OpenAI plan if quota exceeded
- Add billing payment method

---

### ✅ **8. Browser Console Errors**
Check for JavaScript errors preventing functionality.

**Open Browser Console:**
- **Chrome/Edge:** F12 or Cmd+Option+J (Mac)
- **Firefox:** F12 or Cmd+Option+K (Mac)
- **Safari:** Cmd+Option+C (Mac)

**Look for:**
- Red errors mentioning "audio", "microphone", or "permission"
- Network errors (failed requests)
- CORS errors
- Authentication errors (401/403)

---

## Common Error Messages & Fixes

### **"Network error" or "Failed to process audio"**
**Cause:** Backend not reachable or crashed

**Fix:**
1. Check backend is running: `curl http://localhost:3002/health`
2. Check backend logs for errors
3. Restart backend: `npm run dev`

---

### **"Failed to access microphone"**
**Cause:** Browser permissions denied

**Fix:**
1. Check browser address bar for microphone icon
2. Click it and select "Allow"
3. Refresh the page
4. Try again

---

### **"I didn't catch that. Could you please repeat?"**
**Cause:** OpenAI Whisper couldn't transcribe the audio

**Possible Reasons:**
- Audio too quiet
- Background noise
- Audio file corrupt
- Audio too short (less than 0.5 seconds)

**Fix:**
- Speak louder and clearer
- Reduce background noise
- Hold microphone button longer (at least 1-2 seconds)
- Try using text input instead to test if backend works

---

### **Request times out after 60 seconds**
**Cause:** OpenAI API is slow or backend is processing too long

**Fix:**
- Keep voice commands short and clear
- Check OpenAI API status: https://status.openai.com/
- Try text input (Quick Commands) to isolate issue

---

### **401 Unauthorized**
**Cause:** Authentication token missing or expired

**Fix:**
1. Log out completely
2. Clear browser localStorage:
   ```javascript
   localStorage.clear()
   ```
3. Log back in
4. Try voice assistant again

---

## Debug Mode: Step-by-Step Test

Run these commands in **browser console** while on `/dashboard/assistant`:

```javascript
// 1. Check if audio is supported
console.log('MediaRecorder supported?', typeof MediaRecorder !== 'undefined')

// 2. Check microphone access
navigator.mediaDevices.getUserMedia({audio: true})
  .then(() => console.log('✅ Microphone OK'))
  .catch(err => console.error('❌ Microphone denied:', err))

// 3. Check authentication
console.log('Access token:', localStorage.getItem('servio_access_token') ? '✅ Present' : '❌ Missing')

// 4. Test backend connection
fetch('http://localhost:3002/api/assistant/status', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('servio_access_token')}`
  }
})
  .then(r => r.json())
  .then(data => console.log('✅ Backend status:', data))
  .catch(err => console.error('❌ Backend error:', err))

// 5. Test Quick Command (bypasses microphone)
// Just click one of the "Quick Commands" buttons
// If this works → microphone is the issue
// If this doesn't work → backend/API is the issue
```

---

## Testing Without Voice

If microphone isn't working, test with Quick Commands first:

1. Go to `/dashboard/assistant`
2. Click **"Check orders"** button (below the chat input)
3. Should see response in conversation feed
4. Should hear voice response

**If Quick Commands work:** Issue is microphone-specific
**If Quick Commands don't work:** Issue is backend/API

---

## Detailed Logging

Enable detailed logging to see exactly what's happening:

### Backend Logs:
```bash
# Start backend and watch logs
npm run dev

# Look for:
# ✅ "Processing audio for user..." → Request received
# ✅ "Transcribed audio: ..." → Speech-to-text worked
# ❌ "Transcription failed:" → OpenAI API error
# ❌ "Failed to process audio:" → General error
```

### Frontend Logs:
Open browser console and look for:
```
✅ "Processing recording, chunks count: X" → Audio captured
✅ "Sending audio to backend..." → Sending request
✅ "Backend response received:" → Got response
❌ "Failed to process recording:" → Error occurred
```

---

## Still Not Working?

### Collect This Information:

1. **Environment:**
   - Operating System: ________________
   - Browser & Version: ________________
   - Node.js version: `node -v` → ________________

2. **Backend Status:**
   ```bash
   curl http://localhost:3002/health
   curl http://localhost:3002/api/assistant/status
   ```
   Result: ________________

3. **Frontend Environment:**
   ```bash
   cd frontend
   cat .env.local
   ```
   NEXT_PUBLIC_BACKEND_URL: ________________

4. **Browser Console Errors:**
   Copy/paste any red errors: ________________

5. **Backend Logs:**
   Copy/paste last 20 lines when attempting voice command: ________________

6. **Authentication Status:**
   ```javascript
   // In browser console
   localStorage.getItem('servio_access_token') ? 'Present' : 'Missing'
   ```
   Result: ________________

---

## Known Working Configuration

This setup is confirmed working:

- **Backend:** Running on `localhost:3002`
- **Frontend:** Running on `localhost:3000`
- **Browser:** Chrome/Edge (latest version)
- **Node.js:** v20 or higher
- **OpenAI API:** Valid key with available quota
- **Microphone:** Permissions granted
- **User:** Logged in with valid tokens

If your setup matches this and it still doesn't work, there may be a code bug that needs investigation.

---

**Last Updated:** 2026-01-24
