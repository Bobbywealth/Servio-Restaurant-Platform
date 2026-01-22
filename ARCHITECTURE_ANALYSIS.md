# 🏗️ Servio Restaurant Platform - Architecture Analysis

**Generated:** January 21, 2026  
**Status:** ⚠️ Issues Found

---

## 📊 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT TIER                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Next.js Frontend (Port 3000)                               │
│  ├── Pages Router                                           │
│  │   ├── Public Pages                                       │
│  │   │   ├── / (Landing)                                    │
│  │   │   ├── /login                                         │
│  │   │   ├── /book-demo                                     │
│  │   │   └── /r/[...slug] (QR codes)                        │
│  │   ├── Dashboard Pages (Auth Required)                    │
│  │   │   ├── /dashboard                                     │
│  │   │   ├── /dashboard/assistant ⚠️                        │
│  │   │   ├── /dashboard/orders                              │
│  │   │   ├── /dashboard/menu-management                     │
│  │   │   ├── /dashboard/inventory                           │
│  │   │   ├── /dashboard/marketing                           │
│  │   │   ├── /dashboard/staff                               │
│  │   │   ├── /dashboard/timeclock                           │
│  │   │   ├── /dashboard/integrations                        │
│  │   │   ├── /dashboard/restaurant-profile                  │
│  │   │   └── /dashboard/settings                            │
│  │   ├── Admin Pages (Platform Admin Only)                  │
│  │   │   ├── /admin                                         │
│  │   │   ├── /admin/orders ❌ DUPLICATE                     │
│  │   │   ├── /admin/orders/index ❌ DUPLICATE               │
│  │   │   ├── /admin/orders/[id]                             │
│  │   │   ├── /admin/restaurants                             │
│  │   │   ├── /admin/audit                                   │
│  │   │   ├── /admin/campaigns                               │
│  │   │   ├── /admin/demo-bookings                           │
│  │   │   └── /admin/system-health                           │
│  │   └── Tablet/Kiosk Pages (No Auth)                       │
│  │       ├── /tablet/orders                                 │
│  │       └── /tablet/settings                               │
│  │                                                           │
│  ├── Components                                             │
│  │   ├── Layout/                                            │
│  │   │   ├── DashboardLayout.tsx (Role-based nav)          │
│  │   │   └── AdminLayout.tsx (Platform admin)              │
│  │   ├── Assistant/                                         │
│  │   │   ├── RealisticAvatar.tsx                           │
│  │   │   ├── MicrophoneButton.tsx                          │
│  │   │   ├── TranscriptFeed.tsx                            │
│  │   │   └── ChatInput.tsx                                 │
│  │   └── ui/                                                │
│  │       ├── Toast.tsx                                      │
│  │       ├── ThemeToggle.tsx                                │
│  │       ├── NotificationCenter.tsx                         │
│  │       └── AccountSwitcher.tsx                            │
│  │                                                           │
│  ├── Contexts                                               │
│  │   ├── UserContext (Auth, Permissions, Multi-account)    │
│  │   └── ThemeContext (Dark mode)                          │
│  │                                                           │
│  └── Libraries                                              │
│      ├── api.ts (Axios + JWT interceptors)                 │
│      ├── socket.ts (Socket.IO client + events)             │
│      └── WakeWordService.ts (Voice wake word)              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            ↕
                    HTTP + WebSocket
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION TIER                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Express Backend (Port 3002)                                │
│  ├── Middleware Stack                                       │
│  │   ├── helmet (Security)                                  │
│  │   ├── cors (Cross-origin)                                │
│  │   ├── compression (Gzip)                                 │
│  │   ├── morgan (Logging)                                   │
│  │   ├── requireAuth (JWT validation)                       │
│  │   └── errorHandler (Centralized errors)                 │
│  │                                                           │
│  ├── API Routes                                             │
│  │   ├── /api/auth                                          │
│  │   ├── /api/assistant (🔒 Auth) ⚠️ NEEDS OPENAI KEY      │
│  │   ├── /api/orders (🔓 /public/*, 🔒 others)             │
│  │   ├── /api/menu (🔓 /public/*, 🔒 others)               │
│  │   ├── /api/inventory (🔒 Auth)                           │
│  │   ├── /api/tasks (🔒 Auth)                               │
│  │   ├── /api/sync (🔒 Auth)                                │
│  │   ├── /api/receipts (🔒 Auth)                            │
│  │   ├── /api/audit (🔒 Auth)                               │
│  │   ├── /api/timeclock (🔒 Auth)                           │
│  │   ├── /api/marketing (🔒 Auth)                           │
│  │   ├── /api/restaurant (🔒 Auth)                          │
│  │   ├── /api/integrations (🔒 Auth)                        │
│  │   ├── /api/notifications (🔒 Auth)                       │
│  │   ├── /api/voice-hub (🔓 No auth)                        │
│  │   ├── /api/vapi (🔓 Webhook auth)                        │
│  │   ├── /api/voice/* (🔓 No auth)                          │
│  │   └── /api/admin (🔒 Platform admin only)               │
│  │                                                           │
│  ├── Services                                               │
│  │   ├── DatabaseService (SQLite + migrations)             │
│  │   ├── AssistantService (OpenAI GPT-4 + Whisper + TTS)   │
│  │   ├── VoiceOrderingService (Voice → Orders)             │
│  │   ├── VapiService (Phone ordering)                       │
│  │   ├── StorageService (File uploads)                      │
│  │   ├── SmsService (Twilio)                                │
│  │   └── JobRunnerService (Background tasks)               │
│  │                                                           │
│  └── Socket.IO Server                                       │
│      ├── Real-time order updates                            │
│      ├── Notification broadcasting                          │
│      ├── Inventory alerts                                   │
│      └── Staff clock-in/out events                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      DATA TIER                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SQLite Database (./data/servio.db)                         │
│  ├── Core Tables                                            │
│  │   ├── restaurants                                        │
│  │   ├── users (staff, manager, owner, admin)              │
│  │   ├── auth_sessions                                      │
│  │   ├── menu_categories                                    │
│  │   ├── menu_items                                         │
│  │   ├── modifier_groups                                    │
│  │   ├── modifier_options                                   │
│  │   ├── menu_item_modifiers (003)                         │
│  │   └── menu_imports (003)                                 │
│  │                                                           │
│  ├── Operations Tables                                      │
│  │   ├── orders                                             │
│  │   ├── order_items                                        │
│  │   ├── order_events (011)                                 │
│  │   ├── customers                                          │
│  │   ├── inventory_items                                    │
│  │   ├── inventory_transactions                             │
│  │   ├── receipts                                           │
│  │   ├── receipt_line_items                                 │
│  │   └── tasks                                              │
│  │                                                           │
│  ├── Staff Tables                                           │
│  │   ├── time_entries                                       │
│  │   └── sync_jobs (004)                                    │
│  │                                                           │
│  ├── Marketing Tables (002)                                 │
│  │   ├── marketing_campaigns                                │
│  │   ├── marketing_sends                                    │
│  │   ├── restaurant_themes                                  │
│  │   └── restaurant_links                                   │
│  │                                                           │
│  ├── Notifications Tables (010)                             │
│  │   ├── notifications                                      │
│  │   ├── notification_recipients                            │
│  │   └── notification_reads                                 │
│  │                                                           │
│  ├── Voice/Phone Tables (011)                               │
│  │   └── call_logs                                          │
│  │                                                           │
│  └── System Tables                                          │
│      ├── audit_logs                                         │
│      ├── sync_job_runs (008)                                │
│      └── db_migrations                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ├── OpenAI                                                 │
│  │   ├── Whisper (Speech-to-Text)                          │
│  │   ├── GPT-4 (LLM for assistant)                         │
│  │   └── TTS (Text-to-Speech)                              │
│  │                                                           │
│  ├── Vapi (Phone ordering system)                           │
│  │                                                           │
│  ├── Twilio (SMS marketing)                                 │
│  │                                                           │
│  └── Delivery Platforms                                     │
│      ├── DoorDash                                           │
│      ├── Uber Eats                                          │
│      └── GrubHub                                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow & Wiring

### Authentication Flow
```
Login Page
    ↓
POST /api/auth/login
    ↓
Backend validates credentials
    ↓
Returns: { user, accessToken, refreshToken }
    ↓
Frontend stores in localStorage
    ↓
Sets axios Authorization header
    ↓
All API calls include JWT
    ↓
Middleware validates JWT
    ↓
Attaches req.user for all endpoints
```

### Real-time Communication Flow
```
Frontend loads → Socket.IO connects to port 3002
    ↓
Socket authenticates via stored user data
    ↓
Joins rooms: user:{userId}, restaurant:{restaurantId}
    ↓
Backend events emit to appropriate rooms
    ↓
Frontend components subscribe to specific events
    ↓
UI updates in real-time (orders, notifications, etc.)
```

### Assistant Flow (Voice/Text Commands)
```
User speaks/types
    ↓
Frontend: Audio recorded → Blob
    ↓
POST /api/assistant/process-audio (with FormData)
    ↓
Backend: Whisper transcription → text
    ↓
Backend: GPT-4 processes with tools
    ↓
Backend: Executes database operations
    ↓
Backend: TTS generates response audio
    ↓
Returns: { transcript, response, actions, audioUrl }
    ↓
Frontend: Displays conversation + plays audio
```

---

## ❌ Critical Issues Found

### 1. **DUPLICATE PAGE ROUTES** (HIGH PRIORITY)
**Issue:** Two pages resolve to the same route `/admin/orders`

**Files:**
- `frontend/pages/admin/orders.tsx` (221 lines)
- `frontend/pages/admin/orders/index.tsx` (146 lines)

**Impact:** 
- Next.js routing conflict
- Unpredictable behavior (which page loads?)
- Build warnings

**Recommended Fix:**
```bash
# Delete the standalone file, keep the index version for consistency
rm frontend/pages/admin/orders.tsx
```
The `orders/index.tsx` file should remain because you also have `orders/[id].tsx` for detail pages.

---

### 2. **MISSING API KEY** (FIXED ✅)
**Issue:** `OPENAI_API_KEY` was empty in `.env`

**Status:** ✅ FIXED - API key added

---

### 3. **ROUTING AMBIGUITY** (MEDIUM PRIORITY)
**Issue:** Multiple voice-related routes mounted under `/api`:

```typescript
app.use('/api/voice-hub', voiceHubRoutes);    // No auth
app.use('/api/vapi', vapiRoutes);             // Webhook auth
app.use('/api', voiceRoutes);                 // Catch-all?!
```

**Problem:** The last line `app.use('/api', voiceRoutes)` is a catch-all that could intercept other routes!

**Risk:** If `voiceRoutes` has any endpoints that conflict with other routes, they'll never be reached.

**Recommended Fix:**
```typescript
// Make voice routes explicit
app.use('/api/voice', voiceRoutes);  // Change from /api to /api/voice
```

---

### 4. **INCONSISTENT PAGE NAMING** (LOW PRIORITY)
**Issue:** Two landing page files exist:
- `frontend/pages/index.tsx` (active)
- `frontend/pages/index_new.tsx` (unused?)

**Recommended Fix:**
```bash
# Remove unused file
rm frontend/pages/index_new.tsx
```

---

### 5. **ORPHANED ICON FILES** (LOW PRIORITY)
**Issue:** From git status, these files were deleted:
- `frontend/pages/apple-touch-icon.png.ts`
- `frontend/pages/favicon.ico.ts`

But still show in git. Need to commit the deletion.

---

### 6. **ROLE-BASED NAVIGATION COMPLEXITY**
**Observation:** Navigation is filtered by role in `DashboardLayout.tsx`, but the filtering logic is repeated in multiple places:

**Locations:**
- `allNavigation` (line 81-179)
- `allMobileNav` (line 189-196)

**Risk:** If role requirements change, must update both arrays.

**Recommended Fix:** Extract to a shared constant:
```typescript
// lib/navigation.ts
export const NAVIGATION_CONFIG = [...]
```

---

## 🎯 Component Hierarchy

### Page → Layout → Context Wiring

```
_app.tsx
  └── ThemeProvider
      └── UserProvider (Auth state)
          └── Component (Current page)
              ├── DashboardLayout (if /dashboard/*)
              │   ├── Sidebar (Desktop)
              │   ├── Header (Notifications, Theme, Account)
              │   └── Bottom Nav (Mobile)
              │
              ├── AdminLayout (if /admin/*)
              │   └── Similar structure
              │
              └── No Layout (if /, /login, /tablet/*)
```

### Assistant Page Component Tree

```
/dashboard/assistant
  └── DashboardLayout
      └── AssistantPage
          ├── State Management (15+ state variables)
          ├── Media Recorder (Audio capture)
          ├── Audio Playback (TTS with visualizer)
          ├── Wake Word Service (Optional)
          └── UI Components
              ├── RealisticAvatar (Visual feedback)
              ├── MicrophoneButton (Recording control)
              ├── TranscriptFeed (Conversation log)
              ├── ChatInput (Text commands)
              └── Always Listening Toggle
```

**Concern:** Assistant page has heavy state management (41 lines of initial state + multiple refs). Consider refactoring into custom hooks.

---

## 🔌 API Endpoint Map

### Backend Routes (Port 3002)

| Route | Auth | Purpose | Service |
|-------|------|---------|---------|
| `/api/auth/*` | ❌ | Login, logout, refresh, switch accounts | auth.ts |
| `/api/assistant/*` | ✅ | Voice/text AI commands | AssistantService |
| `/api/orders/*` | Mixed | Order management | orders.ts |
| `/api/menu/*` | Mixed | Menu items, categories | menu.ts |
| `/api/inventory/*` | ✅ | Stock tracking | inventory.ts |
| `/api/receipts/*` | ✅ | Invoice uploads | receipts.ts |
| `/api/tasks/*` | ✅ | Daily tasks | tasks.ts |
| `/api/timeclock/*` | ✅ | Staff hours | timeclock.ts |
| `/api/marketing/*` | ✅ | SMS/Email campaigns | marketing.ts |
| `/api/restaurant/*` | ✅ | Profile, branding | restaurant.ts |
| `/api/integrations/*` | ✅ | DoorDash, Uber, etc. | integrations.ts |
| `/api/notifications/*` | ✅ | Notification center | notifications.ts |
| `/api/sync/*` | ✅ | Platform sync jobs | sync.ts |
| `/api/audit/*` | ✅ | Activity logs | audit.ts |
| `/api/admin/*` | ✅ | Platform admin panel | admin.ts |
| `/api/voice-hub/*` | ❌ | Voice order webhooks | voice-hub.ts |
| `/api/vapi/*` | Webhook | Vapi phone webhooks | vapi.ts |
| `/api/*` | ❌ | ⚠️ CATCH-ALL | voice.ts |

**⚠️ WARNING:** The catch-all `/api/*` route could intercept other routes!

---

## 🗄️ Database Schema

### Core Entity Relationships

```
restaurants (1)
    │
    ├──< users (N) [staff, manager, owner, admin, platform-admin]
    │      ├──< auth_sessions (N)
    │      ├──< time_entries (N)
    │      └──< audit_logs (N)
    │
    ├──< menu_categories (N)
    │      └──< menu_items (N)
    │             ├──< modifier_groups (N)
    │             │      └──< modifier_options (N)
    │             └──< menu_item_modifiers (N)
    │
    ├──< orders (N)
    │      ├──< order_items (N)
    │      └──< order_events (N) [011]
    │
    ├──< inventory_items (N)
    │      ├──< inventory_transactions (N)
    │      └──< receipts (N)
    │             └──< receipt_line_items (N)
    │
    ├──< tasks (N)
    ├──< marketing_campaigns (N) [002]
    │      └──< marketing_sends (N)
    │
    ├──< notifications (N) [010]
    │      ├──< notification_recipients (N)
    │      └──< notification_reads (N)
    │
    ├──< call_logs (N) [011]
    └──< restaurant_themes (N) [002]
           └──< restaurant_links (N)
```

### Migration Sequence (13 files)
1. ✅ 001_enhanced_schema.sql (Core tables)
2. ✅ 002_marketing_and_profiles.sql (Marketing + themes)
3. ✅ 003_menu_enhancements.sql (Modifiers + imports)
4. ✅ 004_worker_refinements.sql (Sync jobs)
5. ✅ 005_receipts_storage.sql (Receipt enhancements)
6. ✅ 006_receipt_inventory_link.sql (Links receipts ↔ inventory)
7. ✅ 007_add_platform_admin_role.sql (Platform admin)
8. ✅ 008_schema_completion.sql (Sync job runs)
9. ✅ 009_fix_missing_columns.sql (Schema fixes)
10. ✅ 010_notifications.sql (Notification system)
11. ✅ 011_voice_ordering.sql (Voice + phone)
12. ✅ 012_add_task_type.sql (Task types)
13. ✅ 013_add_website_column.sql (Restaurant website)

**Status:** All migrations applied successfully ✅

---

## 🔐 Permission System

### Role Hierarchy
```
platform-admin (*)
    ↓
owner (full restaurant access)
    ↓
manager (most features)
    ↓
staff (limited access)
```

### Permission Format
- **Backend:** `resource:action` (e.g., `orders:read`, `orders:create`)
- **Frontend:** `resource.action` OR `resource:action` (both supported)
- **Wildcards:** `orders.*` or `orders:*` grant all actions

**Issue:** Dual format support adds complexity. Consider standardizing on one format.

---

## 🚨 Security Analysis

### ✅ Good Security Practices
1. JWT-based authentication with refresh tokens
2. Role-based access control (RBAC)
3. Middleware-enforced route protection
4. Helmet security headers
5. CORS properly configured
6. Audit logging for all actions
7. Password hashing (bcrypt)

### ⚠️ Security Concerns
1. **JWT Secret:** Using `dev_insecure_jwt_secret_change_me` (OK for dev, but must change for production)
2. **No rate limiting:** API endpoints have no rate limiting
3. **File uploads:** Receipt uploads accept any file type (potential risk)
4. **Public endpoints:** `/api/orders/public/*` and `/api/menu/public/*` have no authentication

---

## 📈 Performance Optimizations Found

### ✅ Good Practices
1. **Frontend:**
   - Dynamic imports for Toast component
   - Font optimization via Next.js
   - Lazy loading for assistant components
   - Socket.IO connection pooling
   
2. **Backend:**
   - Response compression (level 9)
   - 5-minute API response caching
   - Database connection pooling
   - Request timeout (60s)

### ⚠️ Performance Concerns
1. **No database indexing strategy visible:** Queries like `WHERE name LIKE ?` could be slow
2. **Large state objects:** Assistant page has 15+ state variables (consider reducer)
3. **Socket.IO room management:** Every user joins individual rooms (scales poorly)
4. **No pagination:** Some endpoints return unlimited results (e.g., audit logs)

---

## 🐛 Bugs & Warnings

### Active Warnings

1. **Next.js Turbopack HMR Warning:**
```
[HMR] Invalid message: {"type":"isrManifest",...}
TypeError: Cannot read properties of undefined (reading 'components')
```
**Impact:** Development experience only  
**Fix:** Likely Next.js 16.1.4 issue, wait for patch or downgrade

2. **VAPI_API_KEY Warning:**
```
VAPI_API_KEY not configured in environment variables
```
**Impact:** Phone ordering won't work  
**Fix:** Add VAPI_API_KEY to .env if phone orders needed

---

## 💡 Recommendations

### Immediate Fixes (Do Now)

1. **Delete duplicate order page:**
```bash
rm frontend/pages/admin/orders.tsx
```

2. **Fix catch-all route ambiguity:**
```typescript
// In src/server.ts, change:
app.use('/api', voiceRoutes);
// To:
app.use('/api/voice', voiceRoutes);
```

3. **Clean up unused files:**
```bash
rm frontend/pages/index_new.tsx
```

### Short-term Improvements

1. **Refactor Assistant State:**
   - Extract to custom hooks: `useMediaRecorder`, `useWakeWord`, `useAudioPlayback`
   - Use `useReducer` instead of multiple `useState` calls

2. **Add Database Indexes:**
```sql
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX idx_menu_items_restaurant_available ON menu_items(restaurant_id, is_available);
CREATE INDEX idx_inventory_restaurant_lowstock ON inventory_items(restaurant_id, on_hand_qty);
```

3. **Standardize Permission Format:**
   - Choose one: `resource:action` (recommended)
   - Update frontend to match backend

4. **Add Rate Limiting:**
```typescript
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);
```

### Long-term Enhancements

1. **Migrate to PostgreSQL** (when scaling beyond single location)
2. **Add Redis for caching** (replace in-memory Map)
3. **Implement queue system** (Bull/BullMQ for background jobs)
4. **Add API documentation** (Swagger/OpenAPI)
5. **Split services into microservices** (if multi-tenant)

---

## ✅ What's Working Well

1. **Clean separation of concerns:** Routes → Services → Database
2. **Comprehensive audit logging:** Every action tracked
3. **Real-time updates:** Socket.IO properly integrated
4. **Multi-account support:** Platform admin can switch between restaurants
5. **Mobile-responsive:** Tablet mode + mobile bottom nav
6. **Theme support:** Dark mode throughout
7. **Progressive Web App:** Manifest + service worker ready
8. **Type safety:** TypeScript throughout (frontend + backend)

---

## 📝 Summary

**Overall Architecture: 8/10**

**Strengths:**
- Well-organized monorepo structure
- Proper authentication/authorization
- Real-time capabilities
- Comprehensive feature set

**Critical Issues:**
1. ❌ Duplicate admin/orders page
2. ⚠️ Catch-all API route ambiguity
3. ⚠️ Missing database indexes for queries

**Action Items:**
1. Delete `frontend/pages/admin/orders.tsx`
2. Fix `/api` catch-all route
3. Add database indexes
4. Consider refactoring assistant state management

---

## 🔍 Testing Checklist

- [ ] Test assistant after OpenAI key added
- [ ] Verify admin orders page works after duplicate removed
- [ ] Test all voice routes still work after catch-all fix
- [ ] Load test order queries with 1000+ orders
- [ ] Verify socket rooms clean up on disconnect
- [ ] Test account switching functionality
- [ ] Verify all role-based permissions
- [ ] Test file upload limits (25MB)

---

**Need Help?** Run backend logs: `npm run dev` in root directory
