# Admin Users Page Reorganization Plan

## Problem Statement
The `/admin/users` page currently shows ALL users from the database, including:
- Platform admins (platform-admin role)
- Restaurant owners (owner role)
- Restaurant managers (manager role) 
- Restaurant staff (staff role - cooks, servers, etc.)

This creates confusion because platform admins are mixed with restaurant employees.

## User Roles in the System

### Platform-Level Roles (CompanyRole)
- `super_admin` - Full platform access
- `admin` - Platform administration
- `manager` - Platform management
- `viewer` - Read-only platform access

### Restaurant-Level Roles (UserRole)
- `platform-admin` - Platform administrator
- `admin` - Restaurant admin
- `owner` - Restaurant owner
- `manager` - Restaurant manager
- `staff` - Restaurant employee (cooks, servers, etc.)

## Current Implementation Issues

1. **Backend** ([`src/routes/admin.ts:3840`](src/routes/admin.ts:3840)):
   - Returns ALL users regardless of role type
   - No filtering by user category
   - No restaurant information shown

2. **Frontend** ([`frontend/components/Admin/CompanyUserManager.tsx`](frontend/components/Admin/CompanyUserManager.tsx)):
   - Shows single table with all users mixed together
   - Role filter uses CompanyRole options but data may have UserRole values
   - No distinction between platform users and restaurant staff

## Proposed Solution

### Option A: Separate Tabs (Recommended)

Reorganize the page with tabs for different user categories:

```
┌──────────────────────────────────────────────────────────────────┐
│ Admin Users                                        [+ Invite]    │
├──────────────────────────────────────────────────────────────────┤
│ [Platform Admins] [Restaurant Users] [All Users]                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Platform Administrators (4 users)                                │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ Name           Email                    Role       Status  │   │
│ │ System Admin   admin@servio.com         platform   Active  │   │
│ │ Super Admin    super@servio.com         platform   Active  │   │
│ │ John Doe       john@company.com         admin      Active  │   │
│ │ Jane Smith     jane@company.com         manager    Active  │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Option B: Add User Type Column

Keep single table but add clear categorization:

```
┌────────────────────────────────────────────────────────────────────┐
│ Type            │ Name      │ Email             │ Role    │ Status │
├─────────────────┼───────────┼───────────────────┼─────────┼────────┤
│ 🏢 Platform     │ John D.   │ john@servio.com   │ admin   │ Active │
│ 🏢 Platform     │ Jane S.   │ jane@servio.com   │ manager │ Active │
│ 🍔 Restaurant   │ Mike R.   │ mike@burger.com   │ owner   │ Active │
│ 🍔 Restaurant   │ Sarah T.  │ sarah@burger.com  │ staff   │ Active │
└────────────────────────────────────────────────────────────────────┘
```

## Recommended Implementation

### Phase 1: Backend Enhancement

1. **Update `/api/admin/users` endpoint** to include:
   - Restaurant name for restaurant users
   - User category (platform vs restaurant)
   - Better filtering options

```typescript
// New response structure
{
  users: [
    {
      id: string;
      name: string;
      email: string;
      role: string;
      category: 'platform' | 'restaurant';
      restaurant_id?: string;
      restaurant_name?: string;
      is_active: boolean;
      created_at: string;
    }
  ],
  summary: {
    platformAdmins: number;
    restaurantOwners: number;
    restaurantManagers: number;
    staffMembers: number;
    total: number;
  }
}
```

2. **Add query parameters**:
   - `?category=platform` - Only platform admins
   - `?category=restaurant` - Only restaurant users
   - `?restaurant_id=xxx` - Filter by restaurant

### Phase 2: Frontend Enhancement

1. **Add tabs for user categories**:
   - Platform Admins (default tab)
   - Restaurant Users
   - All Users

2. **Add summary cards**:
   ```
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │ Platform    │ │ Restaurant  │ │ Staff       │ │ Total       │
   │ Admins: 4   │ │ Owners: 12  │ │ Members: 45 │ │ Users: 61   │
   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
   ```

3. **Show restaurant column** for restaurant users

4. **Add restaurant filter dropdown**

### Phase 3: Additional Improvements

1. **Bulk actions** per category
2. **Export functionality**
3. **Activity/last login tracking**

## Files to Modify

| File | Changes |
|------|---------|
| `src/routes/admin.ts` | Enhance `/api/admin/users` endpoint with category filtering |
| `frontend/components/Admin/CompanyUserManager.tsx` | Add tabs, summary cards, restaurant column |
| `frontend/pages/admin/users.tsx` | Update page title and description |

## Implementation Steps

1. [ ] Update backend API to categorize users
2. [ ] Add summary statistics to API response
3. [ ] Add tabs to frontend component
4. [ ] Add restaurant name column for restaurant users
5. [ ] Add filtering by restaurant
6. [ ] Test and push changes

## Database Query for User Categories

```sql
SELECT 
  u.id,
  u.name,
  u.email,
  u.role,
  u.is_active,
  u.created_at,
  CASE 
    WHEN u.role = 'platform-admin' THEN 'platform'
    WHEN u.restaurant_id = 'platform-admin-org' THEN 'platform'
    ELSE 'restaurant'
  END as category,
  r.name as restaurant_name
FROM users u
LEFT JOIN restaurants r ON u.restaurant_id = r.id
ORDER BY 
  CASE 
    WHEN u.role = 'platform-admin' THEN 0
    WHEN u.restaurant_id = 'platform-admin-org' THEN 1
    ELSE 2
  END,
  u.created_at DESC
```

## Visual Mockup

### Tab-Based Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Admin Users                                                     [+ Invite]  │
│ Manage platform administrators and restaurant users                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌───────────────┐ ┌────────────────┐ ┌───────────────┐        │
│ │ 👤 4      │ │ 🏪 12         │ │ 👨‍🍳 45          │ │ 📊 61        │        │
│ │ Platform  │ │ Restaurant    │ │ Staff          │ │ Total Users   │        │
│ │ Admins    │ │ Owners        │ │ Members        │ │               │        │
│ └───────────┘ └───────────────┘ └────────────────┘ └───────────────┘        │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Platform Admins] [Restaurant Users] [All Users]                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Search users...                          [All Restaurants ▼]  [All Roles]│
├─────────────────────────────────────────────────────────────────────────────┤
│ Name              Email                     Restaurant     Role     Status  │
├─────────────────────────────────────────────────────────────────────────────┤
│ System Admin      admin@servio.com          —              Platform  Active │
│ Super Admin       super@servio.com          —              Platform  Active │
│ John Doe          john@burgers.com          Burger Palace  Owner     Active │
│ Jane Smith        jane@burgers.com          Burger Palace  Manager   Active │
│ Mike Johnson      mike@burgers.com          Burger Palace  Staff     Active │
│ Sarah Wilson      sarah@pizza.com           Pizza House    Owner     Active │
└─────────────────────────────────────────────────────────────────────────────┘
```
