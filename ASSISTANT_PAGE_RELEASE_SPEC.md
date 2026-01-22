# AI Assistant Page - Release Engineering Specification

**Page:** `/dashboard/assistant`  
**Date:** 2026-01-22  
**Status:** Pre-Release QA Required

---

## 1. FILE INVENTORY

### Frontend Files
- **Main Page:** `frontend/pages/dashboard/assistant.tsx` (994 lines)
- **Layout:** `frontend/components/Layout/DashboardLayout.tsx`
- **Components:**
  - `frontend/components/Assistant/RealisticAvatar.tsx`
  - `frontend/components/Assistant/MicrophoneButton.tsx`
  - `frontend/components/Assistant/TranscriptFeed.tsx`
  - `frontend/components/Assistant/ChatInput.tsx`
  - `frontend/components/Assistant/QuickCommands.tsx`
  - `frontend/components/Assistant/Avatar.tsx`
  - `frontend/components/Assistant/AnimatedFace.tsx`
- **Services:** `frontend/lib/WakeWordService.ts`

### Backend Files
- **Route:** `src/routes/assistant.ts` (275 lines)
- **Service:** `src/services/AssistantService.ts` (712 lines)
- **Middleware:** `src/middleware/auth.ts` (requireAuth)

### Routes
- **Frontend:** `/dashboard/assistant` → `AssistantPage` component
- **Backend Endpoints:**
  - `POST /api/assistant/process-audio` (Auth required)
  - `POST /api/assistant/process-text` (Auth required)
  - `GET /api/assistant/status` (Auth required)
  - `GET /api/assistant/conversation/:userId` (Auth required)
  - `DELETE /api/assistant/conversation/:userId` (Auth required)
  - `POST /api/assistant/feedback` (Auth required)
  - `GET /api/assistant/tools` (Auth required)

---

## 2. PAGE CONTRACT

### Purpose
Voice and text-powered AI assistant for restaurant operations. Enables staff to manage orders, inventory, menu items, and tasks through natural language commands.

### Target Users
- **Manager** (role: `manager`)
- **Owner** (role: `owner`)
- **Platform Admin** (role: `admin`)
- **NOT** Staff (role: `staff`) - filtered out in DashboardLayout navigation

### Inputs

**URL Parameters:** None

**Query Parameters:** None

**Props:** None (standard Next.js page)

**User Context Required:**
- `user.id` (string) - Required for API calls
- `user.role` (enum) - Must be manager/owner/admin
- `user.restaurantId` (string) - For scoping operations

**Browser Permissions Required:**
- Microphone access (`navigator.mediaDevices.getUserMedia`)
- Audio playback

### Outputs

**UI States:**
- `isRecording` - Microphone capturing audio
- `isProcessing` - Backend processing request
- `isSpeaking` - TTS audio playing
- `alwaysListening` - Continuous listening mode active
- `inConversationWindow` - 30s window after wake word
- `messages[]` - Conversation history (ephemeral, not persisted)

**Side Effects:**
1. Creates audio recordings (Blob, sent to backend)
2. Writes TTS files to `uploads/tts/*.mp3` (backend)
3. Writes temp audio files to OS temp dir (backend)
4. Updates database records via tool calls:
   - `orders` table (status updates)
   - `menu_items` table (availability)
   - `inventory_items` table (quantity adjustments)
   - `tasks` table (completion)
   - `audit_logs` table (all actions logged)

### External Dependencies

**APIs:**
- OpenAI Whisper API (speech-to-text)
- OpenAI GPT-4 API (language model)
- OpenAI TTS API (text-to-speech)

**Environment Variables (Backend):**
- `OPENAI_API_KEY` (REQUIRED) - OpenAI API key
- `OPENAI_TTS_MODEL` (optional, default: `tts-1`)
- `OPENAI_TTS_VOICE` (optional, default: `alloy`)

**Browser APIs:**
- `MediaRecorder` (audio recording)
- `AudioContext` / `webkitAudioContext` (audio visualization)
- `Web Speech API` (optional, for wake word service)

**Database Tables (Read):**
- `users` (get restaurant_id)
- `orders` (query active orders)
- `menu_items` (query availability)
- `inventory_items` (query stock levels)
- `tasks` (query pending tasks)

**Database Tables (Write):**
- `orders` (update status)
- `menu_items` (update is_available)
- `inventory_items` (update on_hand_qty)
- `tasks` (update status, completed_at)
- `audit_logs` (log all actions)

---

## 3. INTERACTIVE ELEMENT INVENTORY

### A. Microphone Button
**Selector:** `[data-testid="microphone-button"]` (NEEDS TO BE ADDED)  
**Component:** `MicrophoneButton.tsx`  
**Location:** Left sidebar, avatar card

**Behavior:**
- **Default:** Click to start recording
- **While Recording:** Click to stop recording
- **Mode:** Toggle mode (single click on/off)

**Disabled When:**
- `!mediaRecorder` (microphone not initialized)
- `state.isProcessing` (backend processing)

**Expected Outcome:**
- **Click (idle → recording):**
  - Starts MediaRecorder
  - Sets `isRecording: true`
  - Collects audio chunks every 100ms
  - Shows recording indicator (red pulsing dot)
  
- **Click (recording → idle):**
  - Stops MediaRecorder
  - Sets `isRecording: false`, `isProcessing: true`
  - Sends audio to `POST /api/assistant/process-audio`
  - Receives transcript + response + actions + audioUrl
  - Adds messages to conversation
  - Plays TTS audio if provided

**Error Messages:**
- Permission denied: "Failed to access microphone. Please check permissions."
- Processing failed: "🎤 Failed to process audio: {error}. Try speaking more clearly or use text input instead."

**Success Indicators:**
- Status badge shows "🎤 Listening" while recording
- Avatar animates (listening state)
- Conversation updates with transcript

---

### B. Always Listening Toggle Button
**Selector:** `[data-testid="always-listening-toggle"]` (NEEDS TO BE ADDED)  
**Location:** Left sidebar, below avatar card

**Behavior:**
- **OFF → ON:** Activates continuous listening mode
- **ON → OFF:** Deactivates continuous listening mode

**Disabled When:**
- `state.isProcessing`

**Expected Outcome:**
- **Activate:**
  - Sets `alwaysListening: true`
  - Adds system message: "🎯 Always Listening activated."
  - Auto-starts recording after 500ms
  - Records in 5-second chunks, auto-restarts
  - Ignores audio without wake word "Servio"
  - Creates 30s conversation window after wake word detected
  
- **Deactivate:**
  - Sets `alwaysListening: false`
  - Stops recording if active
  - Clears conversation window timer
  - Sets `inConversationWindow: false`
  - Adds system message: "🎯 Always Listening deactivated."

**Wake Word Logic:**
- Accepts: "servio", "sergio", "serveio" (case-insensitive)
- If detected: Opens 30s conversation window
- Within window: Processes all speech without wake word
- Window expires: Shows "⏱️ Conversation paused. Say 'Servio' to continue."
- Outside window: Ignores speech, shows "🔇 Ignored: {transcript} (say 'Servio' to start)"

**Visual Indicators:**
- Button text: "🎯 Always Listen" (off) / "⏸ Stop Listening" (on)
- Button color: Purple (off) / Red (on)
- Badge: "Always On" appears in header
- Status text: "Say 'Servio' to start" or "💬 In conversation"

---

### C. Text Input Field
**Selector:** `[data-testid="chat-input"]` (NEEDS TO BE ADDED)  
**Component:** `ChatInput.tsx`  
**Location:** Bottom right, input card

**Behavior:**
- Type text command
- Press Enter or click send button to submit

**Disabled When:**
- `state.isProcessing`
- `state.isRecording`

**Validation:**
- Min length: 1 character (implicit)
- Max length: None (but backend will truncate if >100 chars in logs)

**Expected Outcome:**
- Adds user message immediately (optimistic UI)
- Sets `isProcessing: true`
- Sends to `POST /api/assistant/process-text`
- Receives response + actions + audioUrl
- Adds assistant message(s) to conversation
- Plays TTS audio
- Resets input field

**Error Messages:**
- Network error: "🔌 Network error. Please check your connection and try again."
- Timeout: "⏱️ Request timed out. The server might be busy. Please try again."
- Generic: "❌ Error: {message}. Please try rephrasing your command."

---

### D. Quick Command Buttons (×3)
**Selectors:** (NEED TO BE ADDED)
- `[data-testid="quick-command-check-orders"]`
- `[data-testid="quick-command-whats-86d"]`
- `[data-testid="quick-command-inventory"]`

**Commands:**
1. "Check orders" → `"check current orders"`
2. "What's 86'd?" → `"what items are 86'd"`
3. "Inventory" → `"show inventory levels"`

