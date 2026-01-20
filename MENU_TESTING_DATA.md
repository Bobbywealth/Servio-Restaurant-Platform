# Menu Testing Data - Summary

## Overview
Added comprehensive menu items with modifiers and add-ons for testing the Servio Restaurant Platform.

## 📊 Menu Statistics

### Categories (6 total)
- **Appetizers**: 6 items
- **Entrees**: 12 items  
- **Sides**: 10 items
- **Desserts**: 5 items
- **Beverages**: 7 items
- **Voice Specials**: 4 items

**Total Menu Items**: 44

### Modifiers (11 groups, 53 options total)
- **Spice Level**: 4 options (Mild, Medium, Hot, Fire)
- **Protein Choice**: 6 options (Various chicken, goat, pork, oxtail)
- **Side Selections**: 7 options (Rice, plantains, vegetables, etc.)
- **Extra Protein**: 4 options ($5-$8 add-ons)
- **Extra Sides**: 6 options ($2.50-$3 add-ons)
- **Sauce Options**: 5 options (Jerk, curry, gravy, etc.)
- **Drink Size**: 3 options (Small, Medium, Large)
- **Add Ice**: 4 options (None, Light, Regular, Extra)
- **Special Instructions**: 6 options (No onions, extra veg, etc.)
- **Toppings**: 5 options (For desserts)
- **Combo Upgrade**: 3 options (Add drink, sides, desserts)

**Total Modifier Links**: 111 (modifiers assigned to menu items)

## 🍽️ Sample Menu Items

### Appetizers
- Jamaican Beef Patty ($4.99)
- Festival ($3.99)
- Ackee Fritters ($6.99)
- Saltfish Fritters ($7.99)
- Jerk Chicken Wings ($9.99)
- Plantain Chips ($5.99)

### Entrees
- Curry Goat ($18.99) ⭐
- Jerk Chicken ($16.99) ⭐
- Brown Stew Chicken ($15.99)
- Oxtail ($22.99)
- Curry Chicken ($15.99)
- Escovitch Fish ($19.99)
- Ackee and Saltfish ($17.99)
- Stew Peas ($16.99)
- Jerk Pork ($17.99)
- Pepper Steak ($19.99)

### Sides
- Rice and Peas ($4.99)
- White Rice ($3.99)
- Fried Plantains ($4.99)
- Steamed Vegetables ($4.99)
- Mac and Cheese ($5.99)
- Cabbage ($4.99)
- Callaloo ($5.99)
- Boiled Dumplings ($3.99)
- Fried Dumplings ($4.99)
- Coleslaw ($3.99)

### Desserts
- Rum Cake ($6.99)
- Sweet Potato Pudding ($5.99)
- Grater Cake ($4.99)
- Banana Fritters ($5.99)
- Coconut Drops ($4.99)

### Beverages
- Sorrel Drink ($4.99)
- Ginger Beer ($4.99)
- Carrot Juice ($5.99)
- Pineapple Ginger Juice ($5.99)
- Fruit Punch ($5.99)
- Jamaican Cola Champagne ($2.99)
- Ting Grapefruit Soda ($2.99)

### Voice Specials
- Baby Special Plate ($19.50) - Combo plate
- Family Feast ($69.99) - Serves 4
- Lunch Special ($14.99) - Customizable
- Seafood Combo ($24.99)

## 🔧 Modifier Assignment Logic

### Entrees
All entrees have:
- Spice Level (required)
- Extra Protein (optional)
- Extra Sides (optional)
- Sauce Options (optional)
- Special Instructions (optional)
- Combo Upgrade (optional)

### Beverages
Fresh juices have:
- Drink Size (required for non-canned drinks)
- Add Ice (optional)

### Desserts
All desserts have:
- Toppings (optional)

### Appetizers
Spicy appetizers (Jerk items, Patties) have:
- Spice Level (required)
- Sauce Options (optional)

### Voice Specials
- **Lunch Special**: Gets Protein Choice + Side Selections (build-your-own)
- **Other Specials**: Standard entree modifiers

## 🚀 Running the Seed Scripts

### Seed Menu Items Only
```bash
cd backend
npm run seed:menu
```

### Seed Modifiers Only
```bash
cd backend
npm run seed:modifiers
```

### Seed Everything
```bash
cd backend
npm run seed:all
```

### Manual Execution
```bash
cd backend
npx tsx src/scripts/seed-menu-items.ts
npx tsx src/scripts/seed-modifiers.ts
```

## 📝 Features Included

### Menu Items Include:
- ✅ Name and description
- ✅ Pricing (retail price + cost)
- ✅ Category assignment
- ✅ Preparation time estimates
- ✅ Allergen information
- ✅ Availability flags
- ✅ Sort ordering

### Modifiers Include:
- ✅ Min/max selection constraints
- ✅ Required vs optional flags
- ✅ Price modifiers (add-on costs)
- ✅ Descriptions
- ✅ Sort ordering
- ✅ Availability flags

### Smart Linking:
- ✅ Contextual modifier assignment based on item type
- ✅ Different modifiers for different categories
- ✅ Customizable combo options
- ✅ Upsell opportunities (combos, extras)

## 🧪 Testing Scenarios

### Voice Ordering Testing
1. **Lunch Special** - Tests protein choice + side selection (required modifiers)
2. **Entrees** - Tests spice level + optional add-ons
3. **Beverages** - Tests size selection + ice preference
4. **Combos** - Tests upselling with combo upgrades

### Menu Management Testing
1. Toggle item availability (86 items)
2. Price adjustments with modifiers
3. Category organization
4. Search and filtering

### Order Flow Testing
1. Required modifiers validation
2. Min/max selection enforcement
3. Price calculation with modifiers
4. Special instructions handling

## 🎯 Key Testing Points

1. **Required Modifiers**: Spice Level on entrees, Protein Choice on Lunch Special
2. **Optional Add-ons**: Extra protein, extra sides, sauces
3. **Price Modifiers**: Test calculations with various combinations
4. **Min/Max Constraints**: Side Selections (must pick exactly 2)
5. **Upselling**: Combo upgrades, extra toppings

## 📱 API Endpoints to Test

- `GET /api/menu/items/full` - Full menu with categories
- `GET /api/menu/items/:id/modifiers` - Modifiers for specific item
- `GET /api/menu/modifier-groups` - All modifier groups
- `GET /api/menu/public/:slug` - Public menu (for ordering)
- `POST /api/orders` - Create order with modifiers

## 💡 Notes

- All items include realistic Jamaican restaurant menu items
- Prices include both retail price and cost for profit margin calculations
- Allergen information included for dietary restrictions
- Preparation times set for kitchen workflow simulation
- Modifier pricing designed to test various scenarios (free options, small add-ons, significant upgrades)
