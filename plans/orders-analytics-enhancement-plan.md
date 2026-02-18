# Orders Page Analytics Enhancement Plan

## Overview
Add comprehensive analytics to the `/dashboard/orders` page so users can see stats and previous orders at a glance.

## Current State

### Existing Features
- **OrderAnalytics component** ([`frontend/components/OrderAnalytics.tsx`](frontend/components/OrderAnalytics.tsx)) - Full analytics panel
- **Backend API** ([`/api/orders/analytics`](src/routes/orders.ts:354)) - Comprehensive analytics endpoint
- **Toggle button** - Currently hidden behind "Show Analytics" button

### What the existing analytics includes:
- Revenue metrics (today, yesterday, week, month)
- Order counts by period
- Average order value
- Completion rate
- Cancellation rate
- Orders by status breakdown
- Orders by channel breakdown
- Hourly distribution chart
- Top selling items
- Recent orders table

## Proposed Changes

### 1. Dashboard Orders Page (`/dashboard/orders`)

#### A. Always-visible Summary Cards
Add a row of quick stat cards at the top that are always visible:

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Today's    │ │  Active     │ │  Avg Order  │ │  Completion │
│  Revenue    │ │  Orders     │ │  Value      │ │  Rate       │
│  $2,456     │ │  12         │ │  $32.45     │ │  94.2%      │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

#### B. Show Analytics by Default
Change `showAnalytics` initial state from `false` to `true`

#### C. Add Recent Orders Preview
Show last 5 orders below the summary cards with quick access to details

### 2. Admin Orders Page (`/admin/orders`)

#### A. Platform-wide Analytics Section
Add analytics cards showing:
- Total platform revenue (filtered by time window)
- Total orders across all restaurants
- Orders by restaurant breakdown
- Top performing restaurants

#### B. Visual Charts
- Bar chart: Orders by restaurant
- Pie chart: Orders by channel
- Line chart: Order trends over time

## Implementation Steps

### Phase 1: Dashboard Orders Enhancement

1. **Modify** [`frontend/pages/dashboard/orders.tsx`](frontend/pages/dashboard/orders.tsx)
   - Add always-visible summary cards component
   - Change `showAnalytics` default to `true`
   - Add recent orders preview section

2. **Enhance** [`frontend/components/OrderAnalytics.tsx`](frontend/components/OrderAnalytics.tsx)
   - Add comparison metrics (vs yesterday, vs last week)
   - Improve visual presentation

### Phase 2: Admin Orders Enhancement

3. **Create** platform analytics component for admin
   - New component: `frontend/components/AdminOrderAnalytics.tsx`
   - Fetch from `/api/admin/orders/stats` (needs creation)

4. **Add backend endpoint** in [`src/routes/admin.ts`](src/routes/admin.ts)
   - `GET /api/admin/orders/stats` - Platform-wide order statistics

### Phase 3: Polish & Testing

5. **Add loading states** and error handling
6. **Test** all analytics functionality
7. **Push** changes to git

## Technical Details

### New API Endpoint: `/api/admin/orders/stats`

```typescript
// Response structure
{
  totalRevenue: number,
  totalOrders: number,
  avgOrderValue: number,
  completedOrders: number,
  cancelledOrders: number,
  pendingOrders: number,
  ordersByChannel: Record<string, number>,
  ordersByStatus: Record<string, number>,
  topRestaurants: Array<{
    name: string,
    orderCount: number,
    revenue: number
  }>
}
```

### Summary Cards Component

```tsx
// Quick stats shown at top of orders page
interface SummaryCardsProps {
  todayRevenue: number;
  activeOrders: number;
  avgOrderValue: number;
  completionRate: number;
  isLoading?: boolean;
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/pages/dashboard/orders.tsx` | Add summary cards, show analytics by default |
| `frontend/components/OrderAnalytics.tsx` | Enhance with comparison metrics |
| `frontend/pages/admin/orders/index.tsx` | Add platform analytics section |
| `src/routes/admin.ts` | Add `/api/admin/orders/stats` endpoint |

## Mockup

### Dashboard Orders Page (New Layout)

```
┌──────────────────────────────────────────────────────────────────┐
│ Orders                                            [Test] [Refresh]│
├──────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│ │ Revenue  │ │ Active   │ │ Avg      │ │ Complete │              │
│ │ $2,456   │ │ 12       │ │ $32.45   │ │ 94.2%    │              │
│ │ +12%     │ │ orders   │ │ per ord  │ │ rate     │              │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
├──────────────────────────────────────────────────────────────────┤
│ [BarChart] Order Analytics                    [Hide Analytics]   │
│ ┌─────────────────────────────────────────────────────────────┐  │
│ │ Revenue: $2,456 (Today)  Orders: 67  Avg: $32.45           │  │
│ │                                                             │  │
│ │ Orders by Status          Orders by Channel                 │  │
│ │ ████████ Completed 142    ██████ Phone 45                   │  │
│ │ █ Preparing 4             ████ VAPI 38                      │  │
│ │ ██ Ready 2                █████ Online 52                   │  │
│ │                                                           │  │
│ │ Hourly Distribution                                         │  │
│ │ ▁▂▃▅▇█▇▅▃▂▁                                                │  │
│ │ 6 8 10 12 14 16 18 20                                       │  │
│ └─────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────┤
│ Recent Orders                                                    │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ #ORD-001  John D.    Phone    $45.99  Completed  2:30 PM  │   │
│ │ #ORD-002  Sarah M.   VAPI     $28.50  Preparing  2:25 PM  │   │
│ │ #ORD-003  Mike R.    Online   $67.25  Ready      2:20 PM  │   │
│ └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Success Criteria

- [ ] Summary cards visible immediately on page load
- [ ] Analytics panel shown by default
- [ ] Recent orders preview available
- [ ] Admin orders page has platform-wide stats
- [ ] All data refreshes in real-time via socket
- [ ] Mobile responsive design