**Disabled When:**
- `state.isProcessing`
- `state.isRecording`

**Expected Outcome:**
- Same as text input submission
- Pre-fills command and sends immediately

---

### E. Status Indicator Dot
**Selector:** `[data-testid="status-indicator"]` (NEEDS TO BE ADDED)  
**Location:** Header, left of title

**Visual States:**
- Red pulsing: `isRecording`
- Yellow pulsing: `isProcessing`
- Green pulsing: `isSpeaking`
- Gray static: Ready (idle)

**No interaction** - Display only

---

### F. Conversation Feed
**Selector:** `[data-testid="transcript-feed"]` (NEEDS TO BE ADDED)  
**Component:** `TranscriptFeed.tsx`

**Message Types:**
1. **user** - User's spoken/typed input
2. **assistant** - AI response
3. **action** - Tool execution result (e.g., "Found 3 orders")
4. **system** - Status messages (e.g., "Always Listening activated")

**Behavior:**
- Auto-scrolls to bottom on new message
- Shows timestamp for each message
- Shows processing time for assistant responses
- Shows action status (success/error) with icons

**No direct interaction** - Display only

---

### G. Avatar Animation
**Selector:** `[data-testid="assistant-avatar"]` (NEEDS TO BE ADDED)  
**Component:** `RealisticAvatar.tsx`

**Visual States:**
- `isTalking: true` - Mouth animates with audio waveform
- `isListening: true` - Listening animation
- `isThinking: true` - Thinking animation
- `audioLevel: 0-100` - Mouth movement intensity

**No direct interaction** - Display only

---

## 4. STATE DIAGRAM

### State Machine

```
┌─────────────┐
│   LOADING   │ (Initial mount, requesting mic permission)
└──────┬──────┘
       │
       ├─ Mic Granted → READY
       └─ Mic Denied → MIC_UNAVAILABLE
       
┌─────────────┐
│    READY    │ (Idle, waiting for input)
└──────┬──────┘
       │
       ├─ Click mic → RECORDING
       ├─ Type text → PROCESSING
       ├─ Click always listen → ALWAYS_LISTENING_IDLE
       └─ No auth → UNAUTHORIZED
       
┌──────────────┐
│  RECORDING   │ (Capturing audio)
└──────┬───────┘
       │
       ├─ Click mic again → PROCESSING
       ├─ Auto-stop (5s) in always listening → PROCESSING
       └─ Error → ERROR
       
┌──────────────┐
│  PROCESSING  │ (Backend call in progress)
└──────┬───────┘
       │
       ├─ Success + audioUrl → SPEAKING
       ├─ Success + no audio → READY
       ├─ Error → ERROR (shows error message)
       └─ Timeout → ERROR
       
┌──────────────┐
│   SPEAKING   │ (Playing TTS audio)
└──────┬───────┘
       │
       ├─ Audio ends → READY
       └─ Audio ends + alwaysListening → RECORDING (auto-restart)
       
┌──────────────────────┐
│ ALWAYS_LISTENING_IDLE│ (Listening for wake word)
└──────┬───────────────┘
       │
       ├─ Auto-record (5s chunks) → RECORDING
       ├─ Wake word detected → IN_CONVERSATION_WINDOW
       └─ Click stop → READY
       
┌────────────────────────┐
│ IN_CONVERSATION_WINDOW │ (30s window after wake word)
└──────┬─────────────────┘
       │
       ├─ Each utterance extends window → IN_CONVERSATION_WINDOW
       ├─ 30s expires → ALWAYS_LISTENING_IDLE
       └─ Click stop → READY
       
┌─────────────┐
│    ERROR    │ (Temporary state, shows error message)
└──────┬──────┘
       │
       └─ Auto-return after message → READY
       
┌───────────────────┐
│  MIC_UNAVAILABLE  │ (Permanent until permission granted)
└───────────────────┘
       │
       └─ Shows: "Microphone unavailable"

┌──────────────────┐
│  UNAUTHORIZED    │ (No valid JWT)
└──────────────────┘
       │
       └─ Redirect to /login
```

### UI Rendering Per State

| State | Status Dot | Avatar | Mic Button | Always Listen Btn | Text Input | Messages |
|-------|-----------|---------|-----------|-------------------|-----------|----------|
| LOADING | Gray | Idle | Disabled "Initializing..." | Disabled | Disabled | Empty |
| READY | Gray | Idle | Enabled "Click to start" | Enabled "🎯 Always Listen" | Enabled | 0+ messages |
| RECORDING | Red pulse | Listening | Enabled "Recording..." | Disabled | Disabled | Shows recording |
| PROCESSING | Yellow pulse | Thinking | Disabled "Processing..." | Disabled | Disabled | Shows "🧠 Thinking" |
| SPEAKING | Green pulse | Talking (animated) | Disabled | Disabled | Disabled | Shows "🗣️ Speaking" |
| ALWAYS_LISTENING_IDLE | Purple pulse | Idle | Enabled | Enabled "⏸ Stop" (red) | Enabled | Shows "Say 'Servio'" |
| IN_CONVERSATION_WINDOW | Purple pulse | Idle | Enabled | Enabled "⏸ Stop" (red) | Enabled | Shows "💬 In conversation" |
| ERROR | Red | Idle | Enabled | Enabled | Enabled | Shows error message |
| MIC_UNAVAILABLE | Gray | Idle | Disabled "Unavailable" | Enabled (fallback to text) | Enabled | Empty |
| UNAUTHORIZED | - | - | - | - | - | Redirect to /login |

### State Transition Triggers

**User Actions:**
- Click microphone → `startRecording()`
- Click microphone again → `stopRecording()`
- Click always listen → Toggle `alwaysListening`
- Type + send text → `handleQuickCommand()`
- Click quick button → `handleQuickCommand()`

**System Actions:**
- MediaRecorder initialized → Enable mic button
- MediaRecorder.onstop → `processRecording()`
- Audio.onended → Transition to READY or auto-restart
- 5s timer in always listening → Auto-stop recording
- 30s timer in conversation window → Expire window
- Wake word detected → Open conversation window

**API Responses:**
- Success → Add messages, play audio
- Error → Show error message, return to READY

---

## 3. COMPLETE INTERACTIVE INVENTORY

### Button: Microphone Toggle
- **ID:** `microphone-button`
- **Clicks:** 1 (toggle)
- **States:** Idle / Recording
- **Disabled:** `!mediaRecorder || state.isProcessing`
- **Success:** Recording starts/stops, audio processed
- **Error:** "Failed to access microphone" (permission denied)
- **Validation:** None
- **Debounce:** None (state-based prevention)
- **Keyboard:** None

### Button: Always Listening Toggle
- **ID:** `always-listening-toggle`
- **Clicks:** 1 (toggle)
- **States:** Off / On
- **Disabled:** `state.isProcessing`
- **Success:** Continuous listening activated/deactivated
- **Error:** None (local state only)
- **Validation:** None
- **Debounce:** None
- **Keyboard:** None

### Input: Text Command
- **ID:** `chat-input`
- **Type:** Text field
- **Max Length:** None (frontend), 100 char preview (backend logs)
- **Disabled:** `state.isProcessing || state.isRecording`
- **Validation:** Required (min 1 char)
- **Success:** Message sent, response received
- **Error:** Network/timeout/API errors shown in conversation
- **Submit:** Enter key or send button
- **Debounce:** None
- **Keyboard:** Enter to submit

### Button: Send Message (in ChatInput)
- **ID:** `send-message-button`
- **Clicks:** 1
- **Disabled:** `!inputValue || state.isProcessing || state.isRecording`
- **Success:** Same as text input submission
- **Error:** Same as text input
- **Validation:** Input must have value
- **Debounce:** None

### Button: Quick Command "Check orders"
- **ID:** `quick-command-check-orders`
- **Clicks:** 1
- **Command:** `"check current orders"`
- **Disabled:** `state.isProcessing || state.isRecording`
- **Success:** Triggers text processing flow
- **Error:** Same as text input
- **Validation:** None (hardcoded command)
- **Debounce:** None

### Button: Quick Command "What's 86'd?"
- **ID:** `quick-command-whats-86d`
- **Clicks:** 1
- **Command:** `"what items are 86'd"`
- **Disabled:** `state.isProcessing || state.isRecording`
- **Success:** Triggers text processing flow
- **Error:** Same as text input
- **Validation:** None
- **Debounce:** None

### Button: Quick Command "Inventory"
- **ID:** `quick-command-inventory`
- **Clicks:** 1
- **Command:** `"show inventory levels"`
- **Disabled:** `state.isProcessing || state.isRecording`
- **Success:** Triggers text processing flow
- **Error:** Same as text input
- **Validation:** None
- **Debounce:** None

