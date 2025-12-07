# Manual Discount Field Added to Job Items

## Overview

Job items now have a visible **Discount** field, allowing users to manually enter discounts whether using a pricing template or not.

---

## New Item Form Layout

### 5-Column Layout:

```
┌──────────────────────────────────────────────────────────────────┐
│ Item 1                                                           │
├──────────────────────────────────────────────────────────────────┤
│ Select Pricing Template: [Premium Cards - Business Cards ▼]     │
│                                                                  │
│ Category: [Business Cards ▼] *  ← If no template               │
│                                                                  │
│ Description: [Full color, glossy___] *                          │
│                                                                  │
│ Quantity | Unit Price | Discount   | Total                      │
│ [500]    | GHS [4.00] | GHS [200] | GHS 1,800.00               │
│    ↑          ↑           ↑ NEW!        ↑                       │
│  How many   Price     Manual or      Calculated                 │
│                       auto-filled                                │
│                                                                  │
│                                      [Remove Item]               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Field Breakdown

### 1. **Quantity** (Required)
- How many units
- Min: 1
- Triggers template discount if applicable

### 2. **Unit Price** (Required)
- Price per unit
- Auto-filled from template
- Editable

### 3. **Discount** (Optional) **← NEW!**
- Manual discount amount
- Auto-filled from template if quantity qualifies
- **Editable** - can override template discount
- Default: 0.00

### 4. **Total** (Calculated)
- Formula: (Quantity × Unit Price) - Discount
- Updates in real-time
- Display only

---

## Discount Behavior

### Scenario 1: Using Template with Discount Tiers

**Template:**
```
Premium Business Cards
  Price: GHS 4.00/unit
  Discount Tier: 500+ = 10% off
```

**User Input:**
```
Quantity: 500
  ↓ Triggers discount calculation
Unit Price: GHS 4.00 (from template)
Discount: GHS 200.00 (auto-calculated: 500 × 4 × 10%)
         ↑ Auto-filled but EDITABLE!
Total: GHS 1,800.00
```

**User can:**
- Accept auto discount: GHS 200.00 ✅
- Increase discount: Change to GHS 250.00 ✅
- Remove discount: Change to GHS 0.00 ✅

---

### Scenario 2: Manual Entry (No Template)

**User Input:**
```
Category: [Color Printing ▼]  ← Selects manually
Description: [T-Shirt printing]
Quantity: 20
Unit Price: GHS 30.00
Discount: GHS 100.00  ← Enters manually
         ↑ Can give custom discount!
Total: GHS 500.00  (600 - 100)
```

**Flexibility:** Full control over pricing and discounts!

---

### Scenario 3: Template Without Discounts

**Template:**
```
Standard Flyers
  Price: GHS 0.50/unit
  No discount tiers
```

**User Input:**
```
Quantity: 100
Unit Price: GHS 0.50 (from template)
Discount: GHS 0.00 (no auto-discount)
         ↑ Can add manual discount if needed!
Total: GHS 50.00
```

**User can still add:** Custom discount of GHS 5.00 for loyalty, etc.

---

## Column Widths

```
┌────────┬─────────────┬──────────┬─────────┐
│ Qty    │ Unit Price  │ Discount │ Total   │
│ (25%)  │ (25%)       │ (25%)    │ (25%)   │
├────────┼─────────────┼──────────┼─────────┤
│ [500]  │ GHS [4.00] │ GHS [200]│ GHS 1,800│
└────────┴─────────────┴──────────┴─────────┘

Each column: span={6} (out of 24) = 25% width
```

---

## Real-Time Calculation

### Formula:
```javascript
Subtotal = Quantity × Unit Price
Total = Subtotal - Discount

Example:
Quantity: 500
Unit Price: GHS 4.00
Discount: GHS 200.00

