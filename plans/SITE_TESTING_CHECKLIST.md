# Servio Restaurant Platform - Comprehensive Testing Checklist

This checklist contains 50+ tests covering all functional areas of the Servio Restaurant Platform.

---

## 1. Authentication & Authorization (Tests 1-8)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 1 | Login Page | Verify login page loads without errors | High | [ ] |
| 2 | Login Page | Test valid credentials login | High | [ ] |
| 3 | Login Page | Test invalid credentials (wrong password) | High | [ ] |
| 4 | Login Page | Test invalid credentials (non-existent user) | High | [ ] |
| 5 | Login Page | Test empty fields validation | Medium | [ ] |
| 6 | Login Page | Test "Remember me" functionality | Medium | [ ] |
| 7 | Session | Verify session persists after page refresh | High | [ ] |
| 8 | Session | Test logout functionality | High | [ ] |

---

## 2. Dashboard (Tests 9-18)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 9 | Dashboard Home | Verify dashboard loads without errors | High | [ ] |
| 10 | Dashboard Home | Check all widgets load correctly | High | [ ] |
| 11 | Dashboard Home | Verify real-time order count updates | Medium | [ ] |
| 12 | Dashboard Home | Test navigation sidebar collapse/expand | Low | [ ] |
| 13 | Dashboard Home | Verify quick action buttons work | Medium | [ ] |
| 14 | Dashboard Home | Test date range picker for analytics | Medium | [ ] |
| 15 | Dashboard Home | Verify notification badge count | Medium | [ ] |
| 16 | Dashboard Home | Test theme toggle (light/dark mode) | Low | [ ] |
| 17 | Dashboard Home | Check responsive layout on mobile | High | [ ] |
| 18 | Dashboard Home | Verify loading states display correctly | Medium | [ ] |

---

## 3. Menu Management (Tests 19-28)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 19 | Menu Items | Verify menu items load without errors | High | [ ] |
| 20 | Menu Items | Test adding a new menu item | High | [ ] |
| 21 | Menu Items | Test editing an existing menu item | High | [ ] |
| 22 | Menu Items | Test deleting a menu item | High | [ ] |
| 23 | Menu Items | Test image upload (cover image - now 50MB limit) | High | [ ] |
| 24 | Menu Items | Test image upload validation | Medium | [ ] |
| 25 | Menu Items | Test category filtering | Medium | [ ] |
| 26 | Menu Items | Test search functionality | Medium | [ ] |
| 27 | Menu Items | Test sorting by name/price/popularity | Low | [ ] |
| 28 | Menu Items | Test availability toggle | Medium | [ ] |

---

## 4. Categories & Modifiers (Tests 29-35)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 29 | Categories | Test creating a new category | High | [ ] |
| 30 | Categories | Test editing category name/description | Medium | [ ] |
| 31 | Categories | Test deleting category with items | High | [ ] |
| 32 | Categories | Test category reordering | Low | [ ] |
| 33 | Modifiers | Test creating modifier groups | Medium | [ ] |
| 34 | Modifiers | Test adding modifier options | Medium | [ ] |
| 35 | Modifiers | Test required vs optional modifiers | Medium | [ ] |

---

## 5. Inventory Management (Tests 36-45)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 36 | Inventory Items | Verify inventory page loads | High | [ ] |
| 37 | Inventory Items | Test adding new inventory item | High | [ ] |
| 38 | Inventory Items | Test editing inventory item | High | [ ] |
| 39 | Inventory Items | Test deleting inventory item | High | [ ] |
| 40 | Inventory Items | Test unit cost field (recently added) | High | [ ] |
| 41 | Inventory Items | Test quantity tracking | Medium | [ ] |
| 42 | Inventory Items | Test low stock alerts | Medium | [ ] |
| 43 | Inventory Items | Test barcode scanning | Low | [ ] |
| 44 | Inventory Items | Test CSV import | Medium | [ ] |
| 45 | Inventory Items | Test inventory value calculation | Medium | [ ] |

---