### Keyboard Shortcuts
**NONE IMPLEMENTED** - Recommend adding:
- `Space` - Start/stop recording (when focused)
- `Cmd/Ctrl + K` - Focus text input
- `Esc` - Stop recording or cancel always listening

---

## 5. SECURITY & PERMISSIONS

### Frontend Permission Check
**File:** `frontend/pages/dashboard/assistant.tsx`  
**Line:** 28  
**Code:** `const { user, hasPermission } = useUser()`

**Issue:** No explicit permission check in component!

**Navigation Filter:**
**File:** `frontend/components/Layout/DashboardLayout.tsx`  
**Lines:** 90-97  
**Code:**
```typescript
{
  name: 'Assistant',
  href: '/dashboard/assistant',
  icon: Mic,
  description: 'AI voice assistant',
  color: 'text-servio-orange-500',
  highlight: true,
  roles: ['manager', 'owner', 'admin']  // ✅ Filtered here
}
```

### Backend Permission Enforcement

**File:** `src/server.ts`  
**Line:** 72  
**Code:** `app.use('/api/assistant', requireAuth, assistantRoutes);`

**Middleware:** `src/middleware/auth.ts`  
**Function:** `requireAuth()`  
**Checks:**
1. JWT token present in Authorization header
2. Token is valid and not expired
3. Attaches `req.user` with { id, role, restaurantId, permissions }

### Actions Requiring Server-Side Enforcement

| Action | Endpoint | Auth Check | Permission Check | Location |
|--------|----------|-----------|------------------|----------|
| Process audio | POST /api/assistant/process-audio | ✅ requireAuth | ❌ None (implicit: must be manager+) | assistant.ts:31-32 |
| Process text | POST /api/assistant/process-text | ✅ requireAuth | ❌ None | assistant.ts:71-73 |
| Get orders (tool) | N/A (internal) | ✅ Via tool execution | ❌ None | AssistantService.ts:464-498 |
| Update order status (tool) | N/A (internal) | ✅ Via tool execution | ❌ None | AssistantService.ts:500-524 |
| Set item availability (tool) | N/A (internal) | ✅ Via tool execution | ❌ None | AssistantService.ts:526-561 |
| Get inventory (tool) | N/A (internal) | ✅ Via tool execution | ❌ None | AssistantService.ts:563-600 |
| Adjust inventory (tool) | N/A (internal) | ✅ Via tool execution | ❌ None | AssistantService.ts:602-642 |
| Get tasks (tool) | N/A (internal) | ✅ Via tool execution | ❌ None | AssistantService.ts:644-681 |
| Complete task (tool) | N/A (internal) | ✅ Via tool execution | ❌ None | AssistantService.ts:683-709 |

### Missing Security Guards

**CRITICAL:**
1. **No fine-grained permission checks** for individual tools
   - Currently, ANY authenticated manager/owner can access ALL tools
   - Should check permissions like `orders:update`, `inventory:adjust`, etc.
   - **Recommendation:** Add permission checks in `executeTool()` before calling handlers

2. **No rate limiting** on assistant endpoints
   - Expensive OpenAI API calls
   - Could be abused
   - **Recommendation:** Add rate limit middleware (10 requests/minute per user)

3. **No audit trail for failed attempts**
   - Only successful tool executions are logged
   - **Recommendation:** Log failed permission checks

4. **File upload size** allows up to 25MB audio
   - Could be weaponized for storage/memory attacks
   - **Recommendation:** Lower to 10MB, add rate limiting

### Recommended Permission Additions

**File:** `src/services/AssistantService.ts`  
**Add to:** `executeTool()` function (line 416)

```typescript
// Before executing tool
const requiredPermission = this.getToolPermission(name);
if (requiredPermission && !this.userHasPermission(userId, requiredPermission)) {
  return {
    type: name,
    status: 'error',
    description: `Permission denied: ${name}`,
    error: `Missing permission: ${requiredPermission}`
  };
}
```

**Tool Permission Map:**
- `get_orders` → `orders:read`
- `update_order_status` → `orders:update`
- `set_item_availability` → `menu:update`
- `get_inventory` → `inventory:read`
- `adjust_inventory` → `inventory:update`
- `get_tasks` → `tasks:read`
- `complete_task` → `tasks:update`

---

## 6. FAILURE MODES & HANDLING

### A. Microphone Permission Denied

**Trigger:** User denies mic permission or browser blocks access

**Current Handling:**
- **File:** `assistant.tsx:470-476`
- **Action:** Catches error, adds system message
- **Message:** "Failed to access microphone. Please check permissions."
- **Recovery:** User can still use text input

**Missing:**
- No prompt to re-request permission
- No link to browser settings help

**Recommendation:**
- Add "Grant Permission" button that calls `getUserMedia()` again
- Add help link with browser-specific instructions

---

### B. API Call: POST /api/assistant/process-audio

**Failure Modes:**

**1. Network Offline**
- **Error:** `Network Error` from axios
- **Current Handling:** assistant.tsx:626-628
- **Message:** "🔌 Network error. Please check your connection and try again."
- **Recovery:** Manual retry (user clicks button again)
- **Retry Logic:** None
- **Recommendation:** Auto-retry once after 2s delay

**2. Request Timeout (>60s)**
- **Error:** `timeout` in error message
- **Current Handling:** assistant.tsx:629-630
- **Message:** "⏱️ Request timed out. The server might be busy. Please try again."
- **Recovery:** Manual retry
- **Recommendation:** Reduce timeout to 30s for better UX

