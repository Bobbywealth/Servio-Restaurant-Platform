# Servio Restaurant Platform - Comprehensive Test Strategy

## Overview

This document outlines the complete testing strategy for the Servio Restaurant Platform, covering all pages, API endpoints, and features identified in the codebase.

---

## Test Infrastructure

### Testing Frameworks
- **Unit Tests**: Jest (`npm run test:unit`)
- **Integration Tests**: Jest (`npm run test:integration`)
- **E2E Tests**: Cypress + Playwright (`npm run test:e2e`)

### Test File Locations
```
/src/routes/*.test.ts           # Backend unit/integration tests
/cypress/e2e/*.cy.ts           # Cypress E2E tests
/frontend/e2e/*.spec.ts         # Playwright E2E tests
/src/__tests__/                 # Test utilities and fixtures
```

---

## Priority 1: Critical Business Flows (MUST PASS)

### 1. Authentication Flow
| Test Case | Type | File |
|-----------|------|------|
| Login with valid credentials | E2E | `auth.cy.ts` |
| Login with invalid credentials shows error | E2E | `auth.cy.ts` |
| Logout clears session | E2E | `auth.cy.ts` |
| Protected routes redirect to login | E2E | `auth.cy.ts` |
| Token refresh works | Integration | `auth.test.ts` |
| Signup creates new account | E2E | `auth.cy.ts` |

### 2. Order Lifecycle
| Test Case | Type | File |
|-----------|------|------|
| Create new order | E2E | `orders.cy.ts` |
| View order list | E2E | `orders.cy.ts` |
| Update order status | E2E | `orders.cy.ts` |
| Order status filters work | E2E | `orders.cy.ts` |
| Order search functionality | E2E | `orders.cy.ts` |
| Order pagination works | E2E | `orders.cy.ts` |
| Order details modal opens | E2E | `orders.cy.ts` |

### 3. Staff Timeclock
| Test Case | Type | File |
|-----------|------|------|
| Clock in with valid PIN | E2E | `timeclock.cy.ts` |
| Clock out ends shift | E2E | `timeclock.cy.ts` |
| Start break | E2E | `timeclock.cy.ts` |
| End break | E2E | `timeclock.cy.ts` |
| View timeclock history | E2E | `timeclock.cy.ts` |
| Manager override clock in | E2E | `timeclock.cy.ts` |
| Manager override clock out | E2E | `timeclock.cy.ts` |

### 4. Menu Management
| Test Case | Type | File |
|-----------|------|------|
| Add new category | E2E | `menu.cy.ts` |
| Add new menu item | E2E | `menu.cy.ts` |
| Edit menu item | E2E | `menu.cy.ts` |
| Delete menu item | E2E | `menu.cy.ts` |
| Toggle item availability | E2E | `menu.cy.ts` |
| Reorder categories | E2E | `menu.cy.ts` |
| Reorder items within category | E2E | `menu.cy.ts` |

### 5. Tablet/Kitchen Display
| Test Case | Type | File |
|-----------|------|------|
| Order queue displays | E2E | `tablet-orders.cy.ts` |
| New order appears in queue | E2E | `tablet-orders.cy.ts` |
| Status update buttons work | E2E | `tablet-orders.cy.ts` |
| Timer display updates | E2E | `tablet-kitchen.cy.ts` |

---

## Priority 2: High Priority Features

### 6. Staff Management
| Test Case | Type | File |
|-----------|------|------|
| View staff list | E2E | `staff.cy.ts` |
| Add new staff member | E2E | `staff.cy.ts` |
| Edit staff details | E2E | `staff.cy.ts` |
| Assign roles | E2E | `staff.cy.ts` |
| Set/reset PIN | E2E | `staff.cy.ts` |
| Deactivate staff | E2E | `staff.cy.ts` |
| Search staff | E2E | `staff.cy.ts` |
| Bulk actions | E2E | `staff.cy.ts` |

