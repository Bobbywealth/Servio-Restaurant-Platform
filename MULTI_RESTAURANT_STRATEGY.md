# Multi-Restaurant Browser Automation Strategy

## The Challenge

When you have multiple restaurants, each with their own DoorDash/UberEats accounts, repeatedly logging in/out from the same server IP can:

❌ Trigger security flags
❌ Get your IP rate-limited or blocked
❌ Increase captcha frequency
❌ Look like credential stuffing
❌ Be slow (fresh login each time)

---

## Solution 1: Session Persistence ⭐ RECOMMENDED

### How It Works

1. **First sync**: Browser logs in manually (with user watching)
2. **Save session**: Store cookies and local storage per restaurant
3. **Future syncs**: Reuse session (no login needed!)
4. **Session expires**: User logs in again manually

### Benefits

✅ **No repeated logins** - Reuses existing session
✅ **Faster syncing** - Skip login step
✅ **Less suspicious** - Normal user behavior
✅ **Captcha once** - User solves it manually first time
✅ **Separate sessions** - Each restaurant has own cookies

### Implementation

```typescript
// Save session after manual login
const context = await browser.newContext();
// ... do login manually ...
await context.storageState({
  path: `sessions/restaurant-${restaurantId}-${platform}.json`
});

// Later, reuse session
const context = await browser.newContext({
  storageState: `sessions/restaurant-${restaurantId}-${platform}.json`
});
// Already logged in! No need to login again.
```

### File Structure

```
sessions/
  restaurant-abc123-doordash.json     # Restaurant A's DoorDash session
  restaurant-abc123-ubereats.json     # Restaurant A's UberEats session
  restaurant-xyz456-doordash.json     # Restaurant B's DoorDash session
  restaurant-xyz456-ubereats.json     # Restaurant B's UberEats session
```

---

## Solution 2: Browser Profiles

### How It Works

Each restaurant gets a persistent browser profile (like Chrome user profiles).

### Benefits

✅ Separate cookies, cache, history per restaurant
✅ More realistic browser fingerprint
✅ Persistent login state

### Cons

❌ Uses more disk space
❌ More complex to manage

---

## Solution 3: Proxy Rotation

### How It Works

Each restaurant uses a different proxy/IP address.

### Benefits

✅ Looks like different users from different locations
✅ No IP rate limiting issues
✅ Can use residential proxies

### Cons

❌ Costs money (proxy services)
❌ Slower (proxy overhead)
❌ Complex setup

---

## Solution 4: Scheduled Sequential Syncs

### How It Works

Don't sync all restaurants at once. Space them out:
- Restaurant A: 9:00 AM
- Restaurant B: 9:30 AM
- Restaurant C: 10:00 AM

### Benefits

✅ Less suspicious (not bulk automation)
✅ Spreads load
✅ Easier to debug

### Cons

❌ Not real-time
❌ Still same IP

---

## Solution 5: Concurrent Browser Instances

### How It Works

Run multiple browser instances in parallel, each with separate context.

```typescript
const contexts = await Promise.all([
  browser.newContext({ /* Restaurant A */ }),
  browser.newContext({ /* Restaurant B */ }),
  browser.newContext({ /* Restaurant C */ })
]);
```

### Benefits

✅ Separate cookies per restaurant
✅ Faster (parallel execution)

### Cons

❌ High memory usage
❌ Still same IP
❌ Can be detected

---

## Recommended Approach: Hybrid Strategy

### For Small Operations (1-10 restaurants)

**Use: Session Persistence + Scheduled Syncs**