**3. 400 Bad Request**
- **Causes:**
  - No audio file provided (shouldn't happen - frontend always sends)
  - Invalid audio format (multer filter)
- **Backend Response:** `{ success: false, error: { message: "..." } }`
- **Current Handling:** Generic error handler
- **Message:** "❌ Error: {message}"
- **Recovery:** Manual retry

**4. 401 Unauthorized**
- **Causes:**
  - JWT expired
  - No token present
- **Current Handling:** axios interceptor in `lib/api.ts:60-97`
- **Action:** Attempts token refresh, then redirects to /login
- **Recovery:** Automatic (refresh token) or redirect

**5. 413 Payload Too Large**
- **Causes:** Audio file >25MB
- **Backend Response:** `{ success: false, error: { message: "Audio file too large..." } }`
- **Current Handling:** Generic error handler
- **Message:** "❌ Error: Audio file too large. Maximum size is 25MB."
- **Recovery:** Ask user to speak shorter phrases
- **Recommendation:** Frontend should check duration before upload

**6. 500 Internal Server Error**
- **Causes:**
  - OpenAI API error
  - OpenAI API key invalid
  - Database error
  - Temp file write error
- **Backend Response:** `{ success: false, error: { message: "Failed to process audio", details: "..." } }`
- **Backend Fallback:** Returns generic response "I'm having trouble processing your request right now. Please try again."
- **Current Handling:** assistant.tsx:380-394
- **Message:** "🎤 Failed to process audio: {error}. Try speaking more clearly or use text input instead."
- **Recovery:** Manual retry or use text input
- **Logging:** ✅ Backend logs error (assistant.ts:56)

**7. OpenAI API Errors**
- **Whisper Transcription Failed:**
  - **Error:** Thrown from `transcribeAudio()`
  - **Backend Handling:** Catches, logs, returns error response
  - **Location:** AssistantService.ts:159-162
  
- **GPT-4 Completion Failed:**
  - **Error:** Thrown from `openai.chat.completions.create()`
  - **Backend Handling:** Catches, logs, returns generic response
  - **Location:** AssistantService.ts:127-139
  
- **TTS Generation Failed:**
  - **Error:** Silently caught
  - **Backend Handling:** Returns empty audioUrl (no audio plays)
  - **Location:** AssistantService.ts:195-198
  - **Issue:** No user notification that TTS failed

**Recommendation:** Add frontend toast when audioUrl is empty

---

### C. API Call: POST /api/assistant/process-text

**Failure Modes:** Same as process-audio except no 413 error

**Additional:**
- **400 Bad Request:** Missing `text` field or not a string
- **Validation:** Backend checks `!text || typeof text !== 'string'` (assistant.ts:75-80)

---

### D. Always Listening Mode Failures

**1. Recording Auto-Restart Fails**
- **Trigger:** Auto-restart conditions not met
- **Current Handling:** Retries after 1s delay (assistant.tsx:413-418)
- **Max Retries:** 1
- **Timeout:** None (continues retrying in loop)
- **Issue:** Could create infinite loop if conditions never met
- **Recommendation:** Add max retry count (3) or timeout (30s)

**2. Wake Word Not Detected**
- **Trigger:** Speech doesn't contain "servio"
- **Current Handling:** Ignores audio, adds system message (assistant.tsx:281-295)
- **Message:** "🔇 Ignored: {transcript} (say 'Servio' to start)"
- **Recovery:** Auto-restarts recording after 500ms

**3. Conversation Window Expires**
- **Trigger:** 30s timeout after last interaction
- **Current Handling:** Shows message, returns to wake word mode (assistant.tsx:307-316)
- **Message:** "⏱️ Conversation paused. Say 'Servio' to continue."
- **Recovery:** User must say wake word again

---

### E. Audio Playback Failures

**1. Audio File Not Found**
- **Trigger:** Backend returns invalid audioUrl
- **Current Handling:** Audio.onerror not handled
- **Issue:** Silent failure
- **Recommendation:** Add error handler to playAudio()

**2. AudioContext Not Supported**
- **Trigger:** Old browser (no Web Audio API)
- **Current Handling:** Fallback to basic audio playback (assistant.tsx:133-142)
- **Impact:** No mouth animation, but audio still plays

**3. CORS Error on Audio File**
- **Trigger:** Backend not serving uploads with correct CORS headers
- **Current Handling:** audio.crossOrigin = 'anonymous' (assistant.tsx:119)
- **Issue:** If backend doesn't allow, audio won't play
- **Check:** Backend serves `/uploads/*` - need to verify

---

### F. Concurrent Request Handling

**Issue:** No prevention of duplicate submissions

**Scenarios:**
1. User clicks mic twice rapidly
   - **Current:** State check prevents (`mediaRecorder.state !== 'inactive'`)
   - **Location:** assistant.tsx:510
   
2. User submits text while processing
   - **Current:** Input disabled during processing
   - **Location:** assistant.tsx:958 (`disabled={state.isProcessing || state.isRecording}`)
   
3. Multiple always-listening auto-restarts
   - **Current:** State checks before restarting
   - **Location:** assistant.tsx:407, 414, 654
   - **Issue:** Complex retry logic could race

---

### G. Memory Leaks & Cleanup

**Potential Issues:**

1. **AudioContext not closed**
   - **Current:** Cleanup in useEffect (assistant.tsx:496-498)
   - **Status:** ✅ Handled

2. **MediaRecorder stream not stopped**
   - **Current:** Cleanup in useEffect (assistant.tsx:484-489)
   - **Status:** ✅ Handled

3. **Animation frames not cancelled**
   - **Current:** Cleanup in stopAudio() (assistant.tsx:88-91)
   - **Status:** ✅ Handled

4. **Timers not cleared**
   - **Silence timeout:** Cleared in stopRecording() (assistant.tsx:546-548)
   - **Conversation window:** Cleared on deactivate (assistant.tsx:902-904)
   - **Auto-restart timeouts:** ❌ NOT CLEARED
   - **Issue:** setTimeout() calls on lines 204, 244, 291, 405, 413, 652, 658 not stored in refs
   - **Impact:** Could fire after component unmounts
   - **Recommendation:** Store timeout IDs in refs and clear in cleanup

---

## 7. OBSERVABILITY

### Log Events to Add

**Frontend (console.log → structured logging)**

**File:** `frontend/pages/dashboard/assistant.tsx`

| Event | Trigger | Fields | Location |
|-------|---------|--------|----------|
| `assistant.page_loaded` | Component mount | `userId`, `hasPermission`, `micSupported` | Add to useEffect (line ~815) |
| `assistant.mic_permission_requested` | getUserMedia called | `timestamp` | Line 444 |
| `assistant.mic_permission_granted` | Stream obtained | `mimeType`, `sampleRate` | Line 450 |
| `assistant.mic_permission_denied` | Error caught | `error` | Line 471 |
| `assistant.recording_started` | MediaRecorder.start() | `timestamp`, `alwaysListening` | Line 515 |
| `assistant.recording_stopped` | MediaRecorder.stop() | `duration`, `chunkCount`, `alwaysListening` | Line 551 |
| `assistant.audio_processing_started` | POST /api/assistant/process-audio | `fileSize`, `mimeType`, `userId` | Line 257 |
| `assistant.audio_processing_completed` | Response received | `transcript`, `hasActions`, `hasAudio`, `processingTime` | Line 266 |
| `assistant.audio_processing_failed` | Catch block | `error`, `stack` | Line 381 |
| `assistant.text_command_sent` | handleQuickCommand | `command`, `userId` | Line 571 |
| `assistant.text_processing_completed` | Response received | `response`, `actionsCount`, `processingTime` | Line 589 |
| `assistant.text_processing_failed` | Catch block | `error` | Line 626 |
| `assistant.tts_playback_started` | Audio.play() | `audioUrl`, `duration` | Line 214 |
| `assistant.tts_playback_ended` | Audio.onended | `duration` | Line 181 |
| `assistant.always_listening_activated` | Toggle on | `timestamp` | Line 887 |
| `assistant.always_listening_deactivated` | Toggle off | `timestamp` | Line 898 |
| `assistant.wake_word_detected` | Wake word found | `transcript`, `timestamp` | Line 298 |
| `assistant.conversation_window_opened` | After wake word | `timestamp` | Line 299 |
| `assistant.conversation_window_expired` | 30s timeout | `timestamp` | Line 308 |
| `assistant.utterance_ignored` | No wake word | `transcript` | Line 282 |

**Backend (winston logger)**

**File:** `src/services/AssistantService.ts`

| Event | Trigger | Fields | Current Location |
|-------|---------|--------|------------------|
| `assistant.audio_received` | process-audio called | `userId`, `fileSize`, `mimeType` | ✅ Line 46 |
| `assistant.transcription_started` | Whisper API call | `fileSize` | ❌ ADD |
| `assistant.transcription_completed` | Transcript received | `transcript`, `duration` | ✅ Line 49 |
| `assistant.transcription_failed` | Error | `error` | ✅ Line 160 |
| `assistant.llm_request_started` | GPT-4 call | `prompt_tokens` (estimate) | ❌ ADD |
| `assistant.llm_request_completed` | Response received | `completion_tokens`, `tool_calls_count`, `duration` | ❌ ADD |
| `assistant.llm_request_failed` | Error | `error` | ✅ Line 128 |
| `assistant.tool_execution_started` | Tool called | `toolName`, `args`, `userId` | ✅ Line 433 |
| `assistant.tool_execution_completed` | Tool finished | `toolName`, `status`, `duration` | ❌ ADD |
| `assistant.tool_execution_failed` | Tool error | `toolName`, `error` | ✅ Line 454 |
| `assistant.tts_generation_started` | TTS API call | `textLength` | ❌ ADD |
| `assistant.tts_generation_completed` | File written | `fileName`, `fileSize`, `duration` | ❌ ADD |
| `assistant.tts_generation_failed` | Error | `error` | ✅ Line 196 |

### Metrics to Track

**Application Metrics (Add to backend)**

- `assistant_requests_total` (counter) - Labels: `type` (audio/text), `status` (success/error)
- `assistant_processing_duration_seconds` (histogram) - Labels: `type`, `tool_name`
- `assistant_openai_api_calls_total` (counter) - Labels: `api` (whisper/gpt4/tts), `status`
- `assistant_openai_api_duration_seconds` (histogram) - Labels: `api`
- `assistant_openai_api_errors_total` (counter) - Labels: `api`, `error_type`
- `assistant_tool_executions_total` (counter) - Labels: `tool_name`, `status`
- `assistant_conversation_length` (histogram) - Messages per session
- `assistant_audio_file_size_bytes` (histogram)

**User Experience Metrics (Frontend)**

- `assistant.time_to_first_response` - From button click to assistant message
- `assistant.recording_duration` - How long users speak
- `assistant.always_listening_usage` - % of users who enable it
- `assistant.error_rate` - % of commands that fail
- `assistant.retry_rate` - % of users who retry after error

### Tracing

**Add OpenTelemetry spans:**

1. **Frontend → Backend** trace propagation
   - Add `traceparent` header to API requests
   - Link frontend user actions to backend processing

2. **Backend span hierarchy:**
```
assistant.process_audio (root span)
  ├─ assistant.transcribe (OpenAI Whisper)
  ├─ assistant.llm_request (OpenAI GPT-4)
  │  └─ assistant.tool_execution.{tool_name}
  │     └─ database.query
  └─ assistant.generate_speech (OpenAI TTS)
```

---

## 8. AUTOMATED TESTS

### A. Unit Tests

**File:** `__tests__/pages/assistant.test.tsx` (CREATE)

**Test Cases:**

```typescript
describe('AssistantPage', () => {
  // State management
  test('initializes with correct default state', () => {})
  test('updates state when recording starts', () => {})
  test('updates state when recording stops', () => {})
  test('updates state when processing starts', () => {})
  test('updates state when processing completes', () => {})
  
  // Message handling
  test('adds user message to conversation', () => {})
  test('adds assistant message to conversation', () => {})
  test('adds action message to conversation', () => {})
  test('adds system message to conversation', () => {})
  test('generates unique message IDs', () => {})
  
  // Audio URL resolution
  test('resolves relative audio URLs', () => {})
  test('resolves absolute audio URLs', () => {})
  test('handles missing protocol', () => {})
  
  // Always listening logic
  test('ignores audio without wake word', () => {})
  test('detects wake word "servio"', () => {})
  test('detects wake word "sergio" (variant)', () => {})
  test('opens conversation window after wake word', () => {})
  test('extends conversation window on each utterance', () => {})
  test('closes conversation window after 30s', () => {})
  
  // Error handling
  test('handles network error gracefully', () => {})
  test('handles timeout error gracefully', () => {})
  test('handles microphone permission denied', () => {})
  test('handles empty audio buffer', () => {})
})
```

**File:** `__tests__/services/AssistantService.test.ts` (CREATE)

**Test Cases:**

```typescript
describe('AssistantService', () => {
  // Audio processing
  test('transcribes audio buffer to text', async () => {})
  test('handles empty transcript', async () => {})
  test('handles transcription failure', async () => {})
  test('measures processing time', async () => {})
  
  // Text processing
  test('generates assistant response from text', async () => {})
  test('includes restaurant context in system prompt', async () => {})
  test('executes tool calls from LLM', async () => {})
  test('generates TTS audio', async () => {})
  test('handles LLM failure gracefully', async () => {})
  
  // Tool execution
  test('get_orders tool returns correct data', async () => {})
  test('get_orders filters by status', async () => {})
  test('update_order_status updates database', async () => {})
  test('update_order_status logs audit entry', async () => {})
  test('set_item_availability updates menu item', async () => {})
  test('set_item_availability handles item not found', async () => {})
  test('adjust_inventory updates quantity', async () => {})
  test('adjust_inventory prevents negative quantity', async () => {})
  test('get_tasks filters by status and type', async () => {})
  test('complete_task marks task as completed', async () => {})
  test('unknown tool returns error', async () => {})
  
  // System prompt
  test('includes active orders count in context', async () => {})
  test('includes unavailable items count', async () => {})
  test('includes low stock items count', async () => {})
  test('includes pending tasks count', async () => {})
})
```

---

### B. Integration Tests

**File:** `__tests__/api/assistant.integration.test.ts` (CREATE)

**Setup:**
```typescript
beforeAll(async () => {
  // Seed test database
  await seedTestData({
    restaurants: [testRestaurant],
    users: [testManagerUser],
    orders: [testOrder1, testOrder2],
    menuItems: [testMenuItem1, testMenuItem2],
    inventoryItems: [testInventoryItem1],
    tasks: [testTask1]
  });
});

afterAll(async () => {
  await cleanupTestData();
});
```

**Test Cases:**

```typescript
describe('POST /api/assistant/process-audio', () => {
  test('returns 401 without auth token', async () => {
    const response = await request(app)
      .post('/api/assistant/process-audio')
      .send({});
    
    expect(response.status).toBe(401);
  });
  
  test('returns 400 without audio file', async () => {
    const response = await request(app)
      .post('/api/assistant/process-audio')
      .set('Authorization', `Bearer ${validToken}`)
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('No audio file provided');
  });
  
  test('returns 400 for non-audio file', async () => {
    const response = await request(app)
      .post('/api/assistant/process-audio')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('audio', 'test.txt', Buffer.from('text'));
    
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Only audio files are accepted.');
  });
  
  test('returns 413 for file >25MB', async () => {
    const largeAudio = Buffer.alloc(26 * 1024 * 1024);
    const response = await request(app)
      .post('/api/assistant/process-audio')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('audio', 'large.webm', largeAudio);
    
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('too large');
  });
  
  test('successfully processes valid audio', async () => {
    // Mock OpenAI responses
    nock('https://api.openai.com')
      .post('/v1/audio/transcriptions')
      .reply(200, { text: 'check current orders' })
      .post('/v1/chat/completions')
      .reply(200, mockGPT4Response)
      .post('/v1/audio/speech')
      .reply(200, mockTTSAudio);
    
    const audioBlob = await fs.readFile('fixtures/test-audio.webm');
    const response = await request(app)
      .post('/api/assistant/process-audio')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('audio', 'recording.webm', audioBlob);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.transcript).toBe('check current orders');
    expect(response.body.data.response).toBeDefined();
    expect(response.body.data.actions).toBeInstanceOf(Array);
    expect(response.body.data.audioUrl).toMatch(/^\/uploads\/tts\/.+\.mp3$/);
    expect(response.body.data.processingTime).toBeGreaterThan(0);
  });
  
  test('handles OpenAI API failure gracefully', async () => {
    nock('https://api.openai.com')
      .post('/v1/audio/transcriptions')
      .reply(500, { error: 'Service unavailable' });
    
    const audioBlob = await fs.readFile('fixtures/test-audio.webm');
    const response = await request(app)
      .post('/api/assistant/process-audio')
      .set('Authorization', `Bearer ${validToken}`)
      .attach('audio', 'recording.webm', audioBlob);
    
    expect(response.status).toBe(200); // Returns 200 with error in response
    expect(response.body.data.response).toContain("I'm having trouble");
    expect(response.body.data.actions[0].status).toBe('error');
  });
});

describe('POST /api/assistant/process-text', () => {
  test('returns 401 without auth token', async () => {
    const response = await request(app)
      .post('/api/assistant/process-text')
      .send({ text: 'test' });
    
    expect(response.status).toBe(401);
  });
  
  test('returns 400 without text field', async () => {
    const response = await request(app)
      .post('/api/assistant/process-text')
      .set('Authorization', `Bearer ${validToken}`)
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Text input is required');
  });
  
  test('returns 400 for non-string text', async () => {
    const response = await request(app)
      .post('/api/assistant/process-text')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ text: 123 });
    
    expect(response.status).toBe(400);
  });
  
  test('successfully processes text command', async () => {
    nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .reply(200, mockGPT4ResponseWithTools)
      .post('/v1/audio/speech')
      .reply(200, mockTTSAudio);
    
    const response = await request(app)
      .post('/api/assistant/process-text')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ text: 'check current orders', userId: testManagerUser.id });
    
    expect(response.status).toBe(200);
    expect(response.body.data.response).toBeDefined();
    expect(response.body.data.actions.length).toBeGreaterThan(0);
    expect(response.body.data.actions[0].type).toBe('get_orders');
  });
  
  test('executes get_orders tool correctly', async () => {
    nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .reply(200, mockToolCallGetOrders);
    
    const response = await request(app)
      .post('/api/assistant/process-text')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ text: 'show me all orders', userId: testManagerUser.id });
    
    expect(response.body.data.actions[0].type).toBe('get_orders');
    expect(response.body.data.actions[0].status).toBe('success');
    expect(response.body.data.actions[0].details).toBeInstanceOf(Array);
  });
  
  test('logs audit trail for destructive actions', async () => {
    nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .reply(200, mockToolCallSetItemAvailability);
    
    await request(app)
      .post('/api/assistant/process-text')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ text: 'no more jerk chicken', userId: testManagerUser.id });
    
    const auditLog = await db.get(
      'SELECT * FROM audit_logs WHERE action = ? ORDER BY created_at DESC LIMIT 1',
      ['set_item_availability']
    );
    
    expect(auditLog).toBeDefined();
    expect(auditLog.user_id).toBe(testManagerUser.id);
    expect(auditLog.resource_type).toBe('menu_item');
  });
});

describe('GET /api/assistant/status', () => {
  test('returns service status', async () => {
    const response = await request(app)
      .get('/api/assistant/status')
      .set('Authorization', `Bearer ${validToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.data.service).toBe('online');
    expect(response.body.data.features.speechToText).toBe('available');
  });
});
```

---

### C. E2E Tests (Playwright)

**File:** `e2e/assistant.spec.ts` (CREATE)

**Setup:**
```typescript
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Mock OpenAI APIs to avoid real API calls
  await page.route('**/api.openai.com/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockOpenAIResponse)
    });
  });
  
  // Seed database
  await seedDatabase();
  
  // Login as manager
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', 'manager@demo.com');
  await page.fill('[data-testid="password-input"]', 'password');
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
});

