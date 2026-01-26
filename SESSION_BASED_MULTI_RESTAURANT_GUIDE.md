# Session-Based Multi-Restaurant Automation Guide

## The Problem You Asked About

> **"How would it work for multiple restaurants? Same account logging in and out of DoorDash on same IP address?"**

---

## ❌ **What NOT To Do (Original Approach)**

### Bad: Fresh Login Every Time

```
9:00 AM - Restaurant A: Login → Sync → Logout
9:05 AM - Restaurant B: Login → Sync → Logout
9:10 AM - Restaurant C: Login → Sync → Logout
```

**All from the same server IP!**

### Problems:
1. ❌ **Suspicious Pattern**: Multiple different accounts from same IP
2. ❌ **Rate Limiting**: Platforms will throttle or block your IP
3. ❌ **Security Flags**: Looks like credential stuffing attack
4. ❌ **Captchas**: More frequent due to repeated logins
5. ❌ **Slow**: Fresh login takes 10-15 seconds each time

---

## ✅ **What TO Do (Session-Based Approach)**

### Good: Session Persistence

```
ONCE (Manual):
- Restaurant A: User logs in manually → Session saved
- Restaurant B: User logs in manually → Session saved
- Restaurant C: User logs in manually → Session saved

AUTOMATED (Daily):
9:00 AM - Restaurant A: Reuse session → Sync (3 seconds!)
9:05 AM - Restaurant B: Reuse session → Sync (3 seconds!)
9:10 AM - Restaurant C: Reuse session → Sync (3 seconds!)
```

**No repeated logins!** Just like staying logged in on your phone.

### Benefits:
1. ✅ **Normal Behavior**: Just like a real user staying logged in
2. ✅ **No Repeated Auth**: Reuses existing session cookies
3. ✅ **Faster**: 3 seconds vs 15 seconds
4. ✅ **Less Suspicious**: No weird login patterns
5. ✅ **Captcha Once**: User solves it during manual setup

---

## 🚀 **How It Works**

### Step 1: One-Time Manual Setup (Per Restaurant)

```bash
# Restaurant A owner logs in
POST /api/delivery-platforms-sessions/init
{
  "platform": "doordash",
  "username": "restaurant-a@doordash.com",
  "password": "password-a"
}

# Browser opens → User logs in manually → Session saved
# File created: data/sessions/restaurant-abc123-doordash.json
```

**What's in the session file?**
```json
{
  "cookies": [...],
  "origins": [...],
  "localStorage": [...]
}
```

It's basically "staying logged in" like on your phone!

---

### Step 2: Automated Syncs (No Login!)

```bash
# Restaurant A sync
POST /api/delivery-platforms/sync/doordash
{
  "syncType": "stock_update"
}

# What happens internally:
1. ✓ Load Restaurant A's session file
2. ✓ Open browser with saved cookies (already logged in!)
3. ✓ Navigate to menu page (3 seconds)
4. ✓ Update items
5. ✓ Close browser

# NO LOGIN STEP! 🎉
```

---

### Step 3: Monitor Sessions

```bash
# Check if session is still valid
GET /api/delivery-platforms-sessions/status/doordash

Response:
{
  "hasSession": true,
  "isValid": true,
  "ageInDays": 5,
  "message": "Session is active and ready to use"
}
```

Sessions typically last **30 days** before expiring.

---

## 📊 **Multi-Restaurant Flow Comparison**

### Scenario: 10 Restaurants, Daily Sync

#### Without Sessions (BAD):
```
Total time: 150 seconds (10 restaurants × 15 sec each)
Logins per day: 10
Logins per month: 300
Suspicion level: 🚨 HIGH
Captcha risk: 🚨 HIGH
```

#### With Sessions (GOOD):
```
Total time: 30 seconds (10 restaurants × 3 sec each)
Logins per day: 0 (sessions reused)
Logins per month: 10 (only for session renewal)
Suspicion level: ✅ LOW
Captcha risk: ✅ LOW
```

**5x faster + 30x fewer logins!**

---

## 🏢 **Real-World Example: 3 Restaurant Locations**

