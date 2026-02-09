# Inventory Price Display Enhancement Plan

## Current State Analysis

The [`inventory.tsx`](frontend/pages/dashboard/inventory.tsx:1) page currently shows:

### Stats Cards (lines 434-518)
- Total Items
- Low Stock
- Well Stocked
- **Total Value** - Shows aggregate inventory value: `${totalInventoryValue.toFixed(2)}`

### Desktop Table Columns (lines 555-650)
- Item (name, SKU)
- Category
- Stock Level (qty + min threshold)
- **Unit Cost** (line 569, displayed at 611-612)
- Status
- Actions

### Mobile Cards (lines 653+)
- Item name + SKU + status badge
- Category
- Stock Level
- **Unit Cost** - needs verification

## Recommendation: YES, Show Extended Cost

**Extended Cost = Quantity × Unit Cost**

This is valuable because:
1. Shows the total dollar value tied up in each inventory item
2. Reinforces the Total Value stat card at the top
3. Helps managers prioritize reordering based on value, not just quantity
4. Matches what accountants call "extended price" on invoices

## Implementation Plan

### Step 1: Add Extended Cost Calculation

Add to `InventoryItem` interface or compute inline:
```typescript
const extendedCost = (item.on_hand_qty || 0) * (item.unit_cost || 0)
```

### Step 2: Desktop Table - Add Column

After "Unit Cost" column, add:

```tsx
<th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
  Extended Cost
</th>

<td className="px-6 py-4 whitespace-nowrap text-sm text-surface-900">
  ${extendedCost.toFixed(2)}
</td>
```

### Step 3: Mobile Cards - Add Row

After Unit Cost display, add:

```tsx
<div className="flex justify-between text-sm">
  <span className="text-surface-500">Extended Cost</span>
  <span className="font-medium text-surface-900">${extendedCost.toFixed(2)}</span>
</div>
```

### Step 4: Verify Total Value Calculation

Check that `totalInventoryValue` is calculated as:
```typescript
const totalInventoryValue = items.reduce((sum, item) => 
  sum + (item.on_hand_qty || 0) * (item.unit_cost || 0), 0
)
```

## Files to Modify

| File | Change |
|------|--------|
| `frontend/pages/dashboard/inventory.tsx` | Add extended cost column + mobile row |

## Testing Checklist

- [ ] Extended cost displays correctly (qty × unit_cost)
- [ ] Handles items with no unit_cost (shows $0.00 or "—")
- [ ] Mobile layout remains clean
- [ ] Total Value stat matches sum of extended costs
- [ ] Empty state shows appropriate message

## Example Output

| Item | Category | Stock | Unit Cost | **Extended Cost** | Status |
|------|----------|-------|-----------|-------------------|--------|
| Tomatoes | Produce | 50 lbs | $2.50/lb | **$125.00** | Good |
| Olive Oil | Pantry | 12 bottles | $15.00/bot | **$180.00** | Good |
| Salt | Pantry | 5 lbs | $1.00/lb | **$5.00** | Low |

## Summary

**Yes, you should add extended cost** to the inventory page. It provides immediate visibility into inventory investment per item and reinforces the Total Value metric already shown in the stats cards.