1. Each restaurant logs in once manually
2. Save session cookies
3. Reuse sessions for automated syncs
4. Space out syncs (don't sync all at once)
5. Sessions expire → user logs in again

### For Medium Operations (10-50 restaurants)

**Use: Session Persistence + Browser Profiles + Scheduling**

1. Each restaurant has persistent browser profile
2. Initial manual login
3. Automated syncs reuse profiles
4. Stagger syncs throughout the day
5. Monitor for session expiration

### For Large Operations (50+ restaurants)

**Use: Official APIs**

Don't use browser automation at scale. Contact platforms for:
- API access
- Partnership agreements
- Automation-friendly accounts

---

## Implementation: Session Persistence

### Step 1: Create Session Directory

```bash
mkdir -p /home/user/Servio-Restaurant-Platform/data/sessions
chmod 700 /home/user/Servio-Restaurant-Platform/data/sessions
```

### Step 2: Enhanced Service with Session Management

See: `BrowserAutomationService.sessions.ts`

### Step 3: Manual First Login

```typescript
// New endpoint: /api/delivery-platforms/init-session
// Opens browser in headed mode for user to login
// Saves session cookies automatically
```

### Step 4: Automated Syncs Use Session

```typescript
// Syncs now check for existing session first
// If session exists → reuse it (fast, no login)
// If no session → require manual init
```

---

## Session Management Best Practices

### 1. Session Expiration

Sessions typically expire after:
- **DoorDash**: 7-30 days
- **UberEats**: 14-30 days

When expired:
- Detect failed auth
- Notify user to re-login
- Clear old session file

### 2. Security

```bash
# Restrict session file permissions
chmod 600 sessions/*.json

# Encrypt session files at rest
# (sessions contain authentication cookies)
```

### 3. Session Validation

Before each sync:
1. Check if session file exists
2. Check if session is recent (< 30 days old)
3. Try a simple API call to validate
4. If invalid → require manual login

### 4. Concurrent Access

```typescript
// Use file locking for sessions
// Prevent multiple syncs using same session simultaneously
```

---

## Real-World Scenarios

### Scenario 1: 3 Restaurants, Daily Sync

**Setup:**
- Each restaurant logs in once (manual, HEADLESS=false)
- Sessions saved to disk
- Cron job runs daily at 3 AM

**Behavior:**
```
3:00 AM - Restaurant A sync (reuses session, no login)
3:05 AM - Restaurant B sync (reuses session, no login)
3:10 AM - Restaurant C sync (reuses session, no login)
```

**Result:** Fast, reliable, no repeated logins!

### Scenario 2: 20 Restaurants, Multiple Times Daily

**Setup:**
- Session persistence enabled
- Staggered sync schedule
- Health checks for session validity

**Schedule:**
```
9:00 AM - Restaurants 1-5   (breakfast stock update)
11:00 AM - Restaurants 6-10  (lunch prep)
2:00 PM - Restaurants 11-15 (lunch cleanup)
5:00 PM - Restaurants 16-20 (dinner prep)
```

**Result:** Distributed load, looks natural, reliable

### Scenario 3: Emergency Stock Update

**User Action:**
- "We ran out of salmon!"
- Clicks "Sync to All Platforms" button

**Behavior:**
- Uses existing sessions (instant sync)
- Updates all platforms in < 10 seconds
- No login needed

---

## IP Address Considerations

### Current Setup (Same IP)

All restaurants sync from your server's IP.

**Mitigation strategies:**
1. **Use session persistence** (less frequent auth)
2. **Stagger syncs** (don't bulk auth)
3. **Rate limit** (max 1 sync per minute per platform)
4. **Low frequency** (2-3 times per day max)

### Advanced Setup (Multiple IPs)

If you have many restaurants:

**Option A: Residential Proxy**
```typescript
const context = await browser.newContext({
  proxy: {
    server: 'http://proxy.example.com:8080',
    username: 'user',
    password: 'pass'
  },
  storageState: sessionFile
});
```

**Option B: VPN per Restaurant**
- Each restaurant assigned to specific VPN endpoint
- Rotate connections
- More expensive but most realistic

---

## Detection Risks by Scale

### Low Risk (1-5 restaurants)
- ✅ Session persistence
- ✅ Daily syncs
- ✅ Staggered timing
- ✅ Same IP OK

### Medium Risk (5-20 restaurants)
- ⚠️ Session persistence required
- ⚠️ Careful scheduling needed
- ⚠️ Same IP might trigger flags
- ⚠️ Consider proxy for some

### High Risk (20+ restaurants)
- ❌ Browser automation fragile
- ❌ Get official API access
- ❌ Or use proxy rotation
- ❌ Or use manual assisted mode

---

## Monitoring & Alerts

### What to Monitor

```typescript
// Track these metrics
{
  restaurantId: 'abc123',
  platform: 'doordash',
  lastSyncSuccess: '2026-01-26T10:00:00Z',
  sessionCreatedAt: '2026-01-20T09:00:00Z',
  sessionAge: 6, // days
  syncFailureCount: 0,
  lastError: null,
  captchaDetected: false
}
```

### Alert Conditions

- ⚠️ Session age > 25 days → "Session expiring soon"
- ⚠️ Sync failure 3x in row → "Check credentials"
- ⚠️ Captcha detected → "Manual login required"
- ⚠️ Multiple restaurants failing → "IP might be blocked"

---

## Implementation Roadmap

### Phase 1: Basic Session Persistence
1. Add session directory
2. Save/load session cookies
3. Manual init-session endpoint
4. Reuse sessions in sync

### Phase 2: Session Management
1. Session expiration detection
2. Auto-cleanup old sessions
3. Health check before sync
4. User notifications

### Phase 3: Advanced Features
1. Browser profiles per restaurant
2. Proxy rotation (optional)
3. Scheduled sync with staggering
4. Session refresh logic

---

## Quick Start: Session Persistence

### 1. Create Session Directory
```bash
mkdir -p data/sessions
chmod 700 data/sessions
```

### 2. Initialize Session (Manual Login)
```bash
# User logs in manually, session is saved
POST /api/delivery-platforms/init-session
{
  "restaurantId": "abc123",
  "platform": "doordash",
  "username": "restaurant@example.com",
  "password": "password"
}
```

### 3. Automated Syncs Reuse Session
```bash
# No login needed - reuses saved session!
POST /api/delivery-platforms/sync/doordash
{
  "syncType": "stock_update"
}
```

### 4. Session Expires
```bash
# User logs in again manually
POST /api/delivery-platforms/init-session
{
  "restaurantId": "abc123",
  "platform": "doordash"
}
```

---

## Summary

### ✅ DO THIS (Best Practice)

1. **Session Persistence**: Login once, reuse many times
2. **Stagger Syncs**: Don't sync all restaurants at once
3. **Low Frequency**: 2-3 syncs per day maximum
4. **Monitor Sessions**: Track expiration, failures
5. **Manual First Login**: User solves captcha once

### ❌ DON'T DO THIS

1. **Fresh Login Every Time**: Too suspicious
2. **Bulk Syncs**: All restaurants at once from same IP
3. **High Frequency**: Every hour automated syncs
4. **Ignore Session Expiry**: Will fail without warning
5. **No Monitoring**: Won't know when it breaks

---

## Next Steps

1. Implement session persistence (see next file)
2. Add init-session endpoint
3. Update sync methods to check for sessions
4. Add session health monitoring
5. Test with 2-3 restaurants first

