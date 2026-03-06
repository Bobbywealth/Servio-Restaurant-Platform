# Page-by-Page QA Matrix

## Servio Restaurant Platform

---

## Public Pages

### 1. Homepage (`/`)
| Check | Status | Priority |
|-------|--------|----------|
| Hero section loads | ✅ | HIGH |
| Navigation works | ✅ | HIGH |
| CTA buttons functional | ✅ | HIGH |
| Responsive on mobile | ⚠️ | MEDIUM |
| No console errors | ⚠️ | HIGH |
| SEO meta tags | ✅ | MEDIUM |
| Performance (LCP < 2.5s) | ⚠️ | MEDIUM |

### 2. Login Page (`/login`)
| Check | Status | Priority |
|-------|--------|----------|
| Email input works | ✅ | HIGH |
| Password input works | ✅ | HIGH |
| Submit button works | ✅ | HIGH |
| Validation messages | ✅ | HIGH |
| Password visibility toggle | ✅ | MEDIUM |
| Link to signup | ✅ | MEDIUM |
| Error handling | ⚠️ | HIGH |
| Empty state handling | ✅ | MEDIUM |

### 3. Signup Page (`/signup`)
| Check | Status | Priority |
|-------|--------|----------|
| Form validation | ✅ | HIGH |
| Password strength | ⚠️ | MEDIUM |
| Email format check | ✅ | HIGH |
| Success redirect | ✅ | HIGH |
| Error handling | ⚠️ | HIGH |

---

## Dashboard Pages

### 4. Dashboard Home (`/dashboard`)
| Check | Status | Priority |
|-------|--------|----------|
| Stats cards load | ✅ | HIGH |
| Charts render | ⚠️ | MEDIUM |
| Recent orders list | ✅ | HIGH |
| Quick actions work | ✅ | MEDIUM |
| Responsive layout | ⚠️ | MEDIUM |
| Loading states | ❌ | HIGH |
| Empty states | ❌ | HIGH |

### 5. Orders Page (`/dashboard/orders`)
| Check | Status | Priority |
|-------|--------|----------|
| Order list displays | ✅ | HIGH |
| Status filters work | ✅ | HIGH |
| Search functionality | ✅ | HIGH |
| Pagination works | ✅ | HIGH |
| Order details modal | ✅ | HIGH |
| Status update flow | ✅ | HIGH |
| Empty state | ❌ | HIGH |
| Real-time updates | ⚠️ | HIGH |

### 6. Menu Management (`/dashboard/menu-management`)
| Check | Status | Priority |
|-------|--------|----------|
| Category list loads | ✅ | HIGH |
| Item list displays | ✅ | HIGH |
| Add item form works | ✅ | HIGH |
| Edit item works | ✅ | HIGH |
| Delete confirmation | ⚠️ | HIGH |
| Image upload | ⚠️ | MEDIUM |
| Availability toggle | ✅ | HIGH |
| Search/filter | ✅ | MEDIUM |
| Drag-drop reorder | ⚠️ | MEDIUM |

### 7. Staff Management (`/dashboard/staff`)
| Check | Status | Priority |
|-------|--------|----------|
| Staff list displays | ✅ | HIGH |
| Add staff form works | ✅ | HIGH |
| Edit staff works | ✅ | HIGH |
| PIN management | ⚠️ | HIGH |
| Role assignment | ✅ | HIGH |
| Deactivation flow | ✅ | HIGH |
| Bulk actions | ⚠️ | MEDIUM |
| Search functionality | ✅ | MEDIUM |
| Empty state | ❌ | HIGH |

### 8. Timeclock (`/dashboard/timeclock`)
| Check | Status | Priority |
|-------|--------|----------|
| Current shift displays | ✅ | HIGH |
| Clock in button works | ✅ | HIGH |
| Clock out button works | ✅ | HIGH |
| Break handling | ✅ | HIGH |
| Stats display | ✅ | MEDIUM |
| History list | ✅ | HIGH |
| Manager override | ⚠️ | HIGH |
| PIN entry | ✅ | HIGH |
| Real-time updates | ⚠️ | HIGH |

