# 🤖 Browser Automation for Delivery Platforms

## Overview

This guide explains how to use the browser automation feature to sync your menu items and stock status to third-party delivery platforms (DoorDash, Uber Eats, GrubHub, Postmates).

**Key Features:**
- ✅ Automated menu item syncing
- ✅ Stock availability updates (in-stock/out-of-stock)
- ✅ Price synchronization
- ✅ Separate credentials per restaurant
- ✅ Encrypted password storage
- ✅ Sync logs and audit trail
- ✅ Support for multiple platforms per restaurant

---

## 🚀 Setup Instructions

### 1. Install Playwright

First, install Playwright in the backend:

```bash
cd /home/user/Servio-Restaurant-Platform
npm install playwright
npx playwright install chromium
```

**Note:** If you're running in a container, you may need to install browser dependencies:
```bash
npx playwright install-deps chromium
```

### 2. Run Database Migration

The migration will run automatically on next server start. It creates these tables:
- `delivery_platform_credentials` - Stores encrypted login credentials
- `delivery_platform_sync_logs` - Tracks sync operations
- `delivery_platform_menu_mappings` - Maps your menu items to platform items

To manually verify:
```bash
npm run dev
# Check logs for: "✅ Migration 002_delivery_platforms.sql applied successfully"
```

### 3. Restart the Server

```bash
npm run dev
```

---

## 📝 API Endpoints

### Get Supported Platforms
```bash
GET /api/delivery-platforms/supported
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "doordash",
      "name": "DoorDash",
      "status": "active"
    },
    {
      "id": "ubereats",
      "name": "Uber Eats",
      "status": "active"
    }
  ]
}
```

### Save Platform Credentials
```bash
POST /api/delivery-platforms/credentials
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "platform": "doordash",
  "username": "your-email@restaurant.com",
  "password": "your-password",
  "portalUrl": "https://merchant-portal.doordash.com",
  "syncConfig": {
    "autoSync": true,
    "syncInterval": "hourly"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "platform": "doordash",
    "username": "your-email@restaurant.com",
    "isActive": true
  }
}
```

### Get All Credentials
```bash
GET /api/delivery-platforms/credentials
Authorization: Bearer <your-jwt-token>
```

### Test Credentials
```bash
POST /api/delivery-platforms/test-credentials
Content-Type: application/json

{
  "platform": "doordash",
  "username": "your-email@restaurant.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Credentials verified successfully"
}
```

### Sync to Single Platform
```bash
POST /api/delivery-platforms/sync/doordash
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "syncType": "stock_update"
}
```

**Sync Types:**
- `full_sync` - Sync everything (menu, stock, prices)
- `stock_update` - Only update availability (in-stock/out-of-stock)
- `price_update` - Only update prices
- `menu_update` - Update menu items

**Response:**
```json
{
  "success": true,
  "data": {
    "itemsSynced": 25,
    "itemsFailed": 2,
    "errors": ["Item not found: Special Burger"],
    "details": {
      "platform": "doordash",
      "syncType": "stock_update",
      "totalItems": 27
    }
  }
}
```

### Sync to All Platforms
```bash
POST /api/delivery-platforms/sync-all
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "syncType": "stock_update"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSynced": 50,
    "totalFailed": 0,
    "platforms": [
      {
        "platform": "doordash",
        "success": true,
        "itemsSynced": 25,
        "itemsFailed": 0
      },
      {
        "platform": "ubereats",
        "success": true,
        "itemsSynced": 25,
        "itemsFailed": 0
      }
    ]
  }
}
```

### Get Sync Logs
```bash
GET /api/delivery-platforms/sync-logs?platform=doordash&limit=20
Authorization: Bearer <your-jwt-token>
```

---

## 🏪 Multi-Restaurant Support

**Each restaurant has separate credentials!**

The system automatically uses the `restaurantId` from your JWT token to:
1. Store credentials separately per restaurant
2. Sync only that restaurant's menu items
3. Keep logs isolated per restaurant

**Example: Adding credentials for Restaurant A**
```bash
# Login as Restaurant A owner
POST /api/auth/login
{
  "email": "owner@restaurantA.com",
  "password": "password"
}

# Save DoorDash credentials for Restaurant A
POST /api/delivery-platforms/credentials
Authorization: Bearer <restaurant-a-token>
{
  "platform": "doordash",
  "username": "restaurantA@doordash.com",
  "password": "passwordA"
}

# Sync Restaurant A's menu
POST /api/delivery-platforms/sync/doordash
Authorization: Bearer <restaurant-a-token>
```

**Example: Adding credentials for Restaurant B**
```bash
# Login as Restaurant B owner
POST /api/auth/login
{
  "email": "owner@restaurantB.com",
  "password": "password"
}

# Save UberEats credentials for Restaurant B
POST /api/delivery-platforms/credentials
Authorization: Bearer <restaurant-b-token>
{
  "platform": "ubereats",
  "username": "restaurantB@uber.com",
  "password": "passwordB"
}

# Sync Restaurant B's menu
POST /api/delivery-platforms/sync/ubereats
Authorization: Bearer <restaurant-b-token>
```

---

## 🔐 Security Features

### Encrypted Password Storage
- Passwords are encrypted using AES-256-CBC
- Each password has a unique initialization vector (IV)
- Encryption key is derived from `JWT_SECRET` environment variable
- Passwords are NEVER returned in API responses
- Only decrypted during sync operations in memory

### Authentication
- All endpoints require JWT authentication
- Restaurant ID is extracted from JWT token
- Users can only access their own restaurant's credentials
- Audit logs track all credential changes

---

## 🧪 Testing Guide

