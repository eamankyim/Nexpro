# Module-Based Pricing System

## Overview

Your subscription platform now uses a **module-based system** where features are organized into logical groups. Admins can toggle entire modules on/off to quickly create pricing tiers.

---

## Modules Overview

### 10 Core Modules with 40+ Features:

### 1. **CRM & Contacts** (contacts)
Customer and vendor relationship management
- Customer & Vendor CRM
- Lead Pipeline & Activity Timeline

### 2. **Sales & Quoting** (dollar)
Quote generation, pricing, and sales tracking
- Quote Builder
- Pricing Templates (with usage limits)
- Quantity Discount Tiers
- Quote-to-Job Conversion

### 3. **Job Management** (setting)
Job workflow, tracking, and execution
- Job Workflow & Tracking
- Job Status History
- PDF Export

### 4. **Inventory & Vendors** (appstore)
Inventory tracking and vendor management
- Inventory Tracking
- Vendor Price Lists

### 5. **Finance & Billing** (dollar-circle)
Payments, expenses, and invoicing
- Payment Tracking
- Expense Management
- Invoicing
- Auto Invoice Generation
- Invoice Customization
- Invoice Reminders

### 6. **Accounting** (bar-chart)
Full accounting system
- Chart of Accounts
- Accounting Automation

### 7. **Payroll & HR** (team)
Employee and payroll management
- Employee Records (with limits)
- Payroll Processing

### 8. **Analytics & Reports** (line-chart)
Business intelligence
- Basic Reports & Dashboard
- Advanced Dashboard Filters
- Sales Analytics
- AR & Outstanding Payments
- Profit & Loss Statements
- Data Export

### 9. **Automation** (robot)
Workflow automation
- Quote-to-Job Automation
- Auto Invoice Generation
- Accounting Automation
- Invoice Reminders
- Bulk Operations

### 10. **Communication** (mail)
Notifications and alerts
- In-App Notifications
- Email Notifications (with limits)
- SMS Notifications (with limits)

### 11. **Customer Experience** (star)
Client-facing features
- Customer Portal
- Vendor Portal
- Custom Branding

### 12. **Team & Permissions** (lock)
User management
- Role-Based Access Control
- Team Invites
- Multi-Workspace Access

### 13. **Integration & API** (api)
Integrations
- REST API Access
- Webhooks

### 14. **Enterprise** (bank)
Enterprise features
- White-Label Branding
- Single Sign-On (SSO)
- Custom Workflows
- Custom Fields

### 15. **Support & Success** (customer-service)
Support levels
- Standard Support
- Priority Support
- Dedicated Success Manager
- Support SLA

---

## Admin UI - Module-Based Pricing

### Visual Interface:

```
┌────────────────────────────────────────────────────────┐
│ Subscription Plans                    [Create Plan]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Manage subscription plans for marketing site          │
│                                                        │
│ Order │ Name   │ Price    │ Seats  │ Storage │ ... │ │
│ ──────┼────────┼──────────┼────────┼─────────┼─────│ │
│  10   │ Trial  │ Free     │ 5      │ 1 GB    │ ... │ │
│  20   │ Launch │ GHS 799  │ 5 +25  │ 10 GB   │ ... │ │
│  30   │ Scale  │ GHS 1,299│ 15 +32 │ 50 GB   │ ... │ │
└────────────────────────────────────────────────────────┘
```

### Plan Editor Modal:

```
┌──────────────────────────────────────────────────────┐
│ Edit Plan: "Professional"                     [X]    │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Basic Info, Pricing, Seat Limits, Storage Limits... │
│                                                      │
│ [Auto-generate from features] ← Highlights          │
│ [Auto-generate from features] ← Marketing Perks     │
│                                                      │
│ ── Module-Based Pricing ────────────────────────    │
│ Toggle entire modules or expand for individual      │
│ features. Click auto-generate to sync marketing.    │
│                                                      │
│ Feature Modules:                                     │
│                                                      │
│ ☑ CRM & Contacts              [2/2 features] ▼     │
│   Customer and vendor relationship management       │
│                                                      │
│ ☑ Sales & Quoting             [4/4 features] ▼     │
│   Quote generation, pricing, sales tracking         │
│                                                      │
│ ☑ Job Management              [3/3 features] ▼     │
│   Job workflow, tracking, and execution             │
│                                                      │
│ ☐ Inventory & Vendors         [0/2 features] ▶     │
│   Inventory tracking (Click to expand)              │
│                                                      │
│ ☑ Finance & Billing           [6/6 features] ▼     │
│   Payments, expenses, invoicing                     │
│   ├─ ☑ Payment Tracking                            │
│   ├─ ☑ Expense Management                          │
│   ├─ ☑ Invoicing                                   │
│   ├─ ☑ Auto Invoice Generation                     │
│   ├─ ☑ Invoice Customization                       │
│   └─ ☑ Invoice Reminders                           │
│                                                      │
│ ☑ Accounting                  [2/2 features] ▼     │
│ ☐ Payroll & HR                [0/2 features] ▶     │
│ ☑ Analytics & Reports         [6/6 features] ▼     │
│ ☑ Automation                  [5/5 features] ▼     │
│ ☐ Communication               [0/3 features] ▶     │
│ ☐ Customer Experience         [0/3 features] ▶     │
│ ☑ Team & Permissions          [3/3 features] ▼     │
│ ☐ Integration & API           [0/2 features] ▶     │
│ ☐ Enterprise                  [0/4 features] ▶     │
│ ☐ Support & Success           [0/4 features] ▶     │
│                                                      │
│                                  [Cancel] [Save]     │
└──────────────────────────────────────────────────────┘
```