### 7. Staff Scheduling
| Test Case | Type | File |
|-----------|------|------|
| Calendar view loads | E2E | `schedule.cy.ts` |
| Week view loads | E2E | `schedule.cy.ts` |
| Create new shift | E2E | `schedule.cy.ts` |
| Edit existing shift | E2E | `schedule.cy.ts` |
| Delete shift | E2E | `schedule.cy.ts` |
| Publish schedule | E2E | `schedule.cy.ts` |
| Assign staff to shift | E2E | `schedule.cy.ts` |
| Shift template management | E2E | `schedule.cy.ts` |
| Conflict detection | E2E | `schedule.cy.ts` |

### 8. Inventory Management
| Test Case | Type | File |
|-----------|------|------|
| View inventory list | E2E | `inventory.cy.ts` |
| Add inventory item | E2E | `inventory.cy.ts` |
| Adjust stock quantity | E2E | `inventory.cy.ts` |
| Low stock alerts display | E2E | `inventory.cy.ts` |
| Search/filter inventory | E2E | `inventory.cy.ts` |
| Receipt scanning | E2E | `inventory.cy.ts` |
| Export inventory | E2E | `inventory.cy.ts` |

### 9. Admin Dashboard
| Test Case | Type | File |
|-----------|------|------|
| Platform stats load | E2E | `admin-dashboard.cy.ts` |
| Restaurant list displays | E2E | `admin-restaurants.cy.ts` |
| Create restaurant | E2E | `admin-restaurants.cy.ts` |
| Edit restaurant | E2E | `admin-restaurants.cy.ts` |
| Toggle restaurant status | E2E | `admin-restaurants.cy.ts` |
| Multi-restaurant order view | E2E | `admin-orders.cy.ts` |

### 10. Marketing Campaigns
| Test Case | Type | File |
|-----------|------|------|
| View campaign list | E2E | `marketing.cy.ts` |
| Create new campaign | E2E | `marketing.cy.ts` |
| Send SMS campaign | E2E | `marketing.cy.ts` |
| View customer list | E2E | `marketing.cy.ts` |
| Campaign analytics display | E2E | `marketing.cy.ts` |

---

## Priority 3: Medium Priority Features

### 11. Settings
| Test Case | Type | File |
|-----------|------|------|
| Profile settings load | E2E | `settings.cy.ts` |
| Update profile | E2E | `settings.cy.ts` |
| Restaurant settings | E2E | `settings.cy.ts` |
| Notification preferences | E2E | `settings.cy.ts` |
| Theme toggle works | E2E | `settings.cy.ts` |
| API keys management | E2E | `settings.cy.ts` |

### 12. AI Assistant
| Test Case | Type | File |
|-----------|------|------|
| Chat interface loads | E2E | `assistant.cy.ts` |
| Send text message | E2E | `assistant.cy.ts` |
| Voice input works | E2E | `assistant.cy.ts` |
| Response renders correctly | E2E | `assistant.cy.ts` |
| Conversation history | E2E | `assistant.cy.ts` |

### 13. Public Pages
| Test Case | Type | File |
|-----------|------|------|
| Homepage loads | E2E | `public.cy.ts` |
| Navigation works | E2E | `public.cy.ts` |
| CTA buttons functional | E2E | `public.cy.ts` |
| Demo booking form | E2E | `public.cy.ts` |
| Login page loads | E2E | `public.cy.ts` |
| Signup page loads | E2E | `public.cy.ts` |

### 14. Integrations
| Test Case | Type | File |
|-----------|------|------|
| View integrations list | E2E | `integrations.cy.ts` |
| Add integration | E2E | `integrations.cy.ts` |
| Toggle integration | E2E | `integrations.cy.ts` |
| Sync integration | E2E | `integrations.cy.ts` |
| Test integration | E2E | `integrations.cy.ts` |
| Delete integration | E2E | `integrations.cy.ts` |

---

