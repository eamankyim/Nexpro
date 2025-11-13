# Pricing Discount Guide

## Overview
The pricing template system now automatically applies quantity-based discounts when you use pricing templates in job creation.

---

## 🎯 How It Works

### Discount Tiers
Pricing templates can have **discount tiers** that automatically reduce prices based on quantity ordered.

**Example Discount Tier Structure:**
```json
[
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
    "maxQuantity": null,
    "discountPercent": 15
  }
]
```

This means:
- **100-499 units** → 5% discount
- **500-999 units** → 10% discount
- **1000+ units** → 15% discount

---

## 📝 How to Use

### Step-by-Step Guide

1. **Add a Job Item**
   - Click "Add Job Item" in the job creation form

2. **Select Pricing Template** 
   - Choose a pricing template from the dropdown
   - Templates with discounts show "🏷️ Auto-Discounts" label

3. **Enter or Change Quantity**
   - Enter your desired quantity (e.g., 1000)
   - **Discounts apply automatically in real-time!** ✨

4. **Watch the Magic Happen**
   - As you change the quantity, the unit price updates instantly
   - You'll see a notification: "X% discount applied for quantity Y!"
   - Total is calculated with the discount included
   - **No need to reselect template - it's all automatic!**

---

## 💡 Example Scenario

### Without Discount Fix (Old Behavior)
```
Quantity: 1000
Unit Price: GHS 2.00 (from template)
Total: GHS 2000.00 (no discount applied ❌)
```

### With Discount Fix (New Behavior)
```
Quantity: 1000
Template Unit Price: GHS 2.00
Discount: 15% for 1000+ units
Discounted Unit Price: GHS 1.70
Total: GHS 1700.00 ✅
```

**Savings: GHS 300.00**

---

## 🎨 Visual Indicators

### In the Job Form:

1. **Success Alert**
   - Green success banner appears above pricing template dropdown
   - Message: "💡 Tip: Change quantity and see the discounted price update automatically!"

2. **Template Labels**
   - Templates with discounts show: "🏷️ Auto-Discounts"
   - Example: "Business Cards - Business Cards (GHS 2.00/unit) 🏷️ Auto-Discounts"

3. **Discount Notification**
   - When discount is applied, you see: "15% discount applied for quantity 1000!"
   - Appears for 3 seconds
   - Updates in real-time as you change quantity

---

## 🔧 Technical Details

### How Discounts Are Calculated

```javascript
// 1. Get template unit price
unitPrice = template.pricePerUnit // e.g., GHS 2.00

// 2. Calculate total before discount
totalPrice = unitPrice * quantity // e.g., GHS 2.00 * 1000 = GHS 2000

// 3. Find applicable discount tier
if (quantity >= 1000) {
  discountPercent = 15
}

// 4. Apply discount
discount = (totalPrice * discountPercent) / 100 // GHS 2000 * 0.15 = GHS 300
totalPrice = totalPrice - discount // GHS 2000 - GHS 300 = GHS 1700

// 5. Calculate new unit price
unitPrice = totalPrice / quantity // GHS 1700 / 1000 = GHS 1.70
```

### Files Modified
- `Frontend/src/pages/Jobs.jsx`
  - Added `calculatePriceWithDiscount()` helper function
  - Enhanced `handleTemplateSelect()` to apply discounts
  - Added visual indicators for discount availability

---

## 📊 Setting Up Discount Tiers

### In Pricing Templates

When creating or editing a pricing template, you can set discount tiers:

**Example:**
```json
{
  "name": "Business Cards - Standard",
  "category": "Business Cards",
  "pricePerUnit": 2.00,
  "discountTiers": [
    {
      "minQuantity": 500,
      "maxQuantity": 999,
      "discountPercent": 10
    },
    {
      "minQuantity": 1000,
      "maxQuantity": null,
      "discountPercent": 15
    }
  ]
}
```

### Discount Tier Properties

- **minQuantity** (required): Minimum quantity to qualify for this tier
- **maxQuantity** (optional): Maximum quantity for this tier (null = no limit)
- **discountPercent** (required): Percentage discount to apply (e.g., 10 for 10%)

---

## ✅ Best Practices

### For Users:
1. ✅ **Always enter quantity first** before selecting pricing template
2. ✅ **Look for the 🏷️ Has Discounts indicator** to know which templates offer bulk discounts
3. ✅ **Check the discount notification** to confirm the discount was applied
4. ✅ **Verify the unit price** has been adjusted after template selection

### For Administrators:
1. ✅ **Set logical discount tiers** based on your pricing strategy
2. ✅ **Use incremental discounts** (e.g., 5%, 10%, 15%) for better customer incentive
3. ✅ **Test discount tiers** with different quantities to ensure they work correctly
4. ✅ **Document your discount structure** for consistency

---

## 🐛 Troubleshooting

### Issue: Discount Not Applied

**Problem:** Quantity is 1000 but still showing full price

**Solutions:**
1. ✅ Make sure you **selected a pricing template** first
2. ✅ Check if the template has discount tiers (look for "🏷️ Auto-Discounts" label)
3. ✅ Try **changing the quantity** slightly to trigger recalculation
4. ✅ Verify your quantity meets the minimum discount tier requirement

### Issue: Wrong Discount Applied

**Problem:** Expected 15% discount but got 10%

**Solutions:**
1. ✅ Check the discount tier ranges in the pricing template
2. ✅ Verify your quantity falls within the expected tier
3. ✅ Example: 999 units = 10% tier, 1000 units = 15% tier

### Issue: No Discount Indicator

**Problem:** Template doesn't show "🏷️ Has Discounts" label

**Solutions:**
1. ✅ The template may not have discount tiers configured
2. ✅ Check the pricing template settings
3. ✅ Add discount tiers if needed

---

## 📈 Impact

### Business Benefits:
- ✅ **Automatic bulk pricing** encourages larger orders
- ✅ **Consistent discount application** reduces errors
- ✅ **Clear pricing visibility** improves customer trust
- ✅ **Time savings** - no manual calculations needed

### User Experience:
- ✅ **Simple workflow** - just enter quantity and select template
- ✅ **Visual feedback** - clear notifications when discounts apply
- ✅ **Transparent pricing** - see exactly what discount you're getting
- ✅ **Error prevention** - automated calculations eliminate mistakes

---

## 🔮 Future Enhancements

Potential improvements:
- [ ] Volume discount preview table before template selection
- [ ] Custom discount rules per customer
- [ ] Seasonal discount support
- [ ] Combined discount types (volume + promotional)
- [ ] Discount approval workflow for large discounts
- [ ] Discount analytics and reporting

---

## 📚 Related Documentation

- `Backend/API_ENDPOINTS.md` - Pricing calculation endpoint
- `Backend/controllers/pricingController.js` - Backend discount logic
- `Backend/models/PricingTemplate.js` - Pricing template schema
- `Frontend/src/pages/Jobs.jsx` - Frontend implementation

---

## ✨ Summary

The discount system now works automatically in **real-time**:

1. **Select template** → 2. **Change quantity** → 3. **Discount updates instantly!** ⚡

**Before Fix:**
- ❌ Discounts were ignored
- ❌ Manual price adjustments needed
- ❌ Had to reselect template after changing quantity
- ❌ Inconsistent pricing

**After Fix:**
- ✅ **Real-time discount calculation** as you type
- ✅ Automatic quantity-based tier selection
- ✅ Visual feedback and notifications
- ✅ No need to reselect template
- ✅ Consistent, accurate pricing
- ✅ Instant price updates

---

*Last updated: October 14, 2024*
*Feature: Automatic Pricing Discount Application*

