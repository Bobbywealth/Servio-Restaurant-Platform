# Servio – Full Hierarchy & “Finalize All Pages” Master Checklist

This document is the **single source of truth** for finishing **all pages** across:
- **UI completeness** (loading + empty + error + retry + disabled states)
- **API wiring completeness** (real endpoints, correct paths, correct payloads)
- **Role/permission completeness** (frontend guards match backend authorization)

It reflects the current codebase as of the DI + caching refactor.

---

## 0) Repo-wide hierarchy (product code)

### Frontend
- `frontend/pages/*` (Next routes)
- `frontend/components/*` (UI + layouts)
- `frontend/contexts/*` (user/session/theme/tour state)
- `frontend/lib/*` (API client, socket, utils)
- `frontend/styles/*`, `frontend/public/*`

### Backend
- `backend/src/server.ts` (Express + middleware wiring)
- `backend/src/routes/*` (API surface)
- `backend/src/services/*` (domain + infra services)
- `backend/src/repositories/*` (data access layer)
- `backend/src/middleware/*` (auth, security, rate limit, errors, container)
- `backend/src/notifications/*`, `backend/src/events/*`
- `backend/src/database/migrations/*`

---

## 1) Global “blockers” to fix first (affects *every page*)

### A) Permission string mismatch (Frontend vs Backend)
- **Backend** uses: `requirePermission('orders:read')` style (colon).
- **Frontend** currently checks: `hasPermission(resource, action)` → builds `resource.action` (dot), e.g. `orders.read`.

**Impact**: role/permission completeness cannot be guaranteed until one scheme is adopted.

**Action** (choose one and apply everywhere):
- Option 1: Update frontend permission checks to use `resource:action` (recommended, matches backend).
- Option 2: Update backend `requirePermission` to accept `resource.action` too (less strict but compatible).

### B) Admin UI guard is missing
`frontend/components/Layout/AdminLayout.tsx` does **not** redirect non-`platform-admin` users.

**Impact**: UI can show admin pages to unauthorized roles (backend will still block API calls).

**Action**:
- Add a guard in AdminLayout: if no user or `user.role !== 'platform-admin'` → redirect to `/dashboard` or `/login`.

### C) API base path consistency (`/api/*`)
Most pages call `api.get('/api/...')`, but **Integrations page** uses `/integrations` (missing `/api` prefix).

**Action**:
- Standardize all calls to `/api/...` to go through the same gateway and auth interceptors.

---

## 2) Frontend pages → API wiring map (what each page calls)

### Public
- **`/login`** (`frontend/pages/login.tsx`)
  - Calls: `/api/auth/login`, `/api/auth/signup`, `/api/auth/me`, `/api/auth/refresh`, `/api/auth/logout` (via UserContext)
  - UI completeness: ensure clear inline validation errors + server error toast + disabled submit while loading

- **`/book-demo`** (`frontend/pages/book-demo.tsx`)
  - Calls: `POST /api/bookings`
  - UI completeness: success state + validation + failure retry

- **`/r/[...slug]`** (`frontend/pages/r/[...slug].tsx`)
  - Calls: `GET /api/menu/public/:slug`, `POST /api/orders/public/:slug`
  - UI completeness: menu loading skeleton, empty menu state, order submission pending/success/failure

### Dashboard
- **`/dashboard`** (`frontend/pages/dashboard/index.tsx`)
  - Calls: `GET /api/orders?limit=5`, `GET /api/orders/stats/summary`, `GET /api/tasks/stats`
  - UI completeness: has skeleton; needs explicit empty states when zero orders/tasks; error toast + retry button

- **`/dashboard/orders`** (`frontend/pages/dashboard/orders.tsx`)
  - Calls: `GET /api/orders`, `GET /api/orders/stats/summary`, `POST /api/orders/:id/status`
  - Backend permissions: `orders:read` for GETs, `orders:write` for status updates
  - UI completeness: empty orders state, status update optimistic UI + rollback on error

- **`/dashboard/inventory`** (`frontend/pages/dashboard/inventory.tsx`)
  - Calls: `GET /api/inventory/search`
  - UI completeness: empty state (no items), error state (network), pagination/search debounce

- **`/dashboard/inventory/receipts`** (`frontend/pages/dashboard/inventory/receipts.tsx`)
  - Likely calls receipts endpoints (confirm by reading file during implementation pass)
  - Backend: `/api/receipts/*` is `requireAuth`
  - UI completeness: upload progress, failure recovery, empty state

- **`/dashboard/menu-management`** (`frontend/pages/dashboard/menu-management.tsx`)
  - Calls: `GET /api/menu/categories/all`, `GET /api/menu/items/full`, `POST /api/menu/categories`, `POST /api/menu/items`
  - UI completeness: empty categories/items state, upload progress/errors for images, optimistic updates

- **`/dashboard/staff`** (`frontend/pages/dashboard/staff.tsx`)
  - Calls: `GET /api/restaurant/staff`, `GET /api/timeclock/current-staff`, `GET /api/timeclock/stats`
  - UI completeness: empty staff list state, error state + retry

- **`/dashboard/timeclock`** (`frontend/pages/dashboard/timeclock.tsx`)
  - Calls: `GET /api/timeclock/current-staff`, `GET /api/timeclock/entries`, `GET /api/timeclock/stats`
  - Calls: `POST /api/timeclock/clock-in`, `POST /api/timeclock/clock-out`, `POST /api/timeclock/break-start|break-end`
  - UI completeness: invalid PIN state, “already clocked in” state, optimistic UI with rollback

