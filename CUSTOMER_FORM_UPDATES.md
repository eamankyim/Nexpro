# Customer Form Updates

## Overview

Customer forms have been updated to use Ghana-appropriate field labels and include tracking for customer acquisition source.

---

## Changes Made

### 1. **Field Label Updates**

| Old Label | New Label | Reason |
|-----------|-----------|--------|
| **City** | **Town** | More appropriate for Ghana |
| **State** | **Region** | Ghana uses regions, not states |
| **Zip Code** | ❌ Removed | Not commonly used in Ghana |

### 2. **New Required Field**

**"How did you hear about us?"**
- Required field for marketing tracking
- Dropdown with 4 options
- Shows conditional "Referral Name" field

---

## Updated Form Structure

### Customer Form Fields:

```
┌──────────────────────────────────────────────────┐
│ Add New Customer                            [X]  │
├──────────────────────────────────────────────────┤
│                                                  │
│ Customer Name: [________________] * Required     │
│ Company:       [________________]                │
│                                                  │
│ Email:         [________________]                │
│ Phone:         [________________]                │
│                                                  │
│ Address:       [________________]                │
│                                                  │
│ Town:          [e.g., Accra____]                │
│ Region:        [e.g., Greater Accra]            │
│                                                  │
│ How did you hear about us? [Select ▼] *        │
│   - Signboard                                    │
│   - Referral                                     │
│   - Social Media                                 │
│   - Market Outreach                              │
│                                                  │
│ [If "Referral" selected:]                       │
│ Referral Name: [________________] *             │
│                                                  │
│                          [Cancel] [Create]       │
└──────────────────────────────────────────────────┘
```

---

## Source Tracking Options

### Available Options:

1. **Signboard**
   - Physical signage
   - Roadside boards
   - Shop front

2. **Referral**
   - Word of mouth
   - Shows additional "Referral Name" field (required)
   - Tracks who referred them

3. **Social Media**
   - Facebook, Instagram, Twitter
   - LinkedIn, TikTok

4. **Market Outreach**
   - Direct marketing
   - Events, promotions
   - Field sales

---

## Conditional Field Logic

### Referral Name Field:

**When "Referral" is selected:**
```javascript
handleHowDidYouHearChange('Referral')
  ↓
setShowReferralName(true)
  ↓
"Referral Name" field appears (required)
```

**When other option selected:**
```javascript
handleHowDidYouHearChange('Social Media')
  ↓
setShowReferralName(false)
  ↓
"Referral Name" field hidden
```

---

## Forms Updated

### 1. **Main Customer Form** (`Customers.jsx`)
```
Location: /customers
Use: Creating/editing customers from Customers page

Fields:
- Name, Company
- Email, Phone
- Address
- Town, Region (not Zip Code)
- How did you hear about us? (required)
- Referral Name (conditional)
```

### 2. **Inline Customer Form** (`Jobs.jsx`)
```
Location: Embedded in Add Job modal
Use: Quick customer creation while adding jobs

Fields: Same as main form
- Fully consistent
- Same validation rules
- Same conditional logic
```

---

## Regional Customization

### Ghana-Specific Updates:

**Before (US-centric):**
```
City:     [New York____]
State:    [NY__________]
Zip Code: [10001_______]
```

**After (Ghana-appropriate):**
```
Town:     [Accra_____________]
Region:   [Greater Accra_____]
```

**Examples:**
- Town: Accra, Kumasi, Takoradi, Tamale, Cape Coast
- Region: Greater Accra, Ashanti, Western, Northern, Central

---

## Marketing Analytics Benefits

### Track Customer Acquisition:

```sql
-- Report: Where customers come from
SELECT "howDidYouHear", COUNT(*) as count
FROM customers
GROUP BY "howDidYouHear"
ORDER BY count DESC;

Result:
┌──────────────────┬───────┐
│ Source           │ Count │
├──────────────────┼───────┤
│ Referral         │   45  │
│ Social Media     │   32  │
│ Signboard        │   28  │
│ Market Outreach  │   15  │
└──────────────────┴───────┘
```

### Referral Tracking:
```sql
-- Report: Top referrers
SELECT "referralName", COUNT(*) as referrals
FROM customers
WHERE "howDidYouHear" = 'Referral'
  AND "referralName" IS NOT NULL
GROUP BY "referralName"
ORDER BY referrals DESC
LIMIT 10;

Result:
┌──────────────────┬───────────┐
│ Referrer         │ Referrals │
├──────────────────┼───────────┤
│ John Mensah      │     8     │
│ Ama Osei         │     6     │
│ Kofi Annan       │     5     │
└──────────────────┴───────────┘
```

---

## Validation Rules

### Customer Name:
- **Required:** Yes
- **Type:** Text
- **Error:** "Please enter customer name"

### Email:
- **Required:** No
- **Type:** Email validation
- **Error:** "Please enter a valid email"

### How did you hear about us?:
- **Required:** Yes
- **Type:** Dropdown selection
- **Error:** "Please select an option"

### Referral Name:
- **Required:** Yes (when "Referral" selected)
- **Type:** Text
- **Error:** "Please enter referral name"
- **Conditional:** Only shows when "Referral" selected

---

## Database Fields

The Customer model uses these field names:

```javascript
{
  name: "Customer name",
  company: "Company name",
  email: "email@example.com",
  phone: "0591403367",
  address: "123 Main Street",
  city: "Accra",           // DB field 'city', label 'Town'
  state: "Greater Accra",   // DB field 'state', label 'Region'
  zipCode: null,            // Removed from form
  howDidYouHear: "Referral",
  referralName: "John Mensah"
}
```

**Note:** Database column names remain unchanged for backwards compatibility. Only form labels changed.

---

## Files Modified

1. ✅ **`Frontend/src/pages/Jobs.jsx`**
   - Added inline customer creation
   - Updated to Town/Region labels
   - Added "How did you hear about us?" field
   - Added referral name conditional field

2. ✅ **`Frontend/src/pages/Customers.jsx`**
   - Updated to Town/Region labels
   - Added Region field (was missing)
   - Consistent with inline form

---

## Summary

### What Changed:

| Aspect | Before | After |
|--------|--------|-------|
| **Location Labels** | City, State, Zip | Town, Region |
| **Zip Code** | Visible | Removed |
| **Region Field** | Missing in some forms | Present everywhere |
| **Source Tracking** | Consistent | Consistent |
| **Inline Creation** | Not available | Available in Jobs |

### Result:
- ✅ Ghana-appropriate field labels
- ✅ Better marketing tracking
- ✅ Consistent across all forms
- ✅ Inline creation from job form
- ✅ Referral tracking enabled

**Status:** ✅ Complete and ready to use!

**Try it:** Add a new job → Click Customer dropdown → Click "+ Add New Customer" → Fill the Ghana-formatted form!