Calculation:
Subtotal: 500 × 4.00 = GHS 2,000.00
Total: 2,000.00 - 200.00 = GHS 1,800.00 ✅
```

### Live Updates:
- Change quantity → Total recalculates
- Change price → Total recalculates
- Change discount → Total recalculates
- **Instant feedback!**

---

## Invoice Integration

### Job Item with Discount:
```javascript
{
  description: "Full color, glossy",
  category: "Business Cards",
  quantity: 500,
  unitPrice: 4.00,
  discountAmount: 200.00,
  total: 1800.00
}
```

### Auto-Generated Invoice:
```
INVOICE #INV-202511-0009

Description          Qty   Unit Price    Amount
Business Cards       500   GHS 4.00      GHS 2,000.00
  Full color, glossy

                          Subtotal:      GHS 2,000.00
                          Discount:      -GHS  200.00  ✅
                          Item discounts applied
                          ─────────────────────────────
                          Total Amount:  GHS 1,800.00  ✅
```

**Discount transfers perfectly!**

---

## Use Cases

### Use Case 1: Volume Discount (Template)
```
Template: 500+ units = 10% off
User enters: 500 units
System auto-fills: GHS 200 discount
User can: Accept or adjust
```

### Use Case 2: Loyalty Discount (Manual)
```
No template selected
User enters: 100 units @ GHS 5.00
User adds: GHS 50 loyalty discount
Total: GHS 450 (instead of GHS 500)
```

### Use Case 3: Early Payment Discount
```
Template pricing used
User adds: GHS 100 early payment discount
On top of template discount
Total discounts stack!
```

### Use Case 4: No Discount
```
Leave discount field at: GHS 0.00
Total = Quantity × Price
Simple!
```

---

## Comparison

| Aspect | Before | After |
|--------|--------|-------|
| **Columns** | 3 (Qty, Price, Total) | 4 (Qty, Price, Discount, Total) |
| **Discount Entry** | Hidden | Visible & editable |
| **Template Discount** | Auto (not editable) | Auto but editable |
| **Manual Discount** | Not possible | Fully supported |
| **Flexibility** | Limited | Full control |

---

## Visual Layout

### Complete Item Form:

```
┌────────────────────────────────────────────────────────┐
│ Item 1                                                 │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Select Pricing Template (Optional):                   │
│ [Premium Cards - Business Cards (GHS 4.00/unit) ▼]   │
│                                                        │
│ Item Description: *                                    │
│ [Full color, double-sided, glossy finish________]     │
│                                                        │
│ Quantity | Unit Price  | Discount   | Total           │
│ [500]    | GHS [4.00] | GHS [200] | GHS 1,800.00     │
│          |            | ↑ Editable!|                  │
│                                                        │
│                                   [Remove Item]        │
└────────────────────────────────────────────────────────┘
```

---

## Benefits

### For Sales Team:
- ✅ **Template discounts** - Auto-apply from rules
- ✅ **Manual override** - Adjust as needed
- ✅ **Custom discounts** - Loyalty, early payment, etc.
- ✅ **Full control** - Final say on pricing

### For Customers:
- ✅ **Transparency** - See discount clearly
- ✅ **Accuracy** - Correct calculations
- ✅ **Trust** - Discounts honored

### For Business:
- ✅ **Flexibility** - Handle any discount scenario
- ✅ **Tracking** - All discounts recorded
- ✅ **Reporting** - See total discounts given

---

## Files Modified

1. ✅ **`Frontend/src/pages/Jobs.jsx`**
   - Changed columns from span={8} to span={6}
   - Added visible Discount field (col 3 of 4)
   - Removed duplicate hidden discountAmount field
   - Kept hidden discountPercent and discountReason

---

## Summary

### Added:
- ✅ **Discount column** visible in item form
- ✅ **Editable field** - manual or auto-filled
- ✅ **Real-time calculation** - total updates instantly

### Result:

| Field | Width | Purpose |
|-------|-------|---------|
| **Quantity** | 25% | How many units |
| **Unit Price** | 25% | Price per unit |
| **Discount** | 25% | Manual or auto discount |
| **Total** | 25% | Calculated result |

**Perfect balance! All 4 columns equal width!**

**Status:** ✅ Complete! Users can now enter discounts manually or accept auto-calculated ones!

**Try it:** Create a job item and enter a discount amount - it will reflect in the total and on the invoice! 🎉