## API Integration Tests

### Authentication API (`/src/routes/auth.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| POST | `/api/auth/signup` | `auth.test.ts` |
| POST | `/api/auth/login` | `auth.test.ts` |
| POST | `/api/auth/refresh` | `auth.test.ts` |
| POST | `/api/auth/logout` | `auth.test.ts` |
| GET | `/api/auth/me` | `auth.test.ts` |

### Orders API (`/src/routes/orders.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/orders` | `orders.test.ts` |
| POST | `/api/orders` | `orders.test.ts` |
| GET | `/api/orders/:id` | `orders.test.ts` |
| PUT | `/api/orders/:id` | `orders.test.ts` |
| DELETE | `/api/orders/:id` | `orders.test.ts` |
| POST | `/api/orders/:id/status` | `orders.test.ts` |
| POST | `/api/orders/:id/prep-time` | `orders.test.ts` |
| GET | `/api/orders/stats/summary` | `orders.test.ts` |
| GET | `/api/orders/analytics` | `orders.test.ts` |
| GET | `/api/orders/history` | `orders.test.ts` |
| GET | `/api/orders/waiting-times` | `orders.test.ts` |

### Menu API (`/src/routes/menu.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/menu/categories` | `menu.test.ts` |
| POST | `/api/menu/categories` | `menu.test.ts` |
| PUT | `/api/menu/categories/:id` | `menu.test.ts` |
| DELETE | `/api/menu/categories/:id` | `menu.test.ts` |
| PUT | `/api/menu/categories/reorder` | `menu.test.ts` |
| PUT | `/api/menu/categories/:id/visibility` | `menu.test.ts` |
| GET | `/api/menu/items` | `menu.test.ts` |
| POST | `/api/menu/items` | `menu.test.ts` |
| PUT | `/api/menu/items/:id` | `menu.test.ts` |
| DELETE | `/api/menu/items/:id` | `menu.test.ts` |
| GET | `/api/menu/items/search` | `menu.test.ts` |
| POST | `/api/menu/items/set-unavailable` | `menu.test.ts` |
| POST | `/api/menu/items/set-available` | `menu.test.ts` |
| POST | `/api/menu/import` | `menu.test.ts` |
| GET | `/api/menu/items/:id/sizes` | `menu.test.ts` |
| POST | `/api/menu/items/:id/sizes` | `menu.test.ts` |
| PUT | `/api/menu/items/:id/sizes/:sizeId` | `menu.test.ts` |
| DELETE | `/api/menu/items/:id/sizes/:sizeId` | `menu.test.ts` |

### Staff API (`/src/routes/staff.ts`, `/src/routes/staff-bulk.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/staff` | `staff.test.ts` |
| POST | `/api/staff` | `staff.test.ts` |
| PUT | `/api/staff/:id` | `staff.test.ts` |
| DELETE | `/api/staff/:id` | `staff.test.ts` |
| POST | `/api/staff-bulk/update` | `staff.test.ts` |
| POST | `/api/staff-bulk/deactivate` | `staff.test.ts` |
| POST | `/api/staff-bulk/activate` | `staff.test.ts` |
| POST | `/api/staff-bulk/delete` | `staff.test.ts` |
| POST | `/api/staff-bulk/reset-pins` | `staff.test.ts` |