test.afterEach(async () => {
  await cleanupDatabase();
});
```

**Test Cases:**

```typescript
test.describe('Assistant Page E2E', () => {
  
  test('01. Page loads successfully for manager role', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    // Verify page loaded
    await expect(page.locator('h1')).toContainText('AI Assistant');
    await expect(page.locator('[data-testid="assistant-avatar"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-indicator"]')).toBeVisible();
    
    // Verify message count
    await expect(page.locator('text=0 messages')).toBeVisible();
  });
  
  test('02. Staff role cannot access page', async ({ page }) => {
    // Login as staff
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'staff@demo.com');
    await page.fill('[data-testid="password-input"]', 'password');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to assistant
    await page.goto('/dashboard/assistant');
    
    // Should not see Assistant in nav or should redirect
    const assistantLink = page.locator('text=Assistant');
    await expect(assistantLink).toHaveCount(0); // Filtered from nav
  });
  
  test('03. Microphone button requests permission', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await page.goto('/dashboard/assistant');
    
    // Wait for mic initialization
    await page.waitForTimeout(1000);
    
    // Mic button should be enabled
    const micButton = page.locator('[data-testid="microphone-button"]');
    await expect(micButton).toBeEnabled();
    await expect(micButton).toContainText('Click to start');
  });
  
  test('04. Microphone button shows unavailable when denied', async ({ page, context }) => {
    await context.grantPermissions([]); // Deny microphone
    await page.goto('/dashboard/assistant');
    
    await page.waitForTimeout(1000);
    
    const micButton = page.locator('[data-testid="microphone-button"]');
    await expect(micButton).toBeDisabled();
    await expect(page.locator('text=Microphone unavailable')).toBeVisible();
  });
  
  test('05. Text command sends and receives response', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    // Type command
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('check current orders');
    await input.press('Enter');
    
    // Verify user message appears
    await expect(page.locator('text=check current orders')).toBeVisible();
    
    // Verify processing state
    await expect(page.locator('text=🧠 Thinking')).toBeVisible();
    
    // Wait for response
    await expect(page.locator('[data-testid="message-assistant"]').first()).toBeVisible({ timeout: 10000 });
    
    // Verify response contains expected text
    const response = page.locator('[data-testid="message-assistant"]').first();
    await expect(response).toBeVisible();
    
    // Verify message count updated
    await expect(page.locator('text=2 messages')).toBeVisible(); // user + assistant
  });
  
  test('06. Quick command "Check orders" works', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    const button = page.locator('[data-testid="quick-command-check-orders"]');
    await button.click();
    
    // Verify command sent
    await expect(page.locator('text=check current orders')).toBeVisible();
    await expect(page.locator('[data-testid="message-assistant"]').first()).toBeVisible({ timeout: 10000 });
  });
  
  test('07. Quick command "What\'s 86\'d?" works', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    const button = page.locator('[data-testid="quick-command-whats-86d"]');
    await button.click();
    
    await expect(page.locator('text=what items are 86\'d')).toBeVisible();
    await expect(page.locator('[data-testid="message-assistant"]').first()).toBeVisible({ timeout: 10000 });
  });
  
  test('08. Quick command "Inventory" works', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    const button = page.locator('[data-testid="quick-command-inventory"]');
    await button.click();
    
    await expect(page.locator('text=show inventory levels')).toBeVisible();
    await expect(page.locator('[data-testid="message-assistant"]').first()).toBeVisible({ timeout: 10000 });
  });
  
  test('09. Always listening toggle activates mode', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await page.goto('/dashboard/assistant');
    await page.waitForTimeout(1000);
    
    // Click always listening
    const toggle = page.locator('[data-testid="always-listening-toggle"]');
    await toggle.click();
    
    // Verify activated
    await expect(toggle).toContainText('Stop Listening');
    await expect(page.locator('text=Always On')).toBeVisible();
    await expect(page.locator('text=🎯 Always Listening activated')).toBeVisible();
    
    // Verify recording started
    await expect(page.locator('text=🎤 Listening')).toBeVisible({ timeout: 1000 });
  });
  
  test('10. Always listening auto-stops after 5 seconds', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await page.goto('/dashboard/assistant');
    await page.waitForTimeout(1000);
    
    const toggle = page.locator('[data-testid="always-listening-toggle"]');
    await toggle.click();
    
    // Wait for auto-stop
    await page.waitForTimeout(6000);
    
    // Should be processing
    await expect(page.locator('text=🧠 Thinking')).toBeVisible();
  });
  
  test('11. Always listening ignores audio without wake word', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await page.goto('/dashboard/assistant');
    await page.waitForTimeout(1000);
    
    const toggle = page.locator('[data-testid="always-listening-toggle"]');
    await toggle.click();
    
    // Mock transcription without wake word
    await page.route('**/api/assistant/process-audio', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            transcript: 'hello there',
            response: 'ignored',
            actions: []
          }
        })
      });
    });
    
    // Wait for processing
    await page.waitForTimeout(6000);
    
    // Should see ignored message
    await expect(page.locator('text=🔇 Ignored')).toBeVisible();
    await expect(page.locator('text=hello there')).toBeVisible();
  });
  
  test('12. Buttons disabled during processing', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    // Start processing by sending command
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('test command');
    await input.press('Enter');
    
    // Verify all interactive elements disabled
    await expect(input).toBeDisabled();
    await expect(page.locator('[data-testid="send-message-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="quick-command-check-orders"]')).toBeDisabled();
    await expect(page.locator('[data-testid="quick-command-whats-86d"]')).toBeDisabled();
    await expect(page.locator('[data-testid="quick-command-inventory"]')).toBeDisabled();
    await expect(page.locator('[data-testid="always-listening-toggle"]')).toBeDisabled();
  });
  
  test('13. Network error shows appropriate message', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    // Simulate network error
    await page.route('**/api/assistant/process-text', route => route.abort('failed'));
    
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('test');
    await input.press('Enter');
    
    // Should show network error
    await expect(page.locator('text=Network error')).toBeVisible();
  });
  
  test('14. Timeout error shows appropriate message', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    // Simulate timeout (delay response >60s)
    await page.route('**/api/assistant/process-text', route => {
      setTimeout(() => route.abort('timedout'), 61000);
    });
    
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('test');
    await input.press('Enter');
    
    // Should show timeout error
    await expect(page.locator('text=Request timed out')).toBeVisible({ timeout: 65000 });
  });
  
  test('15. Multiple messages appear in conversation', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    // Send 3 commands
    for (let i = 0; i < 3; i++) {
      const input = page.locator('[data-testid="chat-input"]');
      await input.fill(`command ${i + 1}`);
      await input.press('Enter');
      await page.waitForTimeout(3000); // Wait for response
    }
    
    // Should have 6 messages (3 user + 3 assistant)
    await expect(page.locator('text=6 messages')).toBeVisible();
  });
  
  test('16. Conversation auto-scrolls to bottom', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    // Send many commands to fill conversation
    for (let i = 0; i < 10; i++) {
      const input = page.locator('[data-testid="chat-input"]');
      await input.fill(`command ${i + 1}`);
      await input.press('Enter');
      await page.waitForTimeout(2000);
    }
    
    // Last message should be visible
    await expect(page.locator('[data-testid="message-assistant"]').last()).toBeInViewport();
  });
  
  test('17. TTS audio plays when provided', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    let audioPlayed = false;
    await page.exposeFunction('onAudioPlay', () => {
      audioPlayed = true;
    });
    
    await page.evaluate(() => {
      const originalPlay = HTMLAudioElement.prototype.play;
      HTMLAudioElement.prototype.play = function() {
        (window as any).onAudioPlay();
        return originalPlay.call(this);
      };
    });
    
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('test');
    await input.press('Enter');
    
    await page.waitForTimeout(3000);
    expect(audioPlayed).toBe(true);
  });
  
  test('18. Tool execution updates database', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    // Command to update order status
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('mark order order-123 as preparing');
    await input.press('Enter');
    
    await page.waitForTimeout(3000);
    
    // Verify database updated
    const order = await db.get('SELECT status FROM orders WHERE id = ?', ['order-123']);
    expect(order.status).toBe('preparing');
  });
  
  test('19. Empty text input cannot be submitted', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    const input = page.locator('[data-testid="chat-input"]');
    const sendButton = page.locator('[data-testid="send-message-button"]');
    
    await expect(sendButton).toBeDisabled();
    
    await input.fill('text');
    await expect(sendButton).toBeEnabled();
    
    await input.fill('');
    await expect(sendButton).toBeDisabled();
  });
  
  test('20. Action messages show success/error icons', async ({ page }) => {
    await page.goto('/dashboard/assistant');
    
    // Send command that triggers tool
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('check orders');
    await input.press('Enter');
    
    await page.waitForTimeout(3000);
    
    // Find action message
    const actionMessage = page.locator('[data-testid="message-action"]').first();
    await expect(actionMessage).toBeVisible();
    
    // Should have success icon
    await expect(actionMessage.locator('svg')).toBeVisible();
  });
});
```

---

### D. Data Test IDs to Add

**File:** `frontend/pages/dashboard/assistant.tsx`

```typescript
// Line 832: Status indicator
<div data-testid="status-indicator" className={`w-2 h-2 rounded-full ...`}>

