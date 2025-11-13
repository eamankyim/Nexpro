# 👥 Seat Limit Management System

## Overview

Your NEXpro platform now has a **complete seat/user limit system** that enforces subscription plan limits automatically!

---

## 🎯 Features Implemented

### ✅ **Database Layer**
- `seatLimit` column in `subscription_plans` table
- `seatPricePerAdditional` column for expansion pricing
- Automatic calculation of current usage vs limits

### ✅ **Backend Enforcement**
- Middleware blocks user creation when limit reached
- API returns clear error messages with upgrade paths
- Seat usage tracking per tenant

### ✅ **Admin CMS**
- Configure seat limits per plan in Admin UI
- Set pricing for additional seats
- Visual display of limits in plan table

### ✅ **User Interface**
- Real-time seat usage card on Users page
- Progress bar showing utilization
- Warning alerts when nearing limit
- Upgrade prompts when limit reached

---

## 📊 Default Seat Limits

| Plan | Base Seats | Additional Seat Price | Unlimited? |
|------|-----------|----------------------|------------|
| **Trial** | 5 | Not available | ❌ |
| **Launch** | 5 | GHS 25/seat | ❌ |
| **Scale** | 15 | GHS 32/seat | ❌ |
| **Enterprise** | ∞ | Custom pricing | ✅ |

---

## 🔧 Admin: How to Configure Seat Limits

### Step 1: Navigate to Plan Editor
1. Go to `/admin/settings`
2. Click **"💳 Subscription Plans"** tab
3. Click **"Edit"** on any plan

### Step 2: Set Seat Limits
Scroll to the **"Seat Limits"** section:

```
┌─────────────────────────┬──────────────────────────────┐
│ Maximum Seats           │ Price Per Additional Seat    │
│ [15              ]      │ GHS [32.00            ]      │
│ Leave empty for unlimited│ Cost to add seats beyond base│
└─────────────────────────┴──────────────────────────────┘
```