### 1. Test with Postman/cURL

**Save Test Credentials:**
```bash
curl -X POST http://localhost:3002/api/delivery-platforms/test-credentials \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "doordash",
    "username": "test@example.com",
    "password": "test-password"
  }'
```

### 2. Test Stock Update Flow

```bash
# 1. Login
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "owner@restaurant.com", "pin": "1234"}'

# Save token from response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Add credentials
curl -X POST http://localhost:3002/api/delivery-platforms/credentials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "doordash",
    "username": "your-email@restaurant.com",
    "password": "your-password"
  }'

# 3. Mark a menu item as out of stock
curl -X PUT http://localhost:3002/api/menu/ITEM_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isAvailable": false}'

# 4. Sync to DoorDash
curl -X POST http://localhost:3002/api/delivery-platforms/sync/doordash \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"syncType": "stock_update"}'

# 5. Check sync logs
curl -X GET "http://localhost:3002/api/delivery-platforms/sync-logs?limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Frontend Testing (React/Next.js)

**Example Component:**
```typescript
// components/DeliveryPlatformSync.tsx
import { useState } from 'react';

export function DeliveryPlatformSync() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);

  const syncToDoordash = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/delivery-platforms/sync/doordash', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ syncType: 'stock_update' })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <button onClick={syncToDoordash} disabled={syncing}>
        {syncing ? 'Syncing...' : 'Sync to DoorDash'}
      </button>

      {result && (
        <div>
          <p>Items Synced: {result.data.itemsSynced}</p>
          <p>Items Failed: {result.data.itemsFailed}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 🎯 Use Cases

### Use Case 1: Mark Item Out of Stock
**Scenario:** Ran out of salmon, need to update DoorDash

```bash
# 1. Update item in your system
PUT /api/menu/salmon-item-id
{ "isAvailable": false }

# 2. Sync to DoorDash
POST /api/delivery-platforms/sync/doordash
{ "syncType": "stock_update" }
```

### Use Case 2: Price Update Across All Platforms
**Scenario:** Increased burger price from $12 to $14

```bash
# 1. Update price in your system
PUT /api/menu/burger-item-id
{ "price": 14.00 }

# 2. Sync to all platforms
POST /api/delivery-platforms/sync-all
{ "syncType": "price_update" }
```

### Use Case 3: New Menu Item
**Scenario:** Added "Chef Special" to menu

```bash
# 1. Add item in your system
POST /api/menu
{
  "name": "Chef Special",
  "price": 18.99,
  "isAvailable": true
}

# 2. Full sync to platforms
POST /api/delivery-platforms/sync-all
{ "syncType": "full_sync" }
```

---

## 🔧 Troubleshooting

### Issue: "Login failed - still on login page"
**Solution:**
- Verify credentials are correct
- Check if platform changed their login page structure
- Enable headless: false in BrowserAutomationService.ts to see browser

### Issue: "Item not found: [Item Name]"
**Solution:**
- Item name in your system must exactly match platform name
- Check platform portal to see actual item name
- Use menu mappings table to create aliases

### Issue: Sync times out
**Solution:**
- Increase timeout in service
- Sync in smaller batches
- Check network connection

### Issue: "Playwright not installed"
**Solution:**
```bash
npm install playwright
npx playwright install chromium
```

---

## 📊 Database Schema

### delivery_platform_credentials
```sql
- id: Unique identifier
- restaurant_id: Links to restaurants table
- platform: 'doordash' | 'ubereats' | 'grubhub' | 'postmates'
- username: Login email/username
- password_encrypted: AES-256 encrypted password
- portal_url: Custom portal URL (optional)
- is_active: Enable/disable syncing
- sync_config: JSON configuration
- last_sync_at: Last successful sync timestamp
- last_sync_status: 'success' | 'failed' | 'partial'
```

### delivery_platform_sync_logs
```sql
- id: Unique identifier
- credential_id: Links to credentials
- restaurant_id: Links to restaurants
- platform: Platform name
- sync_type: Type of sync operation
- status: 'running' | 'success' | 'failed' | 'partial'
- items_synced: Number of successful syncs
- items_failed: Number of failed syncs
- error_message: Error details
- started_at: Sync start time
- completed_at: Sync completion time
```

---

## 🚀 Future Enhancements

Potential improvements for the browser automation:

1. **Scheduled Auto-Sync**
   - Hourly/daily automatic syncing
   - Smart sync only on changes

2. **Menu Mapping Dashboard**
   - Visual interface to map items
   - Handle name mismatches

3. **Batch Operations**
   - Bulk update availability
   - Category-based syncing

4. **Order Import**
   - Pull orders from platforms
   - Auto-create in your system

5. **Analytics**
   - Sync success rates
   - Performance metrics
   - Platform comparison

6. **Webhook Integration**
   - Real-time updates
   - Two-way sync

---

## 📞 Support

For issues or questions:
1. Check sync logs: `GET /api/delivery-platforms/sync-logs`
2. Review audit logs: `GET /api/audit`
3. Enable debug logging in BrowserAutomationService.ts
4. Test credentials: `POST /api/delivery-platforms/test-credentials`

---

## ✅ Checklist for Production

- [ ] Install Playwright and browsers
- [ ] Set strong JWT_SECRET for encryption
- [ ] Test credentials for each platform
- [ ] Run initial full_sync
- [ ] Set up monitoring for sync failures
- [ ] Configure automated sync schedule
- [ ] Train staff on manual sync process
- [ ] Document platform-specific quirks
- [ ] Set up alerts for sync failures
- [ ] Review sync logs regularly

---

**Happy Automating! 🎉**