### Timeclock API (`/src/routes/timeclock.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| POST | `/api/timeclock/clock-in` | `timeclock.test.ts` |
| POST | `/api/timeclock/clock-out` | `api/timeclock.test.ts` |
| POST | `/api/timeclock/start-break` | `timeclock.test.ts` |
| POST | `/api/timeclock/end-break` | `timeclock.test.ts` |
| GET | `/api/timeclock/current-staff` | `timeclock.test.ts` |
| GET | `/api/timeclock/entries` | `timeclock.test.ts` |
| POST | `/api/timeclock/entries` | `timeclock.test.ts` |
| PUT | `/api/timeclock/entries/:id` | `timeclock.test.ts` |
| GET | `/api/timeclock/stats` | `timeclock.test.ts` |
| POST | `/api/timeclock/pin-login` | `timeclock.test.ts` |
| GET | `/api/timeclock/my-stats` | `timeclock.test.ts` |
| GET | `/api/timeclock/staff-hours` | `timeclock.test.ts` |
| POST | `/api/timeclock/manager/clock-in` | `timeclock.test.ts` |
| POST | `/api/timeclock/manager/clock-out` | `timeclock.test.ts` |
| POST | `/api/timeclock/manager/reverse-entry` | `timeclock.test.ts` |

### Staff Scheduling API (`/src/routes/staff-scheduling.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/scheduling/schedules` | `scheduling.test.ts` |
| GET | `/api/scheduling/schedules/:id` | `scheduling.test.ts` |
| POST | `/api/scheduling/schedules` | `scheduling.test.ts` |
| PUT | `/api/scheduling/schedules/:id` | `scheduling.test.ts` |
| DELETE | `/api/scheduling/schedules/:id` | `scheduling.test.ts` |
| POST | `/api/scheduling/schedules/bulk` | `scheduling.test.ts` |
| POST | `/api/scheduling/publish` | `scheduling.test.ts` |
| GET | `/api/scheduling/availability/:userId` | `scheduling.test.ts` |
| PUT | `/api/scheduling/availability/:userId` | `scheduling.test.ts` |
| GET | `/api/scheduling/templates` | `scheduling.test.ts` |
| POST | `/api/scheduling/templates` | `scheduling.test.ts` |
| PUT | `/api/scheduling/templates/:id` | `scheduling.test.ts` |
| DELETE | `/api/scheduling/templates/:id` | `scheduling.test.ts` |
| GET | `/api/scheduling/summary` | `scheduling.test.ts` |

### Inventory API (`/src/routes/inventory.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/inventory` | `inventory.test.ts` |
| POST | `/api/inventory` | `inventory.test.ts` |
| PUT | `/api/inventory/:id` | `inventory.test.ts` |
| GET | `/api/inventory/search` | `inventory.test.ts` |
| POST | `/api/inventory/receive` | `inventory.test.ts` |
| POST | `/api/inventory/adjust` | `inventory.test.ts` |
| GET | `/api/inventory/low-stock` | `inventory.test.ts` |
| GET | `/api/inventory/categories` | `inventory.test.ts` |
| POST | `/api/inventory/analyze-receipt` | `inventory.test.ts` |
| POST | `/api/inventory/create-from-receipt` | `inventory.test.ts` |
| GET | `/api/inventory/analysis/:id` | `inventory.test.ts` |

### Marketing API (`/src/routes/marketing.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/marketing/customers` | `marketing.test.ts` |
| POST | `/api/marketing/customers` | `marketing.test.ts` |
| GET | `/api/marketing/campaigns` | `marketing.test.ts` |
| POST | `/api/marketing/campaigns` | `marketing.test.ts` |
| POST | `/api/marketing/campaigns/:id/send` | `marketing.test.ts` |
| POST | `/api/marketing/send-sms` | `marketing.test.ts` |
| POST | `/api/marketing/send-test-sms` | `marketing.test.ts` |
| GET | `/api/marketing/validate-phone` | `marketing.test.ts` |
| GET | `/api/marketing/sms-config-status` | `marketing.test.ts` |
| POST | `/api/marketing/send-email` | `marketing.test.ts` |
| GET | `/api/marketing/analytics` | `marketing.test.ts` |
| POST | `/api/marketing/send-staff-message` | `marketing.test.ts` |
| POST | `/api/marketing/broadcast-staff` | `marketing.test.ts` |