**Examples:**
- **Trial Plan**: Max Seats = `5`, Additional = Leave empty (can't add seats)
- **Launch Plan**: Max Seats = `5`, Additional = `25.00`
- **Scale Plan**: Max Seats = `15`, Additional = `32.00`
- **Enterprise**: Max Seats = Leave empty (unlimited)

### Step 3: Save
Click **"Save"** and limits are immediately enforced!

---

## 👨‍💼 User Experience

### When Within Limits (3/5 seats used):

```
┌──────────────────────────────────────────┐
│ 🧑‍🤝‍🧑 Team Seats          Trial Plan   │
├──────────────────────────────────────────┤
│ Active Users        Total Seats  Available│
│      3                  5            2     │
│                                            │
│ Seat Usage                    3 of 5 (60%)│
│ ████████████░░░░░░░░                      │
└──────────────────────────────────────────┘
```

### When Near Limit (4/5 seats used):

```
┌──────────────────────────────────────────┐
│ 🧑‍🤝‍🧑 Team Seats          Trial Plan   │
├──────────────────────────────────────────┤
│ Active Users        Total Seats  Available│
│      4                  5            1     │
│                                            │
│ Seat Usage                    4 of 5 (80%)│
│ ████████████████░░░░                      │
│                                            │
│ ⚠️ Running Low on Seats                   │
│ Only 1 seat remaining. Consider upgrading │
└──────────────────────────────────────────┘
```

### When Limit Reached (5/5 seats):

```
┌──────────────────────────────────────────┐
│ 🧑‍🤝‍🧑 Team Seats          Trial Plan   │
├──────────────────────────────────────────┤
│ Active Users        Total Seats  Available│
│      5                  5            0     │
│                                            │
│ Seat Usage                    5 of 5 (100%)│
│ ████████████████████████                  │
│                                            │
│ ❌ Seat Limit Reached                      │
│ You've reached your 5-seat limit.         │
│ Please upgrade your plan to add more.     │
│                                            │
│ [Upgrade Plan]                            │
└──────────────────────────────────────────┘
```

### When Try to Invite (at limit):

```
[Invite User button clicked]
     ↓
❌ Error Message:
"Seat limit reached. Your Trial plan allows 5 users. 
You currently have 5 active users. Please upgrade 
your plan to add more users."
```

---

## 🔐 Backend Enforcement

### Automatic Checks on:

#### 1. **User Invite Generation**
```javascript
POST /api/invites
  ↓
✓ Check seat limit
  ↓
  If at limit → 403 Error
  If OK → Create invite
```

#### 2. **Direct User Creation** (if applicable)
```javascript
POST /api/users
  ↓
✓ Check seat limit
  ↓
  If at limit → 403 Error
  If OK → Create user
```

### Error Response:
```json
{
  "success": false,
  "message": "Seat limit reached. Your Launch plan allows 5 users. You currently have 5 active users. Upgrade your plan or add seats for GHS 25 per user.",
  "code": "SEAT_LIMIT_EXCEEDED",
  "details": {
    "allowed": false,
    "current": 5,
    "limit": 5,
    "remaining": 0,
    "planName": "Launch",
    "pricePerAdditional": 25
  }
}
```

---

## 📱 Frontend Integration

### Get Seat Usage:
```javascript
import inviteService from '../services/inviteService';

const response = await inviteService.getSeatUsage();
console.log(response.data);
/*
{
  current: 4,
  limit: 5,
  remaining: 1,
  percentageUsed: 80,
  isUnlimited: false,
  isNearLimit: true,
  isAtLimit: false,
  canAddMore: true,
  planName: "Launch",
  pricePerAdditional: 25
}
*/
```

### Display Seat Usage Component:
```jsx
import SeatUsageCard from '../components/SeatUsageCard';

function MyPage() {
  return (
    <div>
      <SeatUsageCard />
      {/* Rest of your page */}
    </div>
  );
}
```

### Conditional Invite Button:
```jsx
import { useState, useEffect } from 'react';
import inviteService from '../services/inviteService';

function InviteButton() {
  const [seatUsage, setSeatUsage] = useState(null);
  
  useEffect(() => {
    const fetchUsage = async () => {
      const response = await inviteService.getSeatUsage();
      setSeatUsage(response.data);
    };
    fetchUsage();
  }, []);

  if (seatUsage?.isAtLimit) {
    return (
      <Tooltip title="Seat limit reached. Upgrade your plan to invite more users.">
        <Button disabled icon={<TeamOutlined />}>
          Invite User (Limit Reached)
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button type="primary" onClick={handleInvite}>
      Invite User
      {seatUsage && !seatUsage.isUnlimited && (
        <Tag color="blue" style={{ marginLeft: 8 }}>
          {seatUsage.remaining} left
        </Tag>
      )}
    </Button>
  );
}
```

---

## 🎨 Visual Examples

### Admin Plan Table:

```
┌────────────────────────────────────────────────────────────────┐
│ Subscription Plans                          [Create Plan]      │
├────┬──────────┬─────────┬───────────┬─────────────────────────┤
│Order│ Plan ID  │ Name    │ Price     │ Seats                   │
├────┼──────────┼─────────┼───────────┼─────────────────────────┤
│ 10 │ trial    │ Trial   │ GHS 0     │ 5 seats                 │
│ 20 │ launch   │ Launch  │ GHS 799/mo│ 5 seats  [+GHS 25/seat] │
│ 30 │ scale    │ Scale   │ GHS 1,299 │ 15 seats [+GHS 32/seat] │
│ 40 │ enterprise│Enterprise│Let's talk│ [Unlimited]             │
└────┴──────────┴─────────┴───────────┴─────────────────────────┘
```

### Users Page - Seat Usage Card:

```
┌────────────────────────────────────────────────────────────┐
│ 🧑‍🤝‍🧑 Team Seats                    [Launch Plan]         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Active Users    Total Seats    Available                 │
│       4              5               1                     │
│                                                            │
│  Seat Usage                            4 of 5 (80%)       │
│  ████████████████░░░░                                     │
│                                                            │
│  ⚠️ Running Low on Seats                                  │
│  Only 1 seat remaining. Consider upgrading soon.          │
│                                                            │
│  ℹ️ Need more seats? Add them for GHS 25 per user         │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 Usage Scenarios

### Scenario 1: Launch Plan Tenant Wants to Add 6th User

**Current State:**
- Plan: Launch (5 seats)
- Current: 5 active users
- Limit: 5 seats

**User Action:**
Admin clicks "Invite User"

**System Response:**
```
❌ Error Alert:
"Seat limit reached. Your Launch plan allows 5 users. 
You currently have 5 active users. Upgrade your plan 
or add seats for GHS 25 per user."

Options:
1. [Upgrade to Scale Plan] - Get 15 seats
2. [Add Individual Seats] - Pay GHS 25/user (if implemented)
3. [Cancel]
```

### Scenario 2: Scale Plan with Room to Grow

**Current State:**
- Plan: Scale (15 seats)
- Current: 8 active users
- Limit: 15 seats

**User Action:**
Admin clicks "Invite User"

**System Response:**
```
✅ Invite modal opens normally
Seat card shows:
- "7 seats remaining"
- Progress bar at 53%
- Green "OK" status
```

### Scenario 3: Enterprise Plan (Unlimited)

**Current State:**
- Plan: Enterprise (unlimited)
- Current: 47 active users

**User Action:**
Admin clicks "Invite User"

**System Response:**
```
✅ Invite modal opens normally
Seat card shows:
- "Unlimited Seats" badge
- No usage bar
- Success message: "You can invite as many team 
  members as needed on your Enterprise plan."
```

---

## 🛠️ API Reference

### Backend Endpoints:

#### Get Seat Usage
```
GET /api/invites/seat-usage
Authorization: Bearer {token}
X-Tenant-ID: {tenantId}

Response:
{
  "success": true,
  "data": {
    "current": 4,
    "limit": 5,
    "remaining": 1,
    "percentageUsed": 80,
    "isUnlimited": false,
    "isNearLimit": true,
    "isAtLimit": false,
    "canAddMore": true,
    "planName": "Launch",
    "pricePerAdditional": 25
  }
}
```

#### Generate Invite (with seat check)
```
POST /api/invites
{
  "email": "newuser@example.com",
  "role": "staff",
  "name": "New User"
}

If at limit → 403 Response:
{
  "success": false,
  "message": "Seat limit reached...",
  "code": "SEAT_LIMIT_EXCEEDED",
  "details": { current: 5, limit: 5, ... }
}
```

### Backend Helpers:

```javascript
const { 
  validateSeatLimit, 
  getSeatUsageSummary,
  canAddUser 
} = require('../utils/seatLimitHelper');

// Check before adding user
await validateSeatLimit(tenantId); // Throws error if exceeded

// Get usage info
const usage = await getSeatUsageSummary(tenantId);
console.log(usage.current, usage.limit, usage.remaining);

// Check if can add
const canAdd = await canAddUser(tenantId);
if (!canAdd.allowed) {
  // Show upgrade prompt
}
```

---

## 🎨 UI Components

### SeatUsageCard Component

**Usage:**
```jsx
import SeatUsageCard from '../components/SeatUsageCard';

<SeatUsageCard 
  style={{ marginBottom: 24 }}
  size="default"
  showUpgradeButton={true}
/>
```

**Props:**
- `style`: Custom styling
- `size`: 'default' | 'small'
- `showUpgradeButton`: Show/hide upgrade button (default: true)

**Auto Features:**
- ✅ Fetches seat usage automatically
- ✅ Shows progress bar
- ✅ Color-coded status (green → yellow → red)
- ✅ Warning alerts when near/at limit
- ✅ Displays upgrade options
- ✅ Shows additional seat pricing if available

---

## 💼 Business Logic

### Seat Counting:
```sql
SELECT COUNT(*) 
FROM user_tenants 
WHERE tenantId = ? AND isActive = true
```

**Counts:**
- ✅ Active users
- ❌ Inactive/suspended users (not counted)
- ⏳ Pending invites (counted toward limit)

### Limit Enforcement:
1. Check when creating invite
2. Check when activating suspended user
3. Check when converting invite to user
4. Never block platform admins

---

## 🔄 Workflows

### Adding a Team Member:

```
Admin clicks "Invite User"
         ↓
System checks seat limit
         ↓
   ┌────────┴────────┐
   │                 │
 Has room       At limit
   │                 │
   ↓                 ↓
Open invite   Show error:
modal         "Upgrade required"
   │          + Current usage
   ↓          + Plan limits
Generate       + Upgrade options
invite link
   ↓
Email sent
```

### Upgrading Plan:

```
Tenant at 5/5 seats (Trial)
         ↓
Admin goes to Settings → Billing
         ↓
Selects "Scale" plan (15 seats)
         ↓
Plan upgraded
         ↓
Seat limit now 15
         ↓
Can invite 10 more users immediately
```

### Purchasing Additional Seats:

```
Tenant at 5/5 seats (Launch)
         ↓
Wants 1 more user without upgrading
         ↓
Admin goes to Settings → Billing → Add Seats
         ↓
Adds 1 seat for GHS 25/month
         ↓
Seat limit now 6
         ↓
Monthly bill increases by GHS 25
         ↓
Can invite 1 more user
```

---

## ⚠️ Edge Cases Handled

### 1. **Exceeding Limit After Downgrade**
```
Scenario: Tenant has 10 users, downgrades from Scale (15) to Launch (5)

Handling:
- Existing users remain active
- System warns: "You have 10 users but your plan allows 5"
- Cannot invite new users until count drops below 5
- Graceful degradation, no forced user removal
```

### 2. **Unlimited to Limited Plan**
```
Scenario: Enterprise (unlimited) → Scale (15 seats)
Current Users: 20

Handling:
- All 20 users stay active
- Alert shown: "20/15 seats (over limit)"
- Must remove 5 users or upgrade back
- Cannot add new users
```

### 3. **Deleted Users**
```
When user is deleted:
- Seat count decreases
- Remaining seats increases
- Invitations become possible again
```

### 4. **Suspended vs Deleted**
```
Suspended Users:
- Still count toward limit
- Can be reactivated without seat check

Deleted Users:
- Don't count toward limit
- Free up seats for new invites
```

---

## 📊 Reporting & Analytics

### Admin Dashboard Can Show:

**Per-Tenant Seat Usage:**
```
┌─────────────┬────────┬──────┬──────────┬────────────┐
│ Tenant      │ Plan   │ Used │ Limit    │ Status     │
├─────────────┼────────┼──────┼──────────┼────────────┤
│ Acme Print  │ Scale  │ 12   │ 15       │ 80% ✅     │
│ PrintCo     │ Launch │ 5    │ 5        │ 100% ⚠️   │
│ MegaPrint   │ Enter. │ 45   │ Unlimited│ ∞ ✅       │
└─────────────┴────────┴──────┴──────────┴────────────┘
```

**Platform Revenue Opportunity:**
```
Tenants at seat limit: 12
Potential seat expansions: 37 seats
Estimated additional MRR: GHS 925
```

---

## 🎯 Key Features

| Feature | Description |
|---------|-------------|
| **Real-time Tracking** | Always shows current usage |
| **Visual Progress** | Color-coded progress bars |
| **Proactive Alerts** | Warning when nearing limit |
| **Clear Errors** | Specific messages with options |
| **Upgrade Prompts** | Direct paths to add capacity |
| **Flexible Limits** | Per-plan configuration |
| **Add-on Pricing** | Extra seat pricing per plan |
| **Unlimited Option** | For enterprise plans |

---

## 💡 Best Practices

### For Platform Admins:

1. **Set Realistic Limits**
   - Trial: 5 seats (evaluation)
   - Launch: 5-10 seats (small teams)
   - Scale: 15-25 seats (medium teams)
   - Enterprise: Unlimited (large orgs)

2. **Price Additional Seats**
   - Launch: +GHS 25/seat (encourages upgrade to Scale)
   - Scale: +GHS 32/seat (slight premium)
   - Enterprise: Custom pricing

3. **Monitor Usage**
   - Check which tenants are at limit
   - Proactively reach out for upgrades
   - Track expansion revenue

### For Tenants:

1. **Plan Ahead**
   - Check seat usage before hiring
   - Upgrade before you're at limit
   - Budget for additional seats

2. **Optimize Usage**
   - Deactivate inactive users
   - Use role-based access wisely
   - Consider enterprise for large teams

---

## 🔄 Future Enhancements

### Potential Additions:

1. **Seat Purchase Flow**
   - "Add 3 seats" button in UI
   - Automatic billing integration
   - Instant limit increase

2. **Usage Analytics**
   - Seat utilization over time
   - Peak usage tracking
   - Forecast when limit will be reached

3. **Soft Limits**
   - Grace period after reaching limit
   - Allow 1-2 extra seats temporarily
   - Send upgrade reminders

4. **Seat Reservations**
   - Reserve seats for specific users
   - Prevent invitation spam
   - Allocation management

---

## 📋 Summary

Your seat limit system is now **fully operational**:

✅ **Configured per plan** in Admin UI  
✅ **Enforced automatically** on backend  
✅ **Displayed visually** to users  
✅ **Clear upgrade paths** when limit reached  
✅ **Flexible pricing** for seat expansion  
✅ **Real-time tracking** of usage  

**Result:** You can now control team size by subscription tier, driving upgrade revenue while providing clear value! 🚀