---

## Key Features

### Module Toggles:
- Click checkbox to enable/disable entire module
- Indeterminate state shows partial selection
- Counter shows enabled features (e.g., "2/4 features")
- Expand panel to see individual features

### Individual Feature Control:
- Expand any module to see features
- Toggle individual features on/off
- See feature descriptions
- View marketing copy preview
- Identify features with usage limits

### Auto-Generation:
- Click "Auto-generate from features" button
- System scans all enabled features
- Generates highlights and perks automatically
- Perfect sync between features and marketing

---

## Creating Plans with Modules

### Example: Create "Professional" Plan

**Step 1: Enable Core Modules**
```
☑ CRM & Contacts (all)
☑ Sales & Quoting (all)
☑ Job Management (all)
☑ Finance & Billing (all)
☑ Team & Permissions (all)
```

**Step 2: Enable Premium Modules**
```
☑ Accounting (all)
☑ Analytics & Reports (all - 6 features!)
```

**Step 3: Selectively Enable Features**
```
Automation module: Expand and select:
  ☑ Quote-to-Job Conversion
  ☑ Auto Invoice Generation
  ☐ Accounting Automation (Scale+ only)
  ☐ Invoice Reminders (Scale+ only)
  ☐ Bulk Operations (Scale+ only)
```

**Step 4: Auto-Generate Marketing**
Click "Auto-generate" → Creates perfect marketing copy!

**Step 5: Add Plan-Specific Details**
```
Add to highlights:
- Up to 10 team members
- 20 GB file storage
- Priority email support
```

**Step 6: Save**

**Result:** Professional plan with exactly the right features!

---

## Recommended Plan Configurations

### Trial Plan (Evaluation):
```
Modules: 
☑ CRM & Contacts
☑ Sales & Quoting (basic only)
☑ Job Management
☑ Finance & Billing (basic)
☑ Team & Permissions

Features: 9 basic
Seats: 5
Storage: 1 GB
```

### Launch Plan (Small Business):
```
Modules:
☑ CRM & Contacts
☑ Sales & Quoting (all)
☑ Job Management (all)
☑ Finance & Billing (all)
☑ Accounting
☑ Payroll & HR
☑ Team & Permissions
☑ Automation (partial - auto invoicing only)

Features: 15
Seats: 5 (+GHS 25/seat)
Storage: 10 GB (+GHS 15/100GB)
```

### Scale Plan (Growing Business):
```
Modules:
☑ CRM & Contacts
☑ Sales & Quoting
☑ Job Management
☑ Finance & Billing
☑ Inventory & Vendors
☑ Accounting
☑ Payroll & HR
☑ Analytics & Reports (all 6 features!)
☑ Automation (all)
☑ Communication (email + in-app)
☑ Customer Experience (branding + portal)
☑ Team & Permissions

Features: 28
Seats: 15 (+GHS 32/seat)
Storage: 50 GB (+GHS 12/100GB)
```

### Enterprise Plan (Full Platform):
```
Modules:
☑ ALL MODULES ENABLED

Features: 40+
Seats: Unlimited
Storage: Unlimited
```

---

## Benefits of Module-Based Pricing

### For Platform Admins:
- Quick plan creation (toggle modules, not 40 features)
- Logical groupings (easier to understand)
- Visual organization (collapsible panels)
- Auto-generated marketing (always in sync)

### For Tenants:
- Clear feature packages (modules vs individual features)
- Easy comparison ("Scale has 10 modules")
- Better value perception (module = bundle of features)

### For Developers:
- Organized feature catalog
- Easy to add features to existing modules
- Reusable marketing copy
- Single source of truth

---

## API Endpoints

### Get Modules:
```
GET /api/platform-settings/modules

Response:
{
  "success": true,
  "data": {
    "modules": [...],      // 10 modules
    "allFeatures": [...],  // 40+ features
    "totalModules": 10,
    "totalFeatures": 42
  }
}
```

### Get Features (Legacy):
```
GET /api/platform-settings/features

Response:
{
  "success": true,
  "data": {
    "features": [...],         // Flat list
    "categories": {...},
    "featuresByCategory": {...}
  }
}
```

---

## Summary

### What Changed:
- Features organized into 10 modules
- Module toggle functionality
- Collapsible UI for better organization
- Removed all emojis from application code
- Icon names instead of emoji characters

### What Stayed:
- Individual feature control
- Auto-generate marketing copy
- Feature enforcement
- Seat and storage limits
- All existing functionality

### Result:
Cleaner, more professional pricing management interface with module-based organization!

**Access:** `/admin/settings` → "Subscription Plans" → Edit any plan

Features now organized by modules for easier pricing tier creation!