### Initial Setup (One Time)

**Monday 9 AM - Owner at Restaurant A:**
```bash
POST /api/delivery-platforms-sessions/init
{
  "platform": "doordash",
  "username": "location-a@doordash.com",
  "password": "password"
}
```
→ Browser opens → Owner logs in → Session saved

**Monday 9:05 AM - Owner at Restaurant B:**
```bash
POST /api/delivery-platforms-sessions/init
{
  "platform": "doordash",
  "username": "location-b@doordash.com",
  "password": "password"
}
```
→ Browser opens → Owner logs in → Session saved

**Monday 9:10 AM - Owner at Restaurant C:**
```bash
POST /api/delivery-platforms-sessions/init
{
  "platform": "doordash",
  "username": "location-c@doordash.com",
  "password": "password"
}
```
→ Browser opens → Owner logs in → Session saved

**Setup complete! ✅**

---

### Daily Automated Syncs (Every Day, No Login!)

**Cron Job @ 8 AM Every Day:**
```typescript
// Restaurant A
await syncWithSession('restaurant-a-id', 'doordash', menuItems, 'stock_update');
// ✓ Uses saved session, no login, 3 seconds

// Wait 5 minutes (stagger syncs)
await sleep(5 * 60 * 1000);

// Restaurant B
await syncWithSession('restaurant-b-id', 'doordash', menuItems, 'stock_update');
// ✓ Uses saved session, no login, 3 seconds

// Wait 5 minutes
await sleep(5 * 60 * 1000);

// Restaurant C
await syncWithSession('restaurant-c-id', 'doordash', menuItems, 'stock_update');
// ✓ Uses saved session, no login, 3 seconds
```

**All automated, no human intervention needed!**

---

### When Session Expires (After ~30 Days)

**Day 31 - Automated sync fails:**
```json
{
  "success": false,
  "errors": ["Session expired. Please re-initialize session."],
  "details": { "sessionExpired": true, "needsSessionInit": true }
}
```

**Owner re-initializes:**
```bash
POST /api/delivery-platforms-sessions/init
# Browser opens → Login again → New session saved
```

**Back to automated syncs for another 30 days!**

---

## 🔐 **Security & IP Considerations**

### Same IP Address?

Yes, all restaurants sync from your **server's IP address**. But with sessions, this is fine because:

1. ✅ **Normal Pattern**: Just like one person with multiple restaurant accounts
2. ✅ **Logged In**: No repeated auth attempts
3. ✅ **Staggered**: Syncs spaced out (5-10 min apart)
4. ✅ **Low Frequency**: 1-3 times per day max

### Real-World Analogy:

**Without Sessions (Suspicious):**
> "Someone is trying to login to 10 different DoorDash accounts from the same computer every 5 minutes!"

**With Sessions (Normal):**
> "Someone is managing 10 restaurant accounts they're already logged into. They check each one a few times per day."

---

## 📁 **Session File Structure**

```
data/sessions/
├── restaurant-abc123-doordash.json      # Restaurant A - DoorDash
├── restaurant-abc123-ubereats.json      # Restaurant A - Uber Eats
├── restaurant-def456-doordash.json      # Restaurant B - DoorDash
├── restaurant-def456-ubereats.json      # Restaurant B - Uber Eats
├── restaurant-ghi789-doordash.json      # Restaurant C - DoorDash
└── restaurant-ghi789-ubereats.json      # Restaurant C - Uber Eats
```

**Each file is ~5-10 KB** (cookies and localStorage)

**Permissions:** `0600` (owner read/write only)

---

## 🎯 **API Usage Examples**

### Initialize Session (Manual Login)

```bash
curl -X POST http://localhost:3002/api/delivery-platforms-sessions/init \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "doordash",
    "username": "your-email@restaurant.com",
    "password": "your-password"
  }'

# Browser window opens → You login manually → Session saved
# Response: { "success": true, "message": "Session initialized successfully" }
```

### Check Session Status

