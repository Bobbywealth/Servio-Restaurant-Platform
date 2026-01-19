# Account Switching for Easy Testing

This feature allows you to easily switch between different user accounts for testing purposes without having to log out and back in manually.

## Available Test Accounts

All accounts use the password: `password`

### System Admin Accounts
- **admin@servio.com** - System Admin (Full access)
- **superadmin@servio.com** - Super Admin (Full access)

### Restaurant Accounts
- **owner@demo.servio** - Restaurant Owner (Restaurant management)
- **manager@demo.servio** - Restaurant Manager (Limited access)
- **staff@demo.servio** - Restaurant Staff (Operational access)

## How to Use Account Switching

### 1. Automatic Login
The system will automatically log you in as `admin@servio.com` by default for testing convenience.

### 2. Account Switcher UI
Look for the account switcher in the bottom left of the sidebar. It shows:
- Current user name and role
- Total number of available accounts
- Click to expand and see all available accounts

### 3. Switch Accounts
1. Click on the account switcher to open the dropdown
2. You'll see accounts organized by role (System Admin, Restaurant Owner, etc.)
3. Click on any account to instantly switch to it
4. The current account will be highlighted with a checkmark
5. Switching accounts will show a loading spinner

### 4. Permissions by Role

#### Admin (`admin` role)
- Full system access
- Can manage multiple restaurants
- All permissions (`*`)

#### Owner (`owner` role)
- Full restaurant management
- Orders, inventory, menu, staff, analytics access

#### Manager (`manager` role)
- Limited restaurant management  
- Orders, inventory access
- Read-only menu and staff access

#### Staff (`staff` role)
- Operational access only
- Read/update orders
- Read-only inventory access

## Development Notes

### Backend Changes Made
1. **Database Schema**: Updated users table to include `admin` role
2. **Seed Data**: Created demo users for all roles with proper permissions
3. **API Endpoints**: 
   - `POST /api/auth/switch-account` - Switch to target account
   - `GET /api/auth/available-accounts` - Get all available test accounts
4. **Auth Types**: Updated to include `admin` role

### Frontend Changes Made
1. **UserContext**: Added account switching state and methods
2. **Account Switcher Component**: New UI component for switching accounts
3. **Dashboard Layout**: Integrated account switcher into sidebar
4. **User Types**: Updated to include `admin` role

### Security Considerations
- **Testing Only**: This feature is for development/testing purposes
- **Production**: In production, proper authorization checks should be added
- **Permissions**: Each role has appropriate permission levels set

## Quick Testing Scenarios

### Scenario 1: Admin to Restaurant Flow
1. Start as `admin@servio.com` (System Admin)
2. Switch to `owner@demo.servio` (Restaurant Owner) 
3. Test restaurant management features
4. Switch to `staff@demo.servio` (Restaurant Staff)
5. Verify limited operational access

### Scenario 2: Role-Based Access Testing
1. Login as `staff@demo.servio`
2. Try accessing different dashboard sections
3. Switch to `manager@demo.servio`
4. Verify additional access granted
5. Switch to `admin@servio.com`
6. Confirm full system access

## Troubleshooting

### Account Switcher Not Showing
- Ensure you're logged in to an account
- Check browser console for errors
- Verify backend is running and accessible

### Switch Account Failed
- Check network tab for API errors
- Verify the target account exists and is active
- Try refreshing the page and switching again

### Missing Accounts
- Run the seeding script: `npm run build && node dist/scripts/seed-demo-users.js`
- Check database has the demo users created
- Verify accounts are marked as `is_active = 1`

## Starting the Application

### Backend
```bash
cd backend
npm run dev  # or npm run build && npm start
```

### Frontend  
```bash
cd frontend
npm run dev  # or npm run build && npm start
```

The account switching feature will be automatically available once both servers are running!