## 6. Orders Management (Tests 46-55)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 46 | Orders List | Verify orders page loads | High | [ ] |
| 47 | Orders List | Test filtering by status (new, preparing, ready, delivered) | High | [ ] |
| 48 | Orders List | Test filtering by channel (in-store, online, delivery) | Medium | [ ] |
| 49 | Orders List | Test order search by customer name/phone | Medium | [ ] |
| 50 | Order Details | Test viewing order details | High | [ ] |
| 51 | Order Details | Test order status update | High | [ ] |
| 52 | Order Details | Test adding notes to order | Medium | [ ] |
| 53 | Order Details | Test refund processing | High | [ ] |
| 54 | Order Details | Test order cancellation | High | [ ] |
| 55 | Order Details | Test printing order receipt | Medium | [ ] |

---

## 7. Staff Management (Tests 56-65)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 56 | Staff List | Verify staff page loads | High | [ ] |
| 57 | Staff List | Test adding new staff member | High | [ ] |
| 58 | Staff List | Test editing staff details | High | [ ] |
| 59 | Staff List | Test deactivating staff member | High | [ ] |
| 60 | Timeclock | Test clock-in functionality | High | [ ] |
| 61 | Timeclock | Test clock-out functionality | High | [ ] |
| 62 | Timeclock | Test break tracking | Medium | [ ] |
| 63 | Timeclock | Test manual time entry | Medium | [ ] |
| 64 | Timeclock | Verify timesheet calculations | Medium | [ ] |
| 65 | Scheduling | Test creating shifts | Medium | [ ] |

---

## 8. Restaurant Profile & Settings (Tests 66-75)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 66 | Restaurant Profile | Verify profile page loads | High | [ ] |
| 67 | Restaurant Profile | Test updating restaurant name | High | [ ] |
| 68 | Restaurant Profile | Test logo upload (now 50MB limit) | Medium | [ ] |
| 69 | Restaurant Profile | Test cover image upload (now 50MB limit) | Medium | [ ] |
| 70 | Restaurant Profile | Test operating hours configuration | Medium | [ ] |
| 71 | Restaurant Profile | Test contact information update | Medium | [ ] |
| 72 | Settings | Test payment settings | Medium | [ ] |
| 73 | Settings | Test printer configuration | Medium | [ ] |
| 74 | Settings | Test notification preferences | Low | [ ] |
| 75 | Settings | Test account deletion | High | [ ] |

---

## 9. Public Menu Page (Tests 76-85)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 76 | Public Menu | Verify public menu loads | High | [ ] |
| 77 | Public Menu | Test category navigation | High | [ ] |
| 78 | Public Menu | Test item selection | High | [ ] |
| 79 | Public Menu | Test modifier selection | High | [ ] |
| 80 | Public Menu | Test cart functionality | High | [ ] |
| 81 | Public Menu | Test order placement | High | [ ] |
| 82 | Public Menu | Test mobile responsiveness | High | [ ] |
| 83 | Public Menu | Test image loading performance | Medium | [ ] |
| 84 | Public Menu | Test offline mode | Low | [ ] |
| 85 | Public Menu | Test SEO meta tags | Low | [ ] |

---

## 10. Integrations & APIs (Tests 86-95)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 86 | Delivery Platforms | Test Uber Eats integration | Medium | [ ] |
| 87 | Delivery Platforms | Test DoorDash integration | Medium | [ ] |
| 88 | Delivery Platforms | Test Grubhub integration | Medium | [ ] |
| 89 | Voice Assistant | Test voice command recognition | Medium | [ ] |
| 90 | Voice Assistant | Test order lookup via voice | Medium | [ ] |
| 91 | Notifications | Test SMS notifications | Medium | [ ] |
| 92 | Notifications | Test email notifications | Medium | [ ] |
| 93 | API Endpoints | Test /api/menu/items endpoint | High | [ ] |
| 94 | API Endpoints | Test /api/orders endpoints | High | [ ] |
| 95 | API Endpoints | Test /api/inventory endpoints | High | [ ] |

---