### 9. Staff Scheduling (`/dashboard/schedule`)
| Check | Status | Priority |
|-------|--------|----------|
| Calendar view loads | ✅ | HIGH |
| Week view loads | ✅ | HIGH |
| Create shift works | ✅ | HIGH |
| Edit shift works | ✅ | HIGH |
| Delete shift works | ✅ | HIGH |
| Publish schedule | ✅ | HIGH |
| Staff assignment | ✅ | HIGH |
| Template management | ⚠️ | MEDIUM |
| Conflict detection | ⚠️ | MEDIUM |

### 10. Inventory (`/dashboard/inventory`)
| Check | Status | Priority |
|-------|--------|----------|
| Item list displays | ✅ | HIGH |
| Add item form works | ✅ | HIGH |
| Stock adjustment | ✅ | HIGH |
| Low stock alerts | ⚠️ | HIGH |
| Receipt scanning | ⚠️ | MEDIUM |
| Search/filter | ✅ | MEDIUM |
| Categories work | ✅ | MEDIUM |
| Export functionality | ⚠️ | MEDIUM |

### 11. Marketing (`/dashboard/marketing`)
| Check | Status | Priority |
|-------|--------|----------|
| Campaign list displays | ✅ | HIGH |
| Create campaign works | ✅ | HIGH |
| SMS sending | ⚠️ | HIGH |
| Customer list | ✅ | HIGH |
| Analytics display | ⚠️ | MEDIUM |
| Template management | ⚠️ | MEDIUM |

### 12. Settings (`/dashboard/settings`)
| Check | Status | Priority |
|-------|--------|----------|
| Profile settings load | ✅ | HIGH |
| Restaurant settings | ✅ | HIGH |
| Notification prefs | ✅ | MEDIUM |
| API keys management | ⚠️ | HIGH |
| Theme settings | ✅ | MEDIUM |
| Save changes works | ✅ | HIGH |

### 13. AI Assistant (`/dashboard/assistant`)
| Check | Status | Priority |
|-------|--------|----------|
| Chat interface loads | ✅ | HIGH |
| Message sending works | ✅ | HIGH |
| Voice input works | ⚠️ | HIGH |
| Response rendering | ✅ | HIGH |
| History persistence | ⚠️ | MEDIUM |
| Error handling | ⚠️ | HIGH |

---

## Admin Pages

### 14. Admin Dashboard (`/admin`)
| Check | Status | Priority |
|-------|--------|----------|
| Stats overview | ✅ | HIGH |
| Restaurant list | ✅ | HIGH |
| Platform analytics | ⚠️ | MEDIUM |
| Quick actions | ✅ | HIGH |

### 15. Admin Orders (`/admin/orders`)
| Check | Status | Priority |
|-------|--------|----------|
| Multi-restaurant view | ✅ | HIGH |
| Status management | ✅ | HIGH |
| Filtering works | ✅ | HIGH |
| Bulk actions | ⚠️ | MEDIUM |

### 16. Admin Restaurants (`/admin/restaurants`)
| Check | Status | Priority |
|-------|--------|----------|
| Restaurant list | ✅ | HIGH |
| Create restaurant | ✅ | HIGH |
| Edit restaurant | ✅ | HIGH |
| Settings management | ✅ | HIGH |
| Status toggle | ✅ | HIGH |

---

## Tablet Pages

### 17. Tablet Orders (`/tablet/orders`)
| Check | Status | Priority |
|-------|--------|----------|
| Order queue displays | ✅ | HIGH |
| New order alerts | ✅ | HIGH |
| Status update flow | ✅ | HIGH |
| Order details view | ✅ | HIGH |
| Sound notifications | ⚠️ | HIGH |
| Responsive on tablet | ✅ | HIGH |
| Touch-friendly | ✅ | HIGH |

