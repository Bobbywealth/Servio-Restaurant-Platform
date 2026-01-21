# Servio Platform User Guides

## Table of Contents
1. [Restaurant Owner Guide](#restaurant-owner-guide)
2. [Manager Guide](#manager-guide)
3. [Staff Guide](#staff-guide)
4. [Admin Guide](#admin-guide)

---

## Restaurant Owner Guide

### Getting Started

#### 1. Account Setup
1. Visit https://servio.app
2. Click "Sign Up"
3. Enter your restaurant details
4. Verify your email
5. Complete your profile

#### 2. Restaurant Configuration
1. Navigate to Settings → Restaurant
2. Set your:
   - Restaurant name
   - Address and contact info
   - Operating hours
   - Cuisine type
   - Seating capacity

#### 3. Add Team Members
1. Go to Settings → Team
2. Click "Invite Team Member"
3. Enter email and select role:
   - **Owner**: Full access
   - **Manager**: Manage operations
   - **Staff**: Daily operations
4. Team member receives invite email

### Managing Your Menu

#### Add Menu Items
1. Navigate to Menu → Items
2. Click "+ New Item"
3. Fill in details:
   - Name and description
   - Price
   - Category
   - Upload photo
   - Add modifiers (optional)
4. Click "Save"

#### 86 an Item (Mark Unavailable)
1. Find the item in menu list
2. Toggle "Available" switch
3. Item is immediately unavailable for ordering
4. Staff and AI assistant are notified

#### Bulk Import Menu
1. Navigate to Menu → Import
2. Download CSV template
3. Fill in your menu items
4. Upload completed CSV
5. Review and confirm

### Voice Ordering Setup

#### Configure Vapi Integration
1. Go to Settings → Integrations
2. Click "Voice Ordering"
3. Enter your Vapi credentials:
   - API Key
   - Assistant ID
   - Phone Number
4. Test the integration
5. Save configuration

#### Customize Voice Responses
1. Settings → Voice Ordering
2. Customize greetings and responses
3. Set business rules:
   - Minimum order amount
   - Delivery radius
   - Available days/hours
4. Save changes

### Monitoring & Analytics

#### Dashboard Overview
- **Today's Orders**: Real-time count
- **Revenue**: Daily/weekly/monthly
- **Popular Items**: Best sellers
- **Staff Status**: Who's clocked in
- **Inventory Alerts**: Low stock items

#### Reports
1. Navigate to Reports
2. Select report type:
   - Sales Report
   - Inventory Report
   - Staff Hours Report
   - Customer Analytics
3. Choose date range
4. Export as PDF or CSV

### Billing & Subscription

#### View Current Plan
1. Settings → Billing
2. View current plan details
3. See usage statistics
4. View invoice history

#### Upgrade/Downgrade
1. Settings → Billing → Change Plan
2. Select new plan
3. Confirm changes
4. Payment processed automatically

---

## Manager Guide

### Daily Operations

#### Opening Checklist
1. Clock in (Dashboard → Clock In)
2. Review overnight orders
3. Check inventory levels
4. Assign tasks to staff
5. Verify all equipment working
6. Check AI assistant status

#### Order Management
1. Monitor incoming orders
2. Confirm orders promptly
3. Update order status:
   - Confirmed → Preparing → Ready → Completed
4. Handle special requests
5. Communicate with kitchen staff

#### Using the AI Assistant
1. Access via Dashboard → Assistant
2. Ask natural questions:
   - "What orders are pending?"
   - "Show me low stock items"
   - "What tasks are overdue?"
3. Get instant answers with context
4. Assistant monitors orders automatically

### Inventory Management

#### Daily Stock Check
1. Navigate to Inventory
2. Review current quantities
3. Check low stock alerts
4. Record usage/waste
5. Update quantities as needed

#### Reordering
1. Go to Inventory → Low Stock
2. Review items below reorder point
3. Click "Create Purchase Order"
4. Send to suppliers
5. Mark as ordered

#### Receiving Deliveries
1. Inventory → Receive Stock
2. Scan barcode or search item
3. Enter quantity received
4. Note expiration dates
5. Update inventory

### Staff Management

#### Assign Tasks
1. Go to Tasks → Create New
2. Fill in:
   - Title and description
   - Priority (Low/Medium/High/Urgent)
   - Assign to staff member
   - Due date/time
3. Staff receives notification

#### Monitor Time Clock
1. Dashboard → Staff Status
2. See who's clocked in/out
3. View hours worked
4. Edit entries if needed (with permission)
5. Approve overtime

#### Performance Tracking
1. Reports → Staff Performance
2. View metrics:
   - Orders completed
   - Task completion rate
   - Average order time
   - Customer feedback
3. Identify training needs

### Handling Issues

#### Order Issues
- **Wrong Order**: Update order, offer discount
- **Late Order**: Communicate with customer, expedite
- **Cancellation**: Process refund, update inventory

#### Staff Issues
- **No Show**: Reassign tasks, contact staff
- **Performance**: Document, provide feedback
- **Conflict**: Address immediately, escalate if needed

---

## Staff Guide

### Getting Started

#### First Login
1. Check email for invite
2. Click activation link
3. Set your password
4. Complete profile
5. Familiarize yourself with dashboard

#### Daily Routine
1. Clock in when arriving
2. Check assigned tasks
3. Monitor order notifications
4. Complete tasks
5. Clock out when leaving

### Order Taking

#### Phone Orders
1. Answer: "Thank you for calling [Restaurant]"
2. Take customer information
3. Write down order details
4. Repeat order for confirmation
5. Enter into system
6. Give estimated time
7. Thank customer

#### In-Person Orders
1. Greet customer warmly
2. Help with menu if needed
3. Enter order into POS
4. Confirm special requests
5. Process payment
6. Provide receipt and estimated time

### Using the System

#### Create Order
1. Dashboard → New Order
2. Select order type:
   - Dine-In
   - Takeout
   - Delivery
3. Add items:
   - Search or browse menu
   - Add modifiers
   - Enter quantity
4. Add customer info (takeout/delivery)
5. Review and confirm
6. Print ticket

#### Update Order Status
1. Find order in order list
2. Click order number
3. Update status:
   - Confirmed (order received)
   - Preparing (being made)
   - Ready (pickup/serve)
   - Completed (delivered)
4. Customer receives notifications

#### Voice Orders
When voice system transfers:
1. Greet customer
2. Have order details ready
3. Confirm order with customer
4. Enter into system
5. Process payment

### Task Management

#### View Tasks
1. Dashboard → My Tasks
2. See all assigned tasks
3. Filter by:
   - Priority
   - Due date
   - Status

#### Complete Tasks
1. Click task
2. Read instructions
3. Complete the work
4. Update notes (optional)
5. Mark as "Completed"
6. Manager is notified

### Inventory Tasks

#### Stock Count
1. Go to assigned stock area
2. Count each item
3. Enter count into system
4. Note any discrepancies
5. Report damages/spoilage

#### Restocking
1. Check par levels
2. Get items from storage
3. Rotate stock (FIFO)
4. Update quantities
5. Note if low stock

### Time Clock

#### Clock In/Out
1. Dashboard → Time Clock
2. Click "Clock In" or "Clock Out"
3. Confirm time
4. Add notes if needed (optional)

#### Breaks
1. Click "Start Break"
2. System tracks break time
3. Click "End Break" when returning

---

## Admin Guide

### System Administration

#### User Management
1. Navigate to Admin → Users
2. View all users across restaurants
3. Actions:
   - Create new users
   - Reset passwords
   - Deactivate accounts
   - Change roles
   - View activity logs

#### Restaurant Management
1. Admin → Restaurants
2. View all restaurants
3. Actions:
   - Create restaurant
   - Edit settings
   - Suspend/activate
   - View usage stats
   - Manage subscriptions

### Monitoring & Support

#### System Health
1. Admin → System Health
2. View metrics:
   - Uptime
   - Error rates
   - Response times
   - Database status
   - Cache status
   - API usage
3. Set up alerts

#### Error Monitoring
1. Admin → Errors
2. View error logs
3. Filter by:
   - Severity
   - Restaurant
   - Date range
   - Error type
4. Investigate and resolve

#### Support Tickets
1. Admin → Support
2. View open tickets
3. Assign to team members
4. Update status
5. Communicate with customers
6. Close resolved tickets

### Reports & Analytics

#### Platform Analytics
1. Admin → Analytics
2. View platform-wide metrics:
   - Active restaurants
   - Total orders
   - Revenue
   - User growth
   - Feature usage
3. Export reports

#### Performance Reports
1. Admin → Performance
2. Review:
   - API performance
   - Database queries
   - Cache hit rates
   - Error rates
   - Resource usage
3. Identify optimization opportunities

### Configuration

#### Feature Flags
1. Admin → Features
2. Enable/disable features:
   - Voice ordering
   - AI assistant
   - Mobile app
   - New features
3. Roll out gradually

#### System Settings
1. Admin → Settings
2. Configure:
   - Email templates
   - SMS settings
   - Payment processing
   - Integrations
   - Security policies

### Maintenance

#### Database Maintenance
```bash
# Run manually or via cron
./scripts/backup-database.sh production
```

#### Cache Management
1. Admin → Cache
2. View cache stats
3. Clear cache if needed
4. Configure TTL values

#### Security Audits
```bash
# Run security audit
./scripts/security-audit.sh

# Review findings
cat security-audit-*.txt
```

### Emergency Procedures

#### System Outage
1. Check System Health dashboard
2. Review error logs
3. Follow Incident Response Guide
4. Notify affected restaurants
5. Update status page
6. Document issue

#### Data Recovery
```bash
# Restore from backup
./scripts/restore-database.sh /path/to/backup.sql.gz
```

#### Security Breach
1. Immediately disable affected accounts
2. Rotate all API keys
3. Force password resets
4. Investigate breach
5. Notify affected users
6. File incident report

---

## Common Tasks Quick Reference

### For All Users

**Change Password**
Settings → Account → Change Password

**Update Profile**
Settings → Profile → Edit

**Enable Notifications**
Settings → Notifications → Configure preferences

**Get Help**
Help icon (?) → Search help docs or contact support

### For Managers & Owners

**View Today's Revenue**
Dashboard → Revenue card

**Export Data**
Reports → Select report → Export

**Add Team Member**
Settings → Team → Invite

**Update Menu Prices**
Menu → Select item → Edit → Update price

### For Staff

**Clock In/Out**
Dashboard → Clock In/Out button

**View Schedule**
Dashboard → My Schedule

**Report Issue**
Dashboard → Report Issue

**Complete Task**
My Tasks → Select task → Mark Complete

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Search | `Ctrl/Cmd + K` |
| New Order | `Ctrl/Cmd + N` |
| Clock In/Out | `Ctrl/Cmd + T` |
| Dashboard | `Ctrl/Cmd + H` |
| Tasks | `Ctrl/Cmd + L` |
| Menu | `Ctrl/Cmd + M` |
| Help | `F1` |

---

## Mobile App

### Download
- iOS: App Store - Search "Servio"
- Android: Google Play - Search "Servio"

### Features
- View orders
- Update order status
- Clock in/out
- View tasks
- Check inventory
- Receive notifications

---

## Getting Help

### Help Center
Visit https://help.servio.app for:
- Video tutorials
- Step-by-step guides
- FAQs
- Tips and tricks

### Contact Support
- Email: support@servio.app
- Phone: 1-800-SERVIO-1
- Live Chat: Available in app
- Response time: Within 4 hours

### Community
- Slack: https://servio.app/slack
- Forum: https://community.servio.app
- Newsletter: Weekly tips

---

## Training Resources

### Video Tutorials
- Getting Started (10 min)
- Order Management (15 min)
- Inventory Management (20 min)
- Using AI Assistant (8 min)
- Voice Ordering Setup (12 min)

### Certification
Complete Servio Academy courses to earn certification:
- Level 1: Basic Operations (2 hours)
- Level 2: Advanced Management (4 hours)
- Level 3: System Administration (6 hours)

---

## Troubleshooting

### Cannot Log In
- Verify email and password
- Check CAPS LOCK
- Try password reset
- Contact support if issues persist

### Orders Not Appearing
- Check internet connection
- Refresh page
- Verify restaurant is selected
- Check with manager

### Voice Ordering Not Working
- Verify integration is active
- Check phone number configuration
- Test with known number
- Contact support

### Slow Performance
- Close unused tabs
- Clear browser cache
- Check internet speed
- Use Chrome or Firefox

---

## Best Practices

### For All Users
- Log out when finished
- Keep login credentials secure
- Report issues immediately
- Provide feedback

### For Managers
- Check system daily
- Respond to alerts promptly
- Train staff regularly
- Review reports weekly

### For Staff
- Clock in/out accurately
- Complete tasks promptly
- Ask questions if unsure
- Communicate with team

---

## Feedback

We love hearing from our users! Share feedback:
- In-app: Help → Send Feedback
- Email: feedback@servio.app
- Survey: Sent monthly

Your input helps us improve Servio!