## 11. Performance & Security (Tests 96-105)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 96 | Performance | Page load time < 3 seconds | High | [ ] |
| 97 | Performance | Image optimization check | Medium | [ ] |
| 98 | Performance | API response time < 500ms | Medium | [ ] |
| 99 | Security | SQL injection prevention | High | [ ] |
| 100 | Security | XSS protection | High | [ ] |
| 101 | Security | CSRF token validation | High | [ ] |
| 102 | Security | Authentication bypass attempts | High | [ ] |
| 103 | Security | Rate limiting on auth endpoints | Medium | [ ] |
| 104 | Security | File upload validation | High | [ ] |
| 105 | Security | Sensitive data in logs | Medium | [ ] |

---

## 12. Error Handling & Edge Cases (Tests 106-115)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 106 | Error Handling | 404 page loads correctly | Medium | [ ] |
| 107 | Error Handling | 500 error page displays | Medium | [ ] |
| 108 | Error Handling | Network disconnect handling | Medium | [ ] |
| 109 | Error Handling | Form validation errors display | High | [ ] |
| 110 | Edge Cases | Empty database state | High | [ ] |
| 111 | Edge Cases | Concurrent order updates | Medium | [ ] |
| 112 | Edge Cases | Large file upload (50MB test) | High | [ ] |
| 113 | Edge Cases | Special characters in input | Medium | [ ] |
| 114 | Edge Cases | Unicode/Emoji support | Low | [ ] |
| 115 | Edge Cases | Date/time timezone handling | Medium | [ ] |

---

## 13. Tablet & Mobile (Tests 116-125)

| # | Test Category | Test Case | Priority | Status |
|---|---------------|-----------|----------|--------|
| 116 | Tablet Mode | Verify tablet login | High | [ ] |
| 117 | Tablet Mode | Test order taking workflow | High | [ ] |
| 118 | Tablet Mode | Test kitchen display integration | Medium | [ ] |
| 119 | Tablet Mode | Test receipt printing | Medium | [ ] |
| 120 | Mobile | Responsive layout on phone | High | [ ] |
| 121 | Mobile | Touch gestures work | Medium | [ ] |
| 122 | Mobile | Bottom navigation usability | Medium | [ ] |
| 123 | Mobile | PWA install prompt | Low | [ ] |
| 124 | Mobile | Offline functionality | Medium | [ ] |
| 125 | Mobile | Push notifications | Medium | [ ] |

---

## Quick Test Execution Guide

### Pre-Flight Checklist
- [ ] All environment variables set correctly
- [ ] Database migrations applied
- [ ] Test restaurant data seeded
- [ ] Screenshot folder created for bug reports

### Running Tests
```bash
# Run all tests
npm test

# Run specific category
npm test -- --testPathPattern="menu"
npm test -- --testPathPattern="inventory"

# Run with coverage
npm test -- --coverage
```

### Reporting Bugs
1. Screenshot of the issue
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Browser/device info
6. Console errors (if any)

---

## Test Summary

| Category | Total Tests | High Priority | Medium Priority | Low Priority |
|----------|-------------|---------------|-----------------|--------------|
| Authentication | 8 | 6 | 2 | 0 |
| Dashboard | 10 | 6 | 4 | 0 |
| Menu Management | 10 | 8 | 2 | 0 |
| Categories/Modifiers | 7 | 4 | 3 | 0 |
| Inventory | 10 | 6 | 4 | 0 |
| Orders | 10 | 8 | 2 | 0 |
| Staff Management | 10 | 6 | 4 | 0 |
| Restaurant Settings | 10 | 6 | 4 | 0 |
| Public Menu | 10 | 8 | 2 | 0 |
| Integrations/APIs | 10 | 4 | 6 | 0 |
| Performance/Security | 10 | 8 | 2 | 0 |
| Error Handling | 10 | 4 | 6 | 0 |
| Tablet/Mobile | 10 | 6 | 4 | 0 |
| **TOTAL** | **125** | **80** | **45** | **0** |

---

*Last Updated: 2026-02-09*
*Version: 1.0*