### 18. Tablet Kitchen Display (`/tablet/kitchen`)
| Check | Status | Priority |
|-------|--------|----------|
| Order queue displays | ✅ | HIGH |
| Timer display | ✅ | HIGH |
| Status update buttons | ✅ | HIGH |
| Sound alerts | ⚠️ | HIGH |
| Large touch targets | ✅ | HIGH |

---

## Mobile/PWA Pages

### 19. Staff Clock PWA (`/staff/clock`)
| Check | Status | Priority |
|-------|--------|----------|
| Clock in works | ✅ | HIGH |
| Clock out works | ✅ | HIGH |
| PIN entry works | ✅ | HIGH |
| Responsive on mobile | ✅ | HIGH |
| Works offline | ⚠️ | MEDIUM |
| Push notifications | ⚠️ | MEDIUM |

---

## API Endpoints (Backend)

### Authentication
| Endpoint | Method | Status | Priority |
|----------|--------|--------|----------|
| `/api/auth/login` | POST | ✅ | HIGH |
| `/api/auth/signup` | POST | ✅ | HIGH |
| `/api/auth/refresh` | POST | ✅ | HIGH |
| `/api/auth/logout` | POST | ✅ | HIGH |

### Orders
| Endpoint | Method | Status | Priority |
|----------|--------|--------|----------|
| `/api/orders` | GET | ✅ | HIGH |
| `/api/orders` | POST | ✅ | HIGH |
| `/api/orders/:id` | GET | ✅ | HIGH |
| `/api/orders/:id/status` | POST | ✅ | HIGH |
| `/api/orders/:id` | PUT | ✅ | HIGH |
| `/api/orders/:id` | DELETE | ✅ | HIGH |

### Menu
| Endpoint | Method | Status | Priority |
|----------|--------|--------|----------|
| `/api/menu/categories` | GET | ✅ | HIGH |
| `/api/menu/categories` | POST | ✅ | HIGH |
| `/api/menu/items` | GET | ✅ | HIGH |
| `/api/menu/items` | POST | ✅ | HIGH |
| `/api/menu/items/:id` | PUT | ✅ | HIGH |
| `/api/menu/items/:id` | DELETE | ✅ | HIGH |

### Staff
| Endpoint | Method | Status | Priority |
|----------|--------|--------|----------|
| `/api/staff` | GET | ✅ | HIGH |
| `/api/staff` | POST | ✅ | HIGH |
| `/api/staff/:id` | PUT | ✅ | HIGH |
| `/api/staff/:id` | DELETE | ✅ | HIGH |

### Timeclock
| Endpoint | Method | Status | Priority |
|----------|--------|--------|----------|
| `/api/timeclock/clock-in` | POST | ✅ | HIGH |
| `/api/timeclock/clock-out` | POST | ✅ | HIGH |
| `/api/timeclock/start-break` | POST | ✅ | HIGH |
| `/api/timeclock/end-break` | POST | ✅ | HIGH |
| `/api/timeclock/entries` | GET | ✅ | HIGH |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Tested & Working |
| ⚠️ | Needs Improvement |
| ❌ | Not Tested / Missing |
| HIGH | Critical for Launch |
| MEDIUM | Important for UX |

---

## Priority Test Focus Areas

### Must Pass Before Production (Critical)

1. **Order Flow**: Create order → Update status → Complete
2. **Authentication**: Login → Protected routes → Logout
3. **Staff Clock**: Clock in → Work → Clock out → Calculate hours
4. **Menu Management**: Add category → Add item → Toggle availability
5. **Tablet Display**: New order → Show in queue → Update status

### Should Pass Before Production (High)

1. All admin CRUD operations
2. Inventory tracking flow
3. Marketing campaign creation
4. Settings save functionality
5. Error handling and empty states

### Nice to Have (Medium)

1. Performance optimization
2. Accessibility improvements
3. Advanced search/filter
4. Bulk operations
5. Export functionality