### Admin API (`/src/routes/admin.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/admin/platform-stats` | `admin.test.ts` |
| GET | `/api/admin/recent-activity` | `admin.test.ts` |
| GET | `/api/admin/analytics` | `admin.test.ts` |
| GET | `/api/admin/restaurants` | `admin.test.ts` |
| POST | `/api/admin/restaurants` | `admin.test.ts` |
| GET | `/api/admin/restaurants/:id` | `admin.test.ts` |
| GET | `/api/admin/orders` | `admin.test.ts` |
| GET | `/api/admin/orders/:id` | `admin.test.ts` |
| POST | `/api/admin/orders/:id/cancel` | `admin.test.ts` |
| POST | `/api/admin/orders/:id/reopen` | `admin.test.ts` |
| GET | `/api/admin/users` | `admin.test.ts` |
| POST | `/api/admin/users/invite` | `admin.test.ts` |
| GET | `/api/admin/billing/overview` | `admin.test.ts` |
| GET | `/api/admin/campaigns` | `admin.test.ts` |
| POST | `/api/admin/campaigns/:id/approve` | `admin.test.ts` |
| POST | `/api/admin/campaigns/:id/disapprove` | `admin.test.ts` |
| GET | `/api/admin/audit-logs` | `admin.test.ts` |
| GET | `/api/admin/tasks` | `admin.test.ts` |
| POST | `/api/admin/tasks` | `admin.test.ts` |
| GET | `/api/admin/system/health` | `admin.test.ts` |
| GET | `/api/admin/errors/recent` | `admin.test.ts` |

### Notifications API (`/src/routes/notifications.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/notifications` | `notifications.test.ts` |
| POST | `/api/notifications/:id/read` | `notifications.test.ts` |
| POST | `/api/notifications/read-all` | `notifications.test.ts` |
| DELETE | `/api/notifications/clear-all` | `notifications.test.ts` |
| DELETE | `/api/notifications/:id` | `notifications.test.ts` |

### Integrations API (`/src/routes/integrations.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/integrations` | `integrations.test.ts` |
| GET | `/api/integrations/:id` | `integrations.test.ts` |
| POST | `/api/integrations` | `integrations.test.ts` |
| PUT | `/api/integrations/:id` | `integrations.test.ts` |
| POST | `/api/integrations/:id/toggle` | `integrations.test.ts` |
| POST | `/api/integrations/:id/sync` | `integrations.test.ts` |
| DELETE | `/api/integrations/:id` | `integrations.test.ts` |
| POST | `/api/integrations/:id/test` | `integrations.test.ts` |

### Modifiers API (`/src/routes/modifiers.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| POST | `/api/modifiers/restaurants/:restaurantId/modifier-groups` | `modifiers.test.ts` |
| GET | `/api/modifiers/restaurants/:restaurantId/modifier-groups` | `modifiers.test.ts` |
| PUT | `/api/modifiers/modifier-groups/:groupId` | `modifiers.test.ts` |
| DELETE | `/api/modifiers/modifier-groups/:groupId` | `modifiers.test.ts` |
| POST | `/api/modifiers/modifier-groups/:groupId/options` | `modifiers.test.ts` |
| PUT | `/api/modifiers/modifier-options/:optionId` | `modifiers.test.ts` |
| DELETE | `/api/modifiers/modifier-options/:optionId` | `modifiers.test.ts` |

### Company API (`/src/routes/company.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/company` | `company.test.ts` |
| PUT | `/api/company` | `company.test.ts` |
| GET | `/api/company/restaurants` | `company.test.ts` |
| POST | `/api/company/restaurants` | `company.test.ts` |
| GET | `/api/company/analytics` | `company.test.ts` |
| GET | `/api/company/users` | `company.test.ts` |
| POST | `/api/company/users/invite` | `company.test.ts` |
| PUT | `/api/company/users/:userId/role` | `company.test.ts` |
| GET | `/api/company/billing` | `company.test.ts` |
| GET | `/api/company/audit-logs` | `company.test.ts` |