// Line 858: Avatar
<RealisticAvatar
  data-testid="assistant-avatar"
  ...
/>

// Line 869: Microphone button wrapper
<div data-testid="microphone-button">
  <MicrophoneButton ... />
</div>

// Line 882: Always listening toggle
<button
  data-testid="always-listening-toggle"
  onClick={...}
  ...
>

// Line 947: Transcript feed
<TranscriptFeed
  data-testid="transcript-feed"
  messages={state.messages}
  ...
/>

// Line 956: Chat input wrapper
<div data-testid="chat-input-wrapper">
  <ChatInput data-testid="chat-input" ... />
</div>

// Line 963-983: Quick command buttons
<button
  data-testid="quick-command-check-orders"
  onClick={...}
>
  Check orders
</button>

<button
  data-testid="quick-command-whats-86d"
  onClick={...}
>
  What's 86'd?
</button>

<button
  data-testid="quick-command-inventory"
  onClick={...}
>
  Inventory
</button>
```

**File:** `frontend/components/Assistant/TranscriptFeed.tsx`

```typescript
// Add to each message div
<div data-testid={`message-${message.type}`} key={message.id}>
  ...
</div>
```

**File:** `frontend/components/Assistant/ChatInput.tsx`

```typescript
// Input field
<input data-testid="chat-input-field" ... />

