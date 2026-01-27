# Staff Clock-In PWA Implementation

This document describes the Staff Clock-In PWA feature for Servio.

## URLs

### Staff Clock-In PWA
```
https://your-domain/staff/clock
```

### Management Dashboard (existing)
```
https://your-domain/dashboard/staff
```

## Features

### For Staff (PWA)
- **PIN Login**: Enter 4-digit PIN to authenticate
- **Clock In/Out**: Start and end shifts
- **Break Management**: Start and end breaks during shifts
- **Weekly Hours Display**: View total hours worked this week
- **Offline Support**: Service worker caches key assets for offline use
- **Installable**: Can be installed as a PWA on tablets/phones

### For Managers (Dashboard)
- **Staff Management**: View, add, and manage staff members
- **PIN Display**: Each staff card shows their 4-digit PIN
- **Quick Clock-In Link**: Direct link to the PWA for each staff member
- **Shift Status**: Real-time view of who is clocked in/on break

## API Endpoints

### Public Staff Clock API (PIN-authenticated)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/staff/clock/pin-login` | POST | Authenticate with PIN |
| `/api/staff/clock/clock-in` | POST | Clock in (requires PIN) |
| `/api/staff/clock/clock-out` | POST | Clock out (requires PIN) |
| `/api/staff/clock/start-break` | POST | Start break (requires PIN) |
| `/api/staff/clock/end-break` | POST | End break (requires PIN) |
| `/api/staff/clock/my-stats` | GET | Get weekly stats (requires PIN) |

### Protected Restaurant Staff API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/restaurant/staff` | GET | List all staff |
| `/api/restaurant/staff` | POST | Create staff (auto-generates PIN) |
| `/api/restaurant/staff/:id` | PUT | Update staff |
| `/api/restaurant/staff/:id` | DELETE | Deactivate staff |

## PIN Generation

When a new staff member is created via `/api/restaurant/staff` (POST), a unique 4-digit PIN is automatically generated. The PIN is:

- 4 digits (1000-9999)
- Unique within the restaurant
- Returned only in the creation response
- Displayed on the staff management dashboard

## Database Schema

### New Tables/Migrations

1. **time_entry_breaks** (migration 025)
   - Tracks breaks taken during time entries
   - Columns: id, time_entry_id, break_start, break_end, duration_minutes

### Existing Tables Used

1. **users**
   - Added `pin` column (4-digit PIN for staff login)
   - Already existed in schema

2. **time_entries**
   - Tracks clock in/out times
   - Used for hours calculations

## Installation

### 1. Run Migrations
```bash
# Apply migration 025 for time_entry_breaks table
npm run db:migrate
```

### 2. Restart Server
```bash
# The new routes will be automatically loaded
npm run dev
# or for production
npm start
```

### 3. Add Staff Members
Use the dashboard or API to create staff:
```bash
curl -X POST http://localhost:3002/api/restaurant/staff \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@restaurant.com", "role": "staff"}'
```

Response includes the generated PIN:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "John Doe",
    "email": "john@restaurant.com",
    "pin": "1234",  // Save this!
    "role": "staff",
    "is_active": true
  }
}
```

### 4. Install PWA on Tablets
1. Navigate to `/staff/clock` in Chrome/Safari
2. Tap "Share" (iOS) or menu (Android)
3. Select "Add to Home Screen"
4. The app will be available offline

## Security Considerations

- PINs are currently stored in plain text (consider hashing in production)
- The PWA endpoints are designed for internal tablet use
- Session data is stored in localStorage (clearable by user)
- Consider adding IP-based restrictions for production

## Screenshots

### PIN Login Screen
- 4 large input boxes for PIN entry
- Auto-focus management
- Paste support for quick entry
- Error handling for invalid PINs

### Main Clock Screen
- Welcome banner with staff name
- Weekly hours card with progress bar
- Clock In/Out action buttons
- Break management buttons
- Real-time shift timer

## Troubleshooting

### PIN Not Working
1. Verify staff member is active (`is_active = true`)
2. Check PIN is correct (displayed on dashboard)
3. Ensure restaurant is active

### Can't Clock In
1. Check user is not already clocked in
2. Verify database connection
3. Check server logs for errors

### PWA Not Installing
1. Ensure served over HTTPS (required for PWA)
2. Check manifest.json is valid
3. Verify service worker is registered