### Restaurant API (`/src/routes/restaurant.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/restaurant/profile` | `restaurant.test.ts` |
| PUT | `/api/restaurant/profile` | `restaurant.test.ts` |
| PUT | `/api/restaurant/settings` | `restaurant.test.ts` |
| POST | `/api/restaurant/printer-test` | `restaurant.test.ts` |
| GET | `/api/restaurant/theme` | `restaurant.test.ts` |
| PUT | `/api/restaurant/theme` | `restaurant.test.ts` |
| GET | `/api/restaurant/links` | `restaurant.test.ts` |
| POST | `/api/restaurant/links` | `restaurant.test.ts` |
| PUT | `/api/restaurant/links/:id` | `restaurant.test.ts` |
| DELETE | `/api/restaurant/links/:id` | `restaurant.test.ts` |
| GET | `/api/restaurant/onboarding-status` | `restaurant.test.ts` |
| POST | `/api/restaurant/onboarding-complete` | `restaurant.test.ts` |

### Voice/Assistant APIs
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/assistant/status` | `assistant.test.ts` |
| POST | `/api/assistant/process-audio` | `assistant.test.ts` |
| POST | `/api/assistant/process-text` | `assistant.test.ts` |
| GET | `/api/assistant/conversation/:userId` | `assistant.test.ts` |
| DELETE | `/api/assistant/conversation/:userId` | `assistant.test.ts` |
| POST | `/api/assistant/feedback` | `assistant.test.ts` |
| GET | `/api/assistant/tools` | `assistant.test.ts` |
| GET | `/api/conversations` | `conversations.test.ts` |
| GET | `/api/conversations/:id` | `conversations.test.ts` |
| POST | `/api/conversations/:id/review` | `conversations.test.ts` |
| GET | `/api/voice-conversations` | `voice-conversations.test.ts` |
| GET | `/api/voice-conversations/:id` | `voice-conversations.test.ts` |
| DELETE | `/api/voice-conversations/:id` | `voice-conversations.test.ts` |
| POST | `/api/voice-conversations/:id/messages` | `voice-conversations.test.ts` |
| GET | `/api/voice/menu` | `voice.test.ts` |
| POST | `/api/voice/order/quote` | `voice.test.ts` |
| POST | `/api/voice/orders` | `voice.test.ts` |
| POST | `/api/voice/orders/:id/accept` | `voice.test.ts` |

### Tasks API (`/src/routes/tasks.ts`)
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/tasks/today` | `tasks.test.ts` |
| GET | `/api/tasks` | `tasks.test.ts` |
| POST | `/api/tasks/:id/complete` | `tasks.test.ts` |
| POST | `/api/tasks/:id/start` | `tasks.test.ts` |
| POST | `/api/tasks` | `tasks.test.ts` |
| PUT | `/api/tasks/:id` | `tasks.test.ts` |
| DELETE | `/api/tasks/:id` | `tasks.test.ts` |
| POST | `/api/tasks/generate-from-text` | `tasks.test.ts` |
| POST | `/api/tasks/bulk-create` | `tasks.test.ts` |