// Send button
<button data-testid="send-message-button" ... />
```

---

### E. Test Fixtures

**File:** `__tests__/fixtures/assistant.fixtures.ts` (CREATE)

```typescript
export const testManagerUser = {
  id: 'user-manager-1',
  restaurant_id: 'demo-restaurant-1',
  name: 'Test Manager',
  email: 'manager@demo.com',
  role: 'manager',
  permissions: ['orders:*', 'menu:*', 'inventory:*', 'tasks:*']
};

export const testAudioBlob = new Blob(
  [new Uint8Array([/* valid webm audio data */])],
  { type: 'audio/webm;codecs=opus' }
);

export const mockWhisperResponse = {
  text: 'check current orders'
};

export const mockGPT4Response = {
  id: 'chatcmpl-123',
  object: 'chat.completion',
  created: 1234567890,
  model: 'gpt-4',
  choices: [{
    index: 0,
    message: {
      role: 'assistant',
      content: 'I found 2 active orders. Order #123 is preparing and Order #124 is received.',
      tool_calls: [{
        id: 'call_abc123',
        type: 'function',
        function: {
          name: 'get_orders',
          arguments: '{"status":"active","limit":10}'
        }
      }]
    },
    finish_reason: 'tool_calls'
  }],
  usage: {
    prompt_tokens: 150,
    completion_tokens: 50,
    total_tokens: 200
  }
};

export const mockTTSAudio = Buffer.from([/* valid mp3 data */]);

export const mockOrders = [
  {
    id: 'order-123',
    restaurant_id: 'demo-restaurant-1',
    status: 'preparing',
    customer_name: 'John Doe',
    total_amount: 25.99,
    items: JSON.stringify([{ name: 'Burger', quantity: 1 }]),
    source: 'doordash',
    created_at: new Date().toISOString()
  },
  {
    id: 'order-124',
    restaurant_id: 'demo-restaurant-1',
    status: 'received',
    customer_name: 'Jane Smith',
    total_amount: 15.50,
    items: JSON.stringify([{ name: 'Salad', quantity: 1 }]),
    source: 'ubereats',
    created_at: new Date().toISOString()
  }
];

export const mockMenuItems = [
  {
    id: 'menu-item-1',
    restaurant_id: 'demo-restaurant-1',
    name: 'Jerk Chicken',
    is_available: 1,
    price: 12.99
  }
];

export const mockInventoryItems = [
  {
    id: 'inv-item-1',
    restaurant_id: 'demo-restaurant-1',
    name: 'Chicken Breast',
    on_hand_qty: 50,
    low_stock_threshold: 10,
    unit: 'pieces'
  }
];

export const mockTasks = [
  {
    id: 'task-1',
    restaurant_id: 'demo-restaurant-1',
    title: 'Clean grill',
    status: 'pending',
    type: 'daily',
    created_at: new Date().toISOString()
  }
];
```

---

### F. Mock Strategy

**OpenAI API Mocking:**

**Library:** `nock` for integration tests, `msw` for E2E tests

**File:** `__tests__/mocks/openai.mock.ts` (CREATE)

```typescript
import nock from 'nock';

export function mockOpenAISuccess() {
  nock('https://api.openai.com')
    .post('/v1/audio/transcriptions')
    .reply(200, mockWhisperResponse);
    
  nock('https://api.openai.com')
    .post('/v1/chat/completions')
    .reply(200, mockGPT4Response);
    
  nock('https://api.openai.com')
    .post('/v1/audio/speech')
    .reply(200, mockTTSAudio, { 'Content-Type': 'audio/mpeg' });
}

export function mockOpenAIFailure(apiName: 'whisper' | 'gpt4' | 'tts') {
  const paths = {
    whisper: '/v1/audio/transcriptions',
    gpt4: '/v1/chat/completions',
    tts: '/v1/audio/speech'
  };
  
  nock('https://api.openai.com')
    .post(paths[apiName])
    .reply(500, { error: { message: 'Service temporarily unavailable' } });
}

