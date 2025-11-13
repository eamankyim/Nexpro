# 🎯 Feature Gating & Subscription Plan Management Guide

## Overview

This guide explains how NEXpro's **feature-gating system** ensures that subscription plan highlights and perks are **bound to actual app features** with enforced access control.

---

## 🏗️ Architecture

### 1. **Central Feature Registry** (`Backend/config/features.js`)

This is the **single source of truth** for all application features.

```javascript
const FEATURE_CATALOG = [
  {
    key: 'inventory',                    // Unique identifier
    name: 'Inventory Tracking',          // Display name
    description: 'Manage inventory...',   // Description
    category: 'operations',               // Category
    routes: ['/inventory'],              // Protected routes
    requiredForModules: []               // Dependencies
  },
  // ... more features
];
```

### 2. **Database Model** (`Backend/models/SubscriptionPlan.js`)

Stores plans with:
- **highlights**: Text descriptions (for marketing)
- **perks**: Marketing bullet points
- **featureFlags**: **Actual access control** (boolean flags)

```json
{
  "name": "Scale Plan",
  "highlights": ["Everything in Launch", "Advanced reporting"],
  "marketing": {
    "perks": ["Up to 15 seats", "Priority support"],
    "featureFlags": {
      "crm": true,
      "inventory": true,
      "advancedReporting": true,
      "whiteLabel": false
    }
  }
}
```

---

## 🔐 How It Works

### Step 1: Admin Configures Plan Features

1. **Navigate to**: `/admin/settings` → "💳 Subscription Plans"
2. **Click**: "Create Plan" or "Edit" existing plan
3. **Configure Features**:
   - ✅ **Feature Access Control** section shows all features
   - ✅ Toggle switches organized by category
   - ✅ Each toggle controls **actual app access**

### Step 2: Features Are Enforced

When a tenant tries to access a feature:

```javascript
// Backend middleware checks access
app.get('/api/inventory', 
  requireFeature('inventory'),  // ← Enforces access
  getInventoryItems
);
```

If the tenant's plan doesn't include `inventory`, they get:
```json
{
  "success": false,
  "message": "This feature (Inventory Tracking) is not included in your current plan",
  "upgradeRequired": true
}
```

---

## 📝 Adding a New Feature

### 1. Update Feature Catalog

**File**: `Backend/config/features.js`

```javascript
{
  key: 'customReports',
  name: 'Custom Report Builder',
  description: 'Create and save custom reports',
  category: 'analytics',
  routes: ['/reports/custom'],
  requiredForModules: ['reports']
}
```

### 2. Protect Routes (Backend)

```javascript
const { requireFeature } = require('../middleware/featureAccess');

// Protect specific routes
router.get('/reports/custom', 
  requireFeature('customReports'),
  getCustomReports
);

// Or protect entire route files
router.use(checkRouteAccess);  // Automatic route-based checking
```

### 3. Conditional Rendering (Frontend)

```jsx
import { FeatureGate } from '../hooks/useFeatureAccess';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      
      {/* Show only if plan includes this feature */}
      <FeatureGate feature="customReports">
        <CustomReportBuilder />
      </FeatureGate>
      
      {/* Show upgrade prompt if feature not available */}
      <FeatureGate 
        feature="customReports"
        fallback={<UpgradePrompt feature="Custom Reports" />}
      >
        <CustomReportBuilder />
      </FeatureGate>
    </div>
  );
}
```

### 4. Programmatic Checks

```jsx
import useFeatureAccess from '../hooks/useFeatureAccess';

function MyComponent() {
  const { hasFeature, hasAllFeatures, plan } = useFeatureAccess();
  
  if (hasFeature('inventory')) {
    // Show inventory features
  }
  
  if (hasAllFeatures(['crm', 'reports'])) {
    // Show advanced analytics
  }
  
  return <div>Current Plan: {plan}</div>;
}
```

---

## 🔄 Workflow: When Features Change

### Scenario: You add a new "AI Insights" feature

#### Step 1: Define Feature (5 minutes)
```javascript
// Backend/config/features.js
{
  key: 'aiInsights',
  name: 'AI-Powered Insights',
  description: 'Machine learning analytics',
  category: 'analytics',
  routes: ['/insights'],
  requiredForModules: ['reports']
}
```

#### Step 2: Protect Routes (2 minutes)
```javascript
// Backend/routes/insightsRoutes.js
router.use(requireFeature('aiInsights'));
```

#### Step 3: Admin Updates Plans (2 minutes)
1. Go to Admin Settings → Subscription Plans
2. Edit "Enterprise" plan
3. **Feature Access Control** section now shows "AI-Powered Insights"
4. Toggle it ON for Enterprise plan
5. Save