- **`/dashboard/settings`** (`frontend/pages/dashboard/settings.tsx`)
  - Calls: `GET/PUT/POST /api/restaurants/:restaurantId/vapi/*`
  - Backend: route enforces same-restaurant OR `platform-admin`
  - UI completeness: secrets masked, test connection results, clear failure messaging

- **`/dashboard/assistant`** (`frontend/pages/dashboard/assistant.tsx`)
  - Calls: `POST /api/assistant/process-audio`, `POST /api/assistant/process-text`
  - UI completeness: microphone permission denied state, offline state, stream/transcript errors

- **`/dashboard/assistant-monitoring`** (`frontend/pages/dashboard/assistant-monitoring.tsx`)
  - Calls: `GET /api/assistant-monitoring/dashboard-data`, `POST /api/assistant-monitoring/reset`
  - UI completeness: empty metrics state, confirm modal for reset, error + retry

- **`/dashboard/integrations`** (`frontend/pages/dashboard/integrations.tsx`)
  - Calls: currently `GET /integrations`, `POST /integrations/:id/toggle` (**missing `/api` prefix**)
  - **Fix required**: should be `/api/integrations` routes

- **`/dashboard/marketing`** (`frontend/pages/dashboard/marketing.tsx`)
  - Has a TODO noted: “Implement campaign view modal”
  - Requires full pass to map endpoints used in file

- **`/dashboard/restaurant-profile`** (`frontend/pages/dashboard/restaurant-profile.tsx`)
  - Requires full pass to map endpoints used in file

### Admin (Platform Admin)
- **`/admin`** (`frontend/pages/admin/index.tsx`)
  - Calls: `GET /api/admin/stats/summary`, `GET /api/admin/activity`, `GET /api/admin/campaigns?...`
  - Backend: all `/api/admin/*` requires `platform-admin`
  - UI completeness: empty system state + loading skeleton + retry

- **`/admin/restaurants`** (`frontend/pages/admin/restaurants/index.tsx`)
  - Calls: `GET /api/admin/restaurants`

- **`/admin/restaurants/:id`** (`frontend/pages/admin/restaurants/[id].tsx`)
  - Calls: `GET /api/admin/restaurants/:id`
  - Calls: `GET/PUT/POST /api/restaurants/:restaurantId/vapi/*`

- **`/admin/orders`** (`frontend/pages/admin/orders.tsx`, `frontend/pages/admin/orders/index.tsx`)
  - Calls: `GET /api/orders`
  - Backend permissions: `orders:read` required (and auth)

- **`/admin/orders/:id`** (`frontend/pages/admin/orders/[id].tsx`)
  - Calls: `GET /api/orders/:id`
  - Calls: `POST /api/orders/:id/accept` (**likely incorrect**)
    - Backend currently has accept endpoint under **`/api/voice/orders/:id/accept`** (not `/api/orders/:id/accept`)
  - **Fix required**: align this page with actual backend endpoint

- **`/admin/demo-bookings`** (`frontend/pages/admin/demo-bookings.tsx`)
  - Calls: `GET /api/admin/demo-bookings`

- **`/admin/campaigns`** (`frontend/pages/admin/campaigns.tsx`)
  - Calls: `GET /api/admin/campaigns?...`

- **`/admin/audit`** (`frontend/pages/admin/audit.tsx`)
  - Calls: `GET /api/admin/activity?limit=200`

- **`/admin/system-health`** (`frontend/pages/admin/system-health.tsx`)
  - Calls: `GET /api/admin/system/health`, `GET /api/admin/jobs?...`

---

## 3) Backend authorization map (what’s enforced server-side)

### Explicit permission-checked routes
Orders (`backend/src/routes/orders.ts`):
- `GET /api/orders*` → `orders:read`
- `POST /api/orders/:id/status` and `POST /api/orders` → `orders:write`

### Platform-admin only
Admin (`backend/src/routes/admin.ts`):
- All `/api/admin/*` require `platform-admin` (`requirePlatformAdmin`)

### Role checks inside handler
Restaurant settings (`backend/src/routes/restaurant-settings.ts`):
- Allows if `req.user.restaurantId === :restaurantId` OR role is `platform-admin`

### RequireAuth only (no fine-grained permission in route file)
Most other route modules rely on `server.ts` mounting them behind `requireAuth`.

**Action**: If we want full “role/permission completeness”, decide whether to:
- Add `requirePermission()` checks to routes like inventory/menu/marketing/timeclock/etc, **or**
- Keep role gating only in the frontend + rely on auth-only server gates.

---

## 4) Per-page finalization checklist (apply to *every* page)

For each page listed in Section 2:
- **UI**
  - Loading skeleton/spinner (first load + refetch)
  - Empty state (no records)
  - Error state (network/server) with “Retry”
  - Disabled state for buttons during mutations
  - Success feedback (toast/banner) on writes
- **API**
  - Correct path (`/api/...`)
  - Correct params/payload shape
  - Handles 401/403 (redirect or message)
  - Handles 404 (resource not found) gracefully
- **Auth**
  - Frontend guard matches backend (role + permission scheme)
  - Navigation hides restricted pages and prevents deep-link access

---

## 5) “Finalize all pages” execution order (fastest path)

1) Fix global blockers (Section 1)
2) Fix the two known API wiring issues:
   - Dashboard Integrations page `/integrations` → `/api/integrations`
   - Admin order accept endpoint mismatch (`/api/orders/:id/accept` vs `/api/voice/orders/:id/accept`)
3) Run page-by-page UI polish starting with:
   - `/dashboard`, `/dashboard/orders`, `/dashboard/menu-management`, `/dashboard/inventory`, `/dashboard/timeclock`
4) Then finish admin suite with strict guard and consistent error UX.

