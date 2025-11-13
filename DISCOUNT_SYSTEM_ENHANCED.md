# Enhanced Discount System

## Overview

Your pricing and discount system now automatically calculates discounts from pricing templates and displays them prominently on quotes and invoices with detailed descriptions.

---

## Key Features

### 1. **Automatic Discount Calculation**
When using the pricing calculator API, discounts are automatically applied based on quantity tiers and returned with full details.

### 2. **Discount Transparency**
Discounts are shown with:
- Amount saved (e.g., "GHS 150.00")
- Percentage off (e.g., "10% off")
- Reason/description (e.g., "Volume discount (100+ units = 10% off)")

### 3. **Line-Item Discounts**
Each quote item can have its own discount with percentage and reason displayed.

### 4. **Total Discount Display**
Quote and invoice totals show aggregate discount savings clearly.

---

## Database Structure

### New Fields Added:

#### **Invoices Table:**
```sql
discountReason VARCHAR(255) -- "Volume discount 10%" or "Early payment discount"
```

#### **Quotes Table:**
```sql
discountReason VARCHAR(255) -- "Bulk order savings"
```

#### **Quote_Items Table:**
```sql
discountAmount DECIMAL(10,2)   -- Existing: amount of discount
discountPercent DECIMAL(5,2)   -- NEW: percentage (e.g., 10.00 for 10%)
discountReason VARCHAR(255)    -- NEW: "100+ units = 10% off"
```

---

## API Enhancements

### Pricing Calculator API

**Endpoint:** `POST /api/pricing/calculate`

**Request:**
```json
{
  "jobType": "Business Card",
  "paperType": "Gloss",
  "paperSize": "Standard",
  "colorType": "Full Color",
  "quantity": 500,
  "additionalOptions": ["Lamination"]
}
```

**Enhanced Response:**
```json
{
  "success": true,
  "data": {
    "calculatedPrice": "2850.00",
    "quantity": 500,
    "breakdown": {
      "basePrice": "1000.00",
      "unitPrice": "4.00",          // 500 × GHS 4/unit = 2000
      "setupFee": "200.00",
      "additionalOptions": "150.00", // Lamination
      "subtotal": "3350.00",
      "discount": {
        "amount": "335.00",          // 10% off
        "percentage": 10,
        "reason": "Volume discount (500+ units = 10% off)"
      },
      "finalPrice": "2850.00"        // 3350 - 335 - 150
    },
    "appliedDiscount": {
      "type": "quantity",
      "tier": {
        "minQuantity": 500,
        "maxQuantity": 999,
        "discountPercent": 10
      },
      "percentage": 10,
      "amount": "335.00",
      "reason": "Volume discount (500+ units = 10% off)"
    }
  }
}
```

---

## Frontend Display

### Quote Receipt Example:

```
┌──────────────────────────────────────────────────────────────┐
│ QUOTATION                                  Quote #: QT-00123 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Items:                                                       │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Description        Qty  Unit Price  Discount  Total    │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ Business Cards     500  GHS 4.00    -GHS 200.00        │ │
│ │                                     (10% off)          │ │
│ │                                     Volume discount    │ │
│ │                                                        │ │
│ │                                     GHS 1,800.00       │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Totals:                                                      │
│   Subtotal:                          GHS 2,000.00           │
│   Total Discount:                    -GHS 200.00            │
│   (Volume discount 10%)                                     │
│   ────────────────────────────────────────────              │
│   Total:                             GHS 1,800.00           │
└──────────────────────────────────────────────────────────────┘
```