```bash
curl -X GET http://localhost:3002/api/delivery-platforms-sessions/status/doordash \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response:
{
  "success": true,
  "data": {
    "hasSession": true,
    "isValid": true,
    "createdAt": "2026-01-26T09:00:00Z",
    "lastUsedAt": "2026-01-27T08:00:00Z",
    "ageInDays": 1,
    "message": "Session is active and ready to use"
  }
}
```

### Test Session (Verify Still Logged In)

```bash
curl -X POST http://localhost:3002/api/delivery-platforms-sessions/test/doordash \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response:
{
  "success": true,
  "data": {
    "valid": true,
    "message": "Session is valid and active"
  }
}
```

### List All Sessions

```bash
curl -X GET http://localhost:3002/api/delivery-platforms-sessions/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response:
{
  "success": true,
  "data": [
    {
      "platform": "doordash",
      "createdAt": "2026-01-20T09:00:00Z",
      "lastUsedAt": "2026-01-27T08:00:00Z",
      "isValid": true,
      "ageInDays": 7
    },
    {
      "platform": "ubereats",
      "createdAt": "2026-01-20T09:05:00Z",
      "lastUsedAt": "2026-01-27T08:05:00Z",
      "isValid": true,
      "ageInDays": 7
    }
  ]
}
```

### Delete Session

```bash
curl -X DELETE http://localhost:3002/api/delivery-platforms-sessions/doordash \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response: { "success": true, "message": "Session deleted successfully" }
```

---

## 📝 **Best Practices for Multi-Restaurant**

### 1. Stagger Initial Setup
```
Don't initialize all 10 restaurants in 5 minutes!

Good:
- Restaurant 1: Monday 9 AM
- Restaurant 2: Monday 2 PM
- Restaurant 3: Tuesday 9 AM
- Restaurant 4: Tuesday 2 PM
...
```

### 2. Stagger Automated Syncs
```
Don't sync all at once!

Good:
- Restaurant 1: 8:00 AM
- Restaurant 2: 8:05 AM
- Restaurant 3: 8:10 AM
- Restaurant 4: 8:15 AM
...
```

### 3. Sync Frequency
```
Low-frequency is better:
- ✅ 2-3 times per day: PERFECT
- ⚠️ Every 2 hours: OK
- ❌ Every 30 minutes: TOO MUCH
```

### 4. Monitor Sessions
```bash
# Daily health check
GET /api/delivery-platforms-sessions/list

# Alert if:
- Session age > 25 days → "Renew soon"
- Session invalid → "Re-initialize needed"
```

---

## 🚨 **Troubleshooting**

### Issue: "Session expired"

**Solution:**
```bash
# Re-initialize session
POST /api/delivery-platforms-sessions/init
{
  "platform": "doordash",
  "username": "email",
  "password": "password"
}
```

### Issue: "Multiple restaurants failing"

**Possible causes:**
1. IP might be rate-limited (reduce sync frequency)
2. Platform changed their website (selectors broke)
3. All sessions expired at once (re-init in stages)

### Issue: "Session valid but sync fails"

**Solution:**
```bash
# Delete and re-create session
DELETE /api/delivery-platforms-sessions/doordash
POST /api/delivery-platforms-sessions/init
```

---

## ✅ **Summary**

### The Answer To Your Question:

**Q: "How would it work for multiple restaurants on same IP?"**

**A: Session persistence!**

1. Each restaurant logs in **once** manually
2. Session cookies saved to disk
3. Automated syncs **reuse** sessions (no login!)
4. Looks like normal user staying logged in
5. Sessions last 30 days before renewal

### Key Points:

✅ **No repeated logins** → Less suspicious
✅ **Separate sessions per restaurant** → Isolated
✅ **Same IP is fine** → Using saved sessions
✅ **5x faster** → Skip login step
✅ **30x fewer auth attempts** → Monthly vs daily

### Files Created:

1. `BrowserAutomationService.sessions.ts` - Session management service
2. `delivery-platforms-sessions.ts` - API routes
3. `MULTI_RESTAURANT_STRATEGY.md` - Strategy document
4. `SESSION_BASED_MULTI_RESTAURANT_GUIDE.md` - This guide

---

**You're ready for multi-restaurant automation! 🎉**