export function mockOpenAIRateLimitExceeded() {
  nock('https://api.openai.com')
    .post('/v1/chat/completions')
    .reply(429, {
      error: {
        message: 'Rate limit exceeded',
        type: 'rate_limit_error'
      }
    });
}
```

**Browser API Mocking (Playwright):**

```typescript
// Mock MediaRecorder
await page.addInitScript(() => {
  window.MediaRecorder = class MockMediaRecorder {
    state = 'inactive';
    ondataavailable = null;
    onstop = null;
    
    start(timeslice) {
      this.state = 'recording';
      // Simulate data chunks
      setTimeout(() => {
        this.ondataavailable({ data: new Blob(['mock'], { type: 'audio/webm' }) });
      }, 100);
    }
    
    stop() {
      this.state = 'inactive';
      setTimeout(() => this.onstop(), 10);
    }
    
    static isTypeSupported(type) {
      return type.includes('webm');
    }
  };
});
```

---

## 9. SHIP GATE CHECKLIST

### Pre-Deployment Checklist

#### Code Quality
- [ ] TypeScript compiles with no errors
- [ ] ESLint passes with no errors
- [ ] No console.log statements (convert to structured logging)
- [ ] All data-testid selectors added
- [ ] All TODOs resolved or documented

#### Security
- [ ] `OPENAI_API_KEY` present in production .env
- [ ] JWT validation working on all endpoints
- [ ] Role filter prevents staff access (tested)
- [ ] No API keys in client-side code
- [ ] CORS configured for production domains
- [ ] Rate limiting added to `/api/assistant/*` endpoints
- [ ] File upload size validated (25MB max)
- [ ] Audit logs created for all destructive actions

#### Functionality
- [ ] Microphone permission flow works in Chrome, Safari, Firefox
- [ ] Text commands process successfully
- [ ] Quick command buttons work
- [ ] Always listening mode activates/deactivates
- [ ] Wake word detection works ("Servio", "Sergio")
- [ ] Conversation window (30s) expires correctly
- [ ] TTS audio plays successfully
- [ ] Avatar animates during speaking
- [ ] Error messages display correctly
- [ ] Page works in light and dark mode
- [ ] Mobile responsive (tested on iPhone/Android)

#### Data Integrity
- [ ] Tool executions update database correctly
- [ ] Audit logs capture all actions
- [ ] No duplicate recordings processed
- [ ] Conversation doesn't persist on reload (expected behavior confirmed)
- [ ] Temp files cleaned up after processing

#### Performance
- [ ] Page loads in <2s on 3G
- [ ] Audio processing completes in <5s average
- [ ] Text processing completes in <3s average
- [ ] No memory leaks after 1hr usage
- [ ] AudioContext/MediaRecorder cleaned up on unmount
- [ ] Timers/intervals cleared properly

#### OpenAI Integration
- [ ] Whisper API transcribes audio correctly
- [ ] GPT-4 generates appropriate responses
- [ ] GPT-4 calls correct tools based on intent
- [ ] TTS audio is audible and clear
- [ ] Fallback behavior works when API key missing
- [ ] Error handling for OpenAI rate limits
- [ ] Cost per request documented

#### Observability
- [ ] Frontend logs structured events
- [ ] Backend logs all API calls
- [ ] Errors logged with stack traces
- [ ] Metrics tracked (request count, duration, errors)
- [ ] Tracing enabled for OpenAI calls

#### Testing
- [ ] Unit tests pass (target: 17/17)
- [ ] Integration tests pass (target: 12/12)
- [ ] E2E tests pass (target: 20/20)
- [ ] Test coverage >80% for assistant.tsx
- [ ] Test coverage >90% for AssistantService.ts
- [ ] Load test: 10 concurrent users for 5 minutes
- [ ] No flaky tests (<1% failure rate over 100 runs)

---

### CI Commands

**Local Pre-Commit:**
```bash
# Type check
cd frontend && npm run typecheck
cd .. && npm run typecheck

# Lint
cd frontend && npm run lint
cd .. && npm run lint

# Unit tests
cd frontend && npm test -- __tests__/pages/assistant.test.tsx
cd .. && npm test -- __tests__/services/AssistantService.test.ts

# Integration tests
npm test -- __tests__/api/assistant.integration.test.ts

# Build check
cd frontend && npm run build
cd .. && npm run build
```

**CI Pipeline:**
```yaml
# .github/workflows/assistant-page.yml
name: Assistant Page QA

on:
  pull_request:
    paths:
      - 'frontend/pages/dashboard/assistant.tsx'
      - 'frontend/components/Assistant/**'
      - 'src/routes/assistant.ts'
      - 'src/services/AssistantService.ts'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd frontend && npm ci
      
      - name: Type check
        run: |
          npm run typecheck
          cd frontend && npm run typecheck
      
      - name: Lint
        run: |
          npm run lint
          cd frontend && npm run lint
      
      - name: Unit tests
        run: npm test -- --coverage --testPathPattern=assistant
      
      - name: Integration tests
        run: npm test -- --testPathPattern=assistant.integration
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_TEST_API_KEY }}
      
      - name: Build
        run: |
          npm run build
          cd frontend && npm run build
      
      - name: E2E tests
        run: npx playwright test e2e/assistant.spec.ts
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_TEST_API_KEY }}
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info,./frontend/coverage/lcov.info
      
      - name: Check coverage thresholds
        run: |
          npm run test:coverage -- --coverageThreshold='{"./src/services/AssistantService.ts":{"statements":90,"branches":85,"functions":90,"lines":90}}'
          cd frontend && npm run test:coverage -- --coverageThreshold='{"./pages/dashboard/assistant.tsx":{"statements":80,"branches":75,"functions":80,"lines":80}}'

fail-fast: false
```

**Manual QA:**
```bash
# Start services
npm run dev & 
cd frontend && npm run dev &

# Run E2E tests
npx playwright test e2e/assistant.spec.ts --headed --debug

# Load test (k6)
k6 run loadtests/assistant-load.js --vus 10 --duration 5m

# Smoke test
curl -X POST http://localhost:3002/api/assistant/status \
  -H "Authorization: Bearer ${TEST_TOKEN}"
```

---

### Coverage Thresholds

| File | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| `AssistantService.ts` | 90% | 85% | 90% | 90% |
| `assistant.tsx` | 80% | 75% | 80% | 80% |
| `assistant.ts` (routes) | 95% | 90% | 95% | 95% |
| `MicrophoneButton.tsx` | 85% | 80% | 85% | 85% |
| `ChatInput.tsx` | 90% | 85% | 90% | 90% |
| `TranscriptFeed.tsx` | 85% | 80% | 85% | 85% |
| `RealisticAvatar.tsx` | 70% | 65% | 70% | 70% |

**Rationale:**
- Core service logic (AssistantService) = highest coverage (90%)
- Route handlers (assistant.ts) = highest coverage (95%) - simpler code
- Complex UI (assistant.tsx) = moderate coverage (80%) - harder to test animations/audio
- UI components = moderate (70-90%) based on complexity

---

### Fail Criteria

**Block deployment if ANY of these fail:**

1. TypeScript compilation errors
2. ESLint errors (warnings OK)
3. Any test failure
4. Coverage below thresholds
5. E2E test fails 2+ times in a row
6. Build fails
7. Missing `OPENAI_API_KEY` in production env
8. Backend `/api/assistant/status` returns `unavailable` for any feature
9. Load test shows >5% error rate
10. Load test shows p95 latency >10s

**Manual QA Required (Cannot automate):**

1. Voice recording quality (human listen test)
2. TTS audio clarity (human listen test)
3. Avatar lip-sync accuracy (visual inspection)
4. Microphone permission flow in Safari iOS
5. Always listening works for 10+ minutes continuously
6. Wake word detection accuracy (test with 10 different speakers)

---

### Deployment Steps

```bash
# 1. Run full test suite
npm run test:all
cd frontend && npm run test:all

# 2. Build production assets
npm run build
cd frontend && npm run build

# 3. Run E2E against staging
PLAYWRIGHT_BASE_URL=https://staging.servio.com npx playwright test

# 4. Deploy backend
# (Your deployment script)

# 5. Deploy frontend
# (Your deployment script)

# 6. Smoke test production
curl https://api.servio.com/health
curl https://api.servio.com/api/assistant/status -H "Authorization: Bearer ${PROD_TOKEN}"

# 7. Monitor for 30 minutes
# - Check error logs
# - Check OpenAI API usage
# - Check user sessions
# - Verify no 500 errors

# 8. If any errors > 5%: ROLLBACK
```

---

## 10. CRITICAL ISSUES TO FIX BEFORE RELEASE

### HIGH PRIORITY (Block Release)

1. **OpenAI API Key Validation Missing**
   - **Issue:** No startup check if OPENAI_API_KEY is valid
   - **Impact:** All assistant requests will fail silently
   - **Fix:** Add validation in `AssistantService` constructor
   - **Location:** `AssistantService.ts:30-34`
   - **Code:**
   ```typescript
   constructor() {
     if (!process.env.OPENAI_API_KEY) {
       logger.error('OPENAI_API_KEY not configured - Assistant will not work');
     }
     this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
   }
   ```

2. **Uncaught Timeout Refs**
   - **Issue:** setTimeout() IDs not stored, can't be cleared
   - **Impact:** Memory leaks, timers fire after unmount
   - **Fix:** Store all timeout IDs in refs
   - **Location:** assistant.tsx lines 204, 244, 291, 405, 413, 652, 658

3. **No Permission Checks on Tool Execution**
   - **Issue:** Any authenticated user can execute ALL tools
   - **Impact:** Manager could adjust inventory without inventory:update permission
   - **Fix:** Add permission checks in `executeTool()`
   - **Location:** `AssistantService.ts:416-462`

4. **No Rate Limiting**
   - **Issue:** Expensive OpenAI API calls unprotected
   - **Impact:** Cost abuse, API quota exhaustion
   - **Fix:** Add express-rate-limit middleware
   - **Location:** `src/server.ts:72`

### MEDIUM PRIORITY (Fix Soon)

5. **Silent TTS Failure**
   - **Issue:** If TTS fails, no audioUrl returned, no user notification
   - **Impact:** User doesn't know response is incomplete
   - **Fix:** Add toast when audioUrl is empty
   - **Location:** assistant.tsx:621-623

6. **No Max Retry on Auto-Restart**
   - **Issue:** Always listening could retry infinitely
   - **Impact:** CPU/battery drain
   - **Fix:** Add max retry counter
   - **Location:** assistant.tsx:403-421

7. **Duplicate Admin Orders Page**
   - **Issue:** `admin/orders.tsx` and `admin/orders/index.tsx` conflict
   - **Status:** ✅ FIXED (deleted standalone file)

8. **Catch-All API Route**
   - **Issue:** `app.use('/api', voiceRoutes)` could intercept other routes
   - **Status:** ✅ FIXED (changed to `/api/voice`)

### LOW PRIORITY (Tech Debt)

9. **Heavy State Management**
   - **Issue:** 15+ state variables in one component
   - **Impact:** Hard to test, hard to maintain
   - **Refactor:** Extract to custom hooks: `useMediaRecorder`, `useWakeWord`, `useAudioPlayback`

10. **No Conversation Persistence**
    - **Issue:** Messages lost on reload
    - **Impact:** User loses context
    - **Enhancement:** Store last 10 messages in localStorage

---

## SUMMARY

**Release Readiness:** ⚠️ **NOT READY**

**Blocking Issues:** 4 high priority fixes required

**Test Implementation Status:**
- Unit tests: 0/29 ❌
- Integration tests: 0/12 ❌
- E2E tests: 0/20 ❌
- Test coverage: 0% ❌

**Estimated Time to Release-Ready:**
- Fix blocking issues: 4 hours
- Implement tests: 8 hours
- Manual QA: 2 hours
- **Total: 14 hours**

**Post-Release Monitoring:**
- OpenAI API usage alerts (cost threshold)
- Error rate <5% for 48 hours
- P95 latency <10s
- No critical bugs reported in first week