### Visual Styling:
- Discounts shown in **green** color (#52c41a)
- Discount amount prefixed with minus sign (-)
- Percentage displayed below amount in smaller font
- Reason displayed in gray italic text

---

## Usage Examples

### Example 1: Creating a Quote with Discount

**Step 1:** Calculate pricing
```javascript
const pricingResponse = await fetch('/api/pricing/calculate', {
  method: 'POST',
  body: JSON.stringify({
    jobType: 'Flyer',
    quantity: 1000,
    paperType: 'Standard',
    colorType: 'Full Color'
  })
});

const { breakdown, appliedDiscount } = await pricingResponse.json();
```

**Step 2:** Create quote with discount details
```javascript
const quoteData = {
  customerId: 'customer-uuid',
  title: '1000 Flyers - Marketing Campaign',
  items: [{
    description: 'Full Color Flyers (A5)',
    quantity: 1000,
    unitPrice: breakdown.unitPrice,
    discountAmount: appliedDiscount?.amount || 0,
    discountPercent: appliedDiscount?.percentage || 0,
    discountReason: appliedDiscount?.reason || null,
    total: breakdown.finalPrice
  }],
  discountReason: appliedDiscount?.reason || null
};

await fetch('/api/quotes', {
  method: 'POST',
  body: JSON.stringify(quoteData)
});
```

**Result:** Quote created with full discount transparency!

---

### Example 2: Manual Discount on Invoice

```javascript
const invoiceData = {
  jobId: 'job-uuid',
  customerId: 'customer-uuid',
  subtotal: 5000.00,
  discountType: 'percentage',
  discountValue: 15,
  discountAmount: 750.00,  // Calculated automatically
  discountReason: 'Returning customer discount',
  taxRate: 12.5,
  dueDate: '2025-02-15'
};
```

**Receipt shows:**
```
Subtotal:                    GHS 5,000.00
Tax (12.5%):                 GHS   625.00
Discount (15%):              -GHS  750.00
  Returning customer discount
───────────────────────────────────────────
Total Amount:                GHS 4,875.00
```

---

## Discount Types

### 1. **Volume/Quantity Discounts**
Automatically applied based on pricing template tiers:
- 100-499 units = 5% off
- 500-999 units = 10% off
- 1000+ units = 15% off

**Displayed as:** "Volume discount (500+ units = 10% off)"

### 2. **Manual Invoice Discounts**
Applied at invoice level for special circumstances:
- Early payment discounts
- Loyalty discounts
- Promotional offers

**Displayed as:** Custom reason provided by user

### 3. **Line-Item Discounts**
Applied to individual quote items:
- Different discount for each line
- Can mix volume discounts with special offers

**Displayed as:** Per-item discount with reason

---

## Best Practices

### For Sales Team:

1. **Always provide discount reason**
   ```javascript
   discountReason: "Volume discount 10%" // Good
   discountReason: "" // Bad - confusing for customer
   ```

2. **Calculate discounts before creating quotes**
   - Use `/api/pricing/calculate` endpoint
   - Capture returned discount details
   - Pass them to quote creation

3. **Be transparent**
   - Show original price
   - Show discount amount
   - Show final price
   - Explain why discount was applied

### For Developers:

1. **Always populate discount fields together:**
   ```javascript
   {
     discountAmount: 100,
     discountPercent: 10,
     discountReason: "Volume discount"
   }
   ```

2. **Use pricing calculator for consistency:**
   - Don't manually calculate discounts
   - Let the system apply tier logic
   - Ensures policy compliance

3. **Display discounts prominently:**
   - Use green color for savings
   - Show percentage and amount
   - Include explanation

---

## Configuration

### Adding New Discount Tiers

Edit pricing template:
```javascript
{
  "discountTiers": [
    {
      "minQuantity": 100,
      "maxQuantity": 499,
      "discountPercent": 5
    },
    {
      "minQuantity": 500,
      "maxQuantity": 999,
      "discountPercent": 10
    },
    {
      "minQuantity": 1000,
      "maxQuantity": null,  // No upper limit
      "discountPercent": 15
    }
  ]
}
```

### Customizing Discount Messages

The system auto-generates messages like:
- `"Volume discount (500+ units = 10% off)"`

To customize, update `pricingController.js`:
```javascript
appliedDiscount = {
  reason: `Bulk order savings - ${tier.discountPercent}% discount applied`
};
```

---

## Benefits

### For Customers:
- Clear understanding of savings
- Incentivized to order more
- Trust through transparency

### For Business:
- Automated discount application
- Consistent pricing policy
- Easy audit trail
- Professional appearance

### For Accounting:
- Accurate discount tracking
- Better reporting
- Clear reason codes
- Audit compliance

---

## Testing

### Test Discount Display:

1. Create a pricing template with discount tiers
2. Calculate price for quantity that qualifies
3. Create quote with returned discount details
4. Print/preview the quote
5. Verify:
   - Discount amount shown
   - Percentage displayed
   - Reason appears below discount
   - Green color applied
   - Total correctly calculated

---

## Summary

Your discount system now provides:
- Automatic calculation based on quantity tiers
- Detailed breakdown with reasons
- Prominent display on receipts
- Line-item and invoice-level support
- Full audit trail

**Result:** Professional, transparent pricing that encourages larger orders and builds customer trust!

**Access:** Create quotes/invoices normally - discounts appear automatically when configured in pricing templates.

