# Discount Display Guide

## How Discounts Appear on Quotes & Invoices

---

## Quote with Line-Item Discounts

### Before (Old System):
```
QUOTATION                           Quote #: QT-00123
─────────────────────────────────────────────────────

Description          Qty  Unit Price   Discount    Total
Business Cards       500  GHS 4.00     GHS 200.00  GHS 1,800.00
Flyers              1000  GHS 0.50     GHS 0.00    GHS   500.00

                                      Subtotal:    GHS 2,300.00
                                      Discount:    -GHS  200.00
                                      Total:       GHS 2,100.00
```

### After (Enhanced System):
```
QUOTATION                           Quote #: QT-00123
─────────────────────────────────────────────────────

Description          Qty  Unit Price   Discount           Total
Business Cards       500  GHS 4.00     -GHS 200.00        GHS 1,800.00
                                      (10% off)
                                      Volume discount

Flyers              1000  GHS 0.50     -                  GHS   500.00

                                      Subtotal:          GHS 2,300.00
                                      Total Discount:    -GHS  200.00  ✓ Green
                                      Volume discount 10%
                                      ─────────────────────────────────
                                      Total:             GHS 2,100.00
```

**Key Improvements:**
- Discount column shows `-` when no discount
- Discount amount in green with minus sign
- Percentage shown below amount
- Reason explains the discount
- Total discount section highlighted

---

## Invoice with Discount

### Enhanced Invoice Display:
```
INVOICE                                    Invoice #: INV-00456
Date: January 15, 2025                     Due: February 14, 2025
──────────────────────────────────────────────────────────────────

Bill To:
Acme Corporation
123 Business St
Accra, Ghana

Description                    Quantity  Unit Price    Amount
──────────────────────────────────────────────────────────────────
Business Cards (Full Color)    1,000     GHS 3.50      GHS 3,500.00
Flyers (A5)                     5,000     GHS 0.45      GHS 2,250.00
Posters (A2)                      100     GHS 25.00     GHS 2,500.00


                                          Subtotal:     GHS 8,250.00
                                          Tax (12.5%):  GHS 1,031.25

                                          Discount (10%): -GHS 825.00  ✓ Green
                                          Volume discount for
                                          bulk order

                                          ─────────────────────────────
                                          Total Amount: GHS 8,456.25

                                          Amount Paid:  GHS 0.00
                                          Balance Due:  GHS 8,456.25
```

**Features:**
- Discount percentage in parentheses
- Amount in green with minus
- Reason on next line in smaller gray text
- Clear savings visualization

---

## Visual Styling Guide

### Color Scheme:
```css
/* Discount amount */
color: #52c41a;           /* Green - indicates savings */
font-weight: 500;         /* Medium weight */

/* Discount percentage */
font-size: 9px;          /* Smaller */
color: #666;             /* Gray */

/* Discount reason */
font-size: 10px;         /* Small */
color: #666;             /* Gray */
font-style: italic;      /* Italic */
```

### Layout Example:
```
┌─────────────────────────────────────────┐
│ Discount (10%)       -GHS 825.00   ← Green, Bold
│   Volume discount for bulk order   ← Gray, Small
└─────────────────────────────────────────┘
```

---

## Print Preview Examples

### Example 1: No Discount
```
Subtotal:               GHS 1,500.00
Tax (12.5%):           GHS   187.50
────────────────────────────────────
Total Amount:           GHS 1,687.50
```

### Example 2: Percentage Discount
```
Subtotal:               GHS 5,000.00
Tax (12.5%):           GHS   625.00
Discount (15%):        -GHS  750.00  ✓ Green
  Returning customer
────────────────────────────────────
Total Amount:           GHS 4,875.00
```

### Example 3: Fixed Amount Discount
```
Subtotal:               GHS 3,200.00
Tax (12.5%):           GHS   400.00
Discount:              -GHS  200.00  ✓ Green
  Early payment discount
────────────────────────────────────
Total Amount:           GHS 3,400.00
```

---

## Mobile Display

On smaller screens, discount reasons wrap gracefully:

```
┌───────────────────────────────┐
│ Subtotal:      GHS 5,000.00  │
│ Discount (10%): -GHS 500.00  │
│   Volume discount             │
│   (100+ units)                │
│ ──────────────────────────── │
│ Total:         GHS 4,500.00  │
└───────────────────────────────┘
```

---

## API Response Format

### Quote Item with Discount:
```json
{
  "id": "item-uuid",
  "description": "Business Cards - Full Color",
  "quantity": 500,
  "unitPrice": "4.00",
  "discountAmount": "200.00",
  "discountPercent": 10,
  "discountReason": "Volume discount (500+ units)",
  "total": "1800.00"
}
```

### Invoice with Discount:
```json
{
  "invoiceNumber": "INV-00123",
  "subtotal": "5000.00",
  "taxRate": "12.5",
  "taxAmount": "625.00",
  "discountType": "percentage",
  "discountValue": "10",
  "discountAmount": "500.00",
  "discountReason": "Volume discount 10%",
  "totalAmount": "5125.00"
}
```

---

## Customer-Facing Benefits

### What Customers See:

**1. Clear Savings:**
```
Your savings: GHS 825.00 (10% off)
Reason: Volume discount for orders over 500 units
```

**2. Incentive to Buy More:**
```
Current order (400 units): GHS 1,600.00
Order 500 units and save 10%: GHS 1,800.00
                              (-GHS 200.00 discount)
```

**3. Trust Through Transparency:**
```
✓ Discount automatically applied
✓ Clear explanation provided
✓ Savings highlighted
```

---

## Admin View

### Dashboard Discount Report:
```
Total Discounts Given This Month:
┌─────────────────────────────────────────┐
│ Volume Discounts:     GHS 15,250.00    │
│ Loyalty Discounts:    GHS  3,500.00    │
│ Early Payment:        GHS  1,200.00    │
│ ──────────────────────────────────────  │
│ Total:                GHS 19,950.00    │
└─────────────────────────────────────────┘

Average Discount Rate: 8.5%
Most Common: "Volume discount (500+ units = 10% off)"
```

---

## Summary

### What Changed:

| Feature | Before | After |
|---------|--------|-------|
| **Discount Display** | Just amount | Amount + % + Reason |
| **Color** | Black | Green (savings) |
| **Clarity** | "Discount: GHS 200" | "Discount (10%): -GHS 200<br>Volume discount" |
| **Line Items** | No details | Shows per-item discounts |
| **Transparency** | Limited | Full explanation |

### Result:
- More professional appearance
- Better customer understanding
- Encourages larger orders
- Clearer accounting trail
- Builds trust

**Your quotes and invoices now show discounts like a premium e-commerce platform!**

