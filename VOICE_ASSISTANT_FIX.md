# Voice Assistant Fix Guide

## Issue Identified: 2026-01-24

### Problem
The voice assistant was not working - clicking the microphone button did not produce any response.

### Root Causes

#### 1. Missing OpenAI API Key ✅ FIXED
- **Location:** `.env` file, line 13
- **Issue:** `OPENAI_API_KEY=` was empty
- **Impact:**
  - Speech-to-text (Whisper API) couldn't transcribe audio
  - LLM (GPT-4) couldn't process commands
  - Text-to-speech (TTS) couldn't generate audio responses
- **Fix:** Added valid OpenAI API key to `.env` file

#### 2. Backend Server Not Running
- **Issue:** Backend server on port 3002 was not running
- **Impact:** Frontend couldn't communicate with API endpoints
- **Fix:** Requires running `npm run dev` or `npm start` in the backend directory

### Solution Steps

1. **Verify OpenAI API Key** (Required)
   ```bash
   # Check your .env file has the key
   grep OPENAI_API_KEY .env

   # Should show:
   # OPENAI_API_KEY=sk-proj-...your-key-here...
   ```

2. **Install Dependencies** (If needed)
   ```bash
   # In project root
   npm install

   # In frontend directory
   cd frontend && npm install
   ```

3. **Start Backend Server**
   ```bash
   # From project root
   npm run dev

   # Should see:
   # ✅ Servio backend listening on http://localhost:3002
   ```

4. **Start Frontend** (In new terminal)
   ```bash
   cd frontend
   npm run dev

   # Frontend runs on http://localhost:3000
   ```

5. **Test Voice Assistant**
   - Navigate to: http://localhost:3000/dashboard/assistant
   - Click the blue microphone button
   - Speak a command: "check current orders" or "what's 86'd?"
   - Assistant should respond with voice + text transcript

### Technical Details

#### Voice Assistant Architecture

**Frontend Components:**
- `/frontend/components/Assistant/AssistantPanel.tsx` - Main UI
- `/frontend/components/Assistant/MicrophoneButton.tsx` - Recording control
- `/frontend/components/Assistant/RealisticAvatar.tsx` - Visual feedback

**Backend Services:**
- `/src/services/AssistantService.ts` - OpenAI integration
- `/src/routes/assistant.ts` - API endpoints

**API Endpoints:**
- `POST /api/assistant/process-audio` - Processes voice recordings
- `POST /api/assistant/process-text` - Processes text commands
- `GET /api/assistant/status` - Health check

**OpenAI APIs Used:**
- **Whisper** (speech-to-text) - Transcribes audio to text
- **GPT-4** (LLM) - Processes commands with tool calling
- **TTS-1** (text-to-speech) - Generates voice responses

#### Environment Variables Required

```env
# Required for voice assistant
OPENAI_API_KEY=sk-proj-your-key-here

# Optional TTS configuration
OPENAI_TTS_MODEL=tts-1
OPENAI_TTS_VOICE=alloy  # Options: alloy, echo, fable, onyx, nova, shimmer

# Backend/Frontend connection
PORT=3002
FRONTEND_URL=http://localhost:3000
```

### Features Available

Once working, the voice assistant can:
- ✅ **Check orders** - "Show me current orders"
- ✅ **Update order status** - "Mark order 123 as complete"
- ✅ **Manage inventory** - "86 the chicken" or "check inventory"
- ✅ **View tasks** - "Show pending tasks"
- ✅ **Complete tasks** - "Mark task 5 as complete"
- ✅ **Always Listening mode** - Continuous wake word detection ("Servio")

### Security Notes

⚠️ **IMPORTANT:**
- **Never commit `.env` files with API keys to git**
- **Never share API keys in public channels**
- **Rotate exposed API keys immediately**
- `.env` is in `.gitignore` - keep it that way!

### Troubleshooting

**"Network error" or "Failed to process audio":**
- Check backend is running on port 3002
- Verify `OPENAI_API_KEY` is set correctly
- Check OpenAI API usage limits/billing

**"Microphone access denied":**
- Browser needs microphone permissions
- Check browser settings
- Try HTTPS (required for some browsers)

**"No response after speaking":**
- Check browser console for errors
- Verify backend logs for API errors
- Test with quick commands (text input) first

**Backend won't start:**
- Check for port conflicts: `lsof -i:3002`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Node.js version: `node -v` (requires >=20)

---

**Last Updated:** 2026-01-24
**Issue Status:** OpenAI API key configured, awaiting backend server restart