### Other APIs
| Method | Endpoint | Test File |
|--------|----------|-----------|
| GET | `/api/health` | `health.test.ts` |
| GET | `/api/health/liveness` | `health.test.ts` |
| GET | `/api/health/readiness` | `health.test.ts` |
| GET | `/api/audit/logs` | `audit.test.ts` |
| GET | `/api/audit/stats` | `audit.test.ts` |
| GET | `/api/audit/entity/:entityType/:entityId` | `audit.test.ts` |
| GET | `/api/staff-analytics` | `staff-analytics.test.ts` |
| GET | `/api/staff-analytics/performance` | `staff-analytics.test.ts` |
| GET | `/api/staff-analytics/time-logs` | `staff-analytics.test.ts` |
| POST | `/api/staff-analytics/export` | `staff-analytics.test.ts` |
| GET | `/api/delivery-platforms/credentials` | `delivery-platforms.test.ts` |
| POST | `/api/delivery-platforms/credentials` | `delivery-platforms.test.ts` |
| PUT | `/api/delivery-platforms/credentials/:platform` | `delivery-platforms.test.ts` |
| DELETE | `/api/delivery-platforms/credentials/:platform` | `delivery-platforms.test.ts` |
| POST | `/api/delivery-platforms/sync/:platform` | `delivery-platforms.test.ts` |
| GET | `/api/docs/json` | `docs.test.ts` |
| GET | `/api/docs/version` | `docs.test.ts` |
| GET | `/api/push/vapid-key` | `push.test.ts` |
| POST | `/api/push/subscribe` | `push.test.ts` |
| DELETE | `/api/push/unsubscribe` | `push.test.ts` |
| GET | `/api/push/preferences` | `push.test.ts` |
| PUT | `/api/push/preferences` | `push.test.ts` |
| GET | `/api/bookings` | `bookings.test.ts` |
| POST | `/api/bookings` | `bookings.test.ts` |
| POST | `/api/checkout/create-checkout-session` | `checkout.test.ts` |
| GET | `/api/checkout/session-status/:sessionId` | `checkout.test.ts` |

---

## Test Data Requirements

### Fixtures Needed
- `fixtures/auth.json` - Valid and invalid credentials
- `fixtures/orders.json` - Sample orders with various statuses
- `fixtures/menu.json` - Sample categories and items
- `fixtures/staff.json` - Staff members with roles
- `fixtures/inventory.json` - Inventory items
- `fixtures/restaurants.json` - Restaurant profiles

### Mock Data Strategies
- Use in-memory database for unit tests
- Use test database with seeded data for integration tests
- Use API mocking (MSW) for E2E tests where appropriate

---

## Browser/Device Coverage

### Desktop (Cypress)
- Chrome 1280x720
- Firefox 1280x720
- Safari 1280x720

### Mobile (Playwright)
- iPhone 12 Pro
- Pixel 5
- iPad Pro

### Tablet (Playwright)
- iPad Pro 11"

---

## Running Tests

```bash
# Run all tests
npm run test:all

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests (Primary - Playwright)
cd frontend && npm run test:e2e

# Run specific Playwright test
npx playwright test frontend/e2e/auth.spec.ts

# Run specific Playwright test file
npx playwright test frontend/e2e/smoke.spec.ts

# Run Jest unit/integration tests
npm run test:unit
```

---

## Test Results Summary (March 2026)

### Playwright E2E Tests (frontend/e2e/)
- **Passed**: 46 tests ✅
- **Failed**: 15 tests ⚠️
- **Total**: 61 tests

### Known Test Failures (Fixes Needed)
1. **Login form button clicks** - `nextjs-portal` overlay intercepts pointer events
2. **PIN input field** - Staff clock page selector needs updating
3. **Admin dashboard routing** - Element selectors need to match current UI
4. **Error handling tests** - Need better wait strategies
5. **Console errors** - Push notification API returns 500 errors

### Test Files Created (Cypress)
- `cypress/e2e/auth.cy.ts` - Authentication flows
- `cypress/e2e/orders-full.cy.ts` - Order management
- `cypress/e2e/timeclock.cy.ts` - Timeclock features
- `cypress/e2e/menu.cy.ts` - Menu management
- `cypress/e2e/staff.cy.ts` - Staff & scheduling
- `cypress/e2e/admin.cy.ts` - Admin & tablet/kitchen

---

## Test Maintenance

### When to Update Tests
- New feature implementation
- Bug fix that changes behavior
- UI/UX changes
- API endpoint changes
- New third-party integrations

### Test Review Checklist
- [ ] All critical paths covered
- [ ] Error states tested
- [ ] Empty states tested
- [ ] Loading states tested
- [ ] Responsive behavior verified
- [ ] Accessibility requirements met
- [ ] Performance benchmarks pass