#### Step 4: Feature is Live! ✅
- Enterprise tenants can access `/insights`
- Other plans get "Upgrade Required" message
- Frontend components can check `hasFeature('aiInsights')`

---

## 🎨 Admin UI Features

### Plan Editor Shows:

1. **Basic Info**: Name, Description, Price
2. **Highlights** (Text): Marketing copy
3. **Perks** (Text): Marketing bullet points
4. **Feature Access Control** (Toggles):
   - ✅ **Organized by category**
   - ✅ **All features auto-discovered**
   - ✅ **Controls actual access**
   - ✅ **No manual JSON editing**

### Visual Example:

```
┌─────────────────────────────────────┐
│ Feature Access Control              │
├─────────────────────────────────────┤
│ Core Features                       │
│  ☑ Customer & Vendor CRM           │
│  ☑ Quote Builder                   │
│                                     │
│ Operations                          │
│  ☑ Job Workflow                    │
│  ☐ Inventory Tracking    ← Toggle! │
│                                     │
│ Analytics                           │
│  ☑ Dashboards & Reporting          │
│  ☐ Advanced Analytics              │
└─────────────────────────────────────┘
```

---

## 🛡️ Access Control Layers

### Layer 1: Route Protection (Backend)
```javascript
// Middleware automatically blocks unauthorized access
router.get('/inventory', requireFeature('inventory'), ...);
```

### Layer 2: Component Protection (Frontend)
```jsx
<FeatureGate feature="inventory">
  <InventoryPage />
</FeatureGate>
```

### Layer 3: UI Elements (Frontend)
```jsx
{hasFeature('inventory') && (
  <Button>Manage Inventory</Button>
)}
```

### Layer 4: Navigation (Frontend)
```jsx
const navItems = [
  { path: '/dashboard', label: 'Dashboard' },
  hasFeature('inventory') && { path: '/inventory', label: 'Inventory' },
  hasFeature('reports') && { path: '/reports', label: 'Reports' },
].filter(Boolean);
```

---

## 📊 Plan Hierarchy Example

```javascript
Trial Plan (GHS 0):
  ✅ CRM
  ✅ Quotes
  ✅ Jobs
  ✅ Basic Reports
  ❌ Inventory
  ❌ Advanced Analytics

Launch Plan (GHS 799):
  ✅ Everything in Trial
  ✅ Accounting
  ✅ Payroll
  ❌ Inventory
  ❌ Advanced Analytics

Scale Plan (GHS 1,299):
  ✅ Everything in Launch
  ✅ Inventory
  ✅ Advanced Analytics
  ✅ Notifications
  ❌ White-Label
  ❌ SSO

Enterprise Plan (Custom):
  ✅ EVERYTHING
  ✅ White-Label
  ✅ SSO
  ✅ Custom Workflows
  ✅ Dedicated Support
```

---

## 🚀 Benefits

### Before (Text-based):
❌ Highlights/perks are just text  
❌ No connection to app features  
❌ Manual enforcement needed  
❌ Features can drift out of sync  
❌ Adding features = update multiple files  

### After (Feature-gated):
✅ Features defined once  
✅ Access automatically enforced  
✅ Admin UI auto-updates  
✅ Single source of truth  
✅ Adding features = 1 config entry  

---

## 🔧 Maintenance

### Monthly Review:
1. Check `Backend/config/features.js`
2. Verify all features are current
3. Update descriptions if needed
4. Check plan assignments in Admin UI

### When Deprecating Features:
1. Mark as `deprecated: true` in catalog
2. Show migration notice to affected tenants
3. Remove from new plan assignments
4. After grace period, remove from catalog

### When Renaming Features:
1. Add new feature key
2. Keep old key as alias
3. Gradually migrate plans
4. Remove old key after migration

---

## 📚 API Reference

### Backend

```javascript
// Middleware
requireFeature(featureKey)         // Protect single route
checkRouteAccess()                 // Protect based on route path
getTenantFeatures(tenantId)        // Get tenant's features

// Helpers
canAccessFeature(features, key)    // Check if feature is in list
canAccessRoute(features, route)    // Check if route is accessible
getFeatureByKey(key)               // Get feature details
```

### Frontend

```javascript
// Hook
const { hasFeature, hasAllFeatures, hasAnyFeature, plan } = useFeatureAccess();

// Component
<FeatureGate feature="inventory" fallback={<Upgrade />}>
  <Component />
</FeatureGate>
```

---

## 🎯 Summary

**Your subscription plans are now feature-gated!**

- ✅ Highlights/perks can stay as marketing copy
- ✅ **Feature flags control actual access**
- ✅ Admin UI makes it easy to manage
- ✅ Single source of truth (`features.js`)
- ✅ Automatic enforcement at all layers
- ✅ Easy to add/modify features

**When you add or change features**, just update `features.js` and the system handles the rest! 🚀

