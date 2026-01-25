---
name: Business Type Selection & Business Information Onboarding Flow
overview: Enhance the tenant onboarding flow to collect business type (Printing Press, Shop, Pharmacy) and business information (for routing and dashboard customization only), then route users to appropriate modules and filter features/menu items based on their business type.
todos:
  - id: add-business-type-field
    content: Add businessType field to Tenant model and create database migration
    status: pending
  - id: extend-tenant-metadata
    content: Extend Tenant metadata structure to include business information fields
    status: pending
    dependencies:
      - add-business-type-field
  - id: create-business-type-config
    content: Create businessTypes.js config file with feature mappings for each business type
    status: pending
  - id: create-shop-type-config
    content: Create shopTypes.js config file with default inventory categories and dropdown options for each shop type
    status: pending
  - id: create-shop-type-selector
    content: Create ShopTypeSelector component for onboarding step (conditional - only if business type is shop)
    status: pending
  - id: create-app-usage-selector
    content: Create AppUsageSelector component asking "How do you want to use the app?" with user-friendly options
    status: pending
  - id: create-business-info-form
    content: Create BusinessInfoForm component with conditional fields for pharmacy
    status: pending
  - id: update-onboarding-flow
    content: Update TenantOnboarding.jsx to include business type, shop type (conditional), and business info steps
    status: pending
    dependencies:
      - create-app-usage-selector
      - create-shop-type-selector
      - create-business-info-form
  - id: update-tenant-signup
    content: Update tenantController.js signupTenant to handle businessType, shopType, and businessInfo data, and seed default categories
    status: pending
    dependencies:
      - extend-tenant-metadata
      - create-shop-type-config
  - id: create-category-seeder
    content: Create utility function to seed default inventory categories based on business type and shop type
    status: pending
    dependencies:
      - create-shop-type-config
  - id: update-feature-access
    content: Update featureAccess middleware to filter features by business type
    status: pending
    dependencies:
      - create-business-type-config
  - id: update-menu-filtering
    content: Update MainLayout.jsx to filter menu items based on business type
    status: pending
    dependencies:
      - update-feature-access
  - id: create-business-type-hook
    content: Create useBusinessType hook to fetch and cache business type
    status: pending
  - id: update-dashboard-routing
    content: Update post-onboarding redirect logic to route based on business type
    status: pending
    dependencies:
      - update-tenant-signup
  - id: create-business-info-display
    content: Create BusinessInfoDisplay component to show business information in Settings
    status: pending
    dependencies:
      - extend-tenant-metadata
  - id: update-settings-page
    content: Update Settings.jsx to display business type and business information
    status: pending
    dependencies:
      - create-business-info-display
  - id: update-feature-registry
    content: Update features.js and modules.js to include businessType requirements
    status: pending
    dependencies:
      - create-business-type-config
  - id: test-onboarding-flow
    content: Test complete onboarding flow with all business types and business info scenarios
    status: pending
    dependencies:
      - update-onboarding-flow
      - update-tenant-signup
      - update-dashboard-routing
---

# Business Type Selection & Business Information Onboarding Flow

## Current State Analysis

### Existing Onboarding Flow

- **Location**: `Frontend/src/pages/TenantOnboarding.jsx`
- **Current Steps**:

  1. Get Started - Email collection
  2. Account Owner - Name collection  
  3. Security - Password creation

- **Missing**: Business type selection, business information collection, module routing

### Tenant Model

- **Location**: `Backend/models/Tenant.js`
- **Current Fields**: `name`, `slug`, `plan`, `metadata` (JSONB), `status`
- **Metadata Field**: Can store custom data like business type and business information
- **No Business Type Field**: Currently no dedicated field for business type

### Menu System

- **Location**: `Frontend/src/layouts/MainLayout.jsx`
- **Current State**: Hardcoded menu items, no filtering based on business type
- **All Users See**: Same menu items regardless of business type

### Feature Access

- **Location**: `Backend/config/features.js`, `Backend/config/modules.js`
- **Current Logic**: Features determined by subscription plan only
- **Missing**: Business type-based feature filtering

## Proposed Solution

### 1. Database Schema Changes

#### Add Business Type Field to Tenant Model

- **File**: `Backend/models/Tenant.js`
- **Change**: Add `businessType` field (ENUM: 'printing_press', 'shop', 'pharmacy')
- **Migration**: Create migration to add column and populate existing tenants
```javascript
businessType: {
  type: DataTypes.ENUM('printing_press', 'shop', 'pharmacy'),
  allowNull: true, // Allow null for existing tenants
  defaultValue: null
}
```


#### Extend Tenant Metadata for Business Information

- **File**: `Backend/models/Tenant.js` (metadata JSONB field)
- **Structure**:
```javascript
metadata: {
  // Existing fields
  website: string,
  email: string,
  phone: string,
  signupSource: string,
  
  // New business information fields (for routing/dashboard purposes only)
  businessInfo: {
    businessRegistrationNumber: string,
    taxIdentificationNumber: string,
    businessLicenseNumber: string,
    registrationDate: date,
    businessAddress: {
      street: string,
      city: string,
      state: string,
      country: string,
      postalCode: string
    },
    businessOwner: {
      name: string,
      idNumber: string,
      idType: 'national_id' | 'passport' | 'drivers_license',
      dateOfBirth: date
    }
    // For Pharmacy: Additional regulatory fields
    // pharmacyLicenseNumber: string,
    // regulatoryBodyRegistration: string,
    // licenseExpiryDate: date
  },
  // Shop type (only if businessType is 'shop')
  shopType: string // e.g., 'supermarket', 'hardware', 'electronics', etc.
}
```


### 2. Enhanced Onboarding Flow

#### Update TenantOnboarding Component

- **File**: `Frontend/src/pages/TenantOnboarding.jsx`
- **New Steps**:

  1. Get Started - Email collection (existing)
  2. Account Owner - Name collection (existing)
  3. How do you want to use the app? - NEW (user-friendly question)
  4. Shop Type Selection - NEW (conditional - only if "To manage my shop" selected)
  5. Business Information - NEW (conditional based on selection, for routing/dashboard only)
  6. Security - Password creation (existing)

#### "How do you want to use the app?" Step

- **Question**: "How do you want to use the app?"
- **Options** (user-friendly language):
  - To manage my shop
  - To manage my pharmacy
  - To manage my printing studio
- **UI**: Radio cards with icons and descriptions
- **Validation**: Required field - user must select exactly one option
- **Mapping**:
  - "To manage my shop" → `businessType: 'shop'`
  - "To manage my pharmacy" → `businessType: 'pharmacy'`
  - "To manage my printing studio" → `businessType: 'printing_press'`

#### Shop Type Selection Step (Conditional)

- **Condition**: Only shown if user selected "To manage my shop"
- **Question**: "What type of shop do you manage?"
- **Options** (with icons and descriptions):
  - Supermarket/Grocery Store
  - Hardware Store
  - Electronics Store
  - Clothing/Fashion Store
  - Furniture Store
  - Bookstore
  - Auto Parts Store
  - General Store/Convenience Store
  - Beauty/Cosmetics Store
  - Sports Store
  - Toy Store
  - Pet Store
  - Stationery Store
  - Other (with text input)
- **UI**: Radio cards with icons and descriptions
- **Validation**: Required field if business type is 'shop'
- **Purpose**: Determines default inventory categories and dropdown options

#### Business Information Step

- **Fields** (conditional - more required for pharmacy):
  - Business Registration Number
  - Tax Identification Number (TIN)
  - Business License Number
  - Business Address (full address)
  - Business Owner Information:
    - Full Name
    - ID Number
    - ID Type (National ID, Passport, Driver's License)
    - Date of Birth
  - For Pharmacy: Additional regulatory fields
    - Pharmacy License Number
    - Regulatory Body Registration
    - Expiry Date

### 3. Backend Controller Updates

#### Update Tenant Signup Controller

- **File**: `Backend/controllers/tenantController.js`
- **Changes**:
  - Accept `businessType` in signup payload
  - Accept `shopType` in signup payload (conditional - only if businessType is 'shop')
  - Accept `businessInfo` object in signup payload
  - Store `businessType` in tenant record
  - Store `shopType` in `metadata.shopType` (for routing/dashboard purposes)
  - Store business information in `metadata.businessInfo` (for routing/dashboard purposes)
  - Set default features/modules based on business type
  - Seed default inventory categories based on business type and shop type
```javascript
exports.signupTenant = async (req, res, next) => {
  const {
    businessType, // NEW
    shopType, // NEW (conditional - only if businessType is 'shop')
    businessInfo, // NEW
    // ... existing fields
  } = req.body;
  
  // Create tenant with businessType
  const tenant = await Tenant.create({
    name: trimmedCompanyName,
    slug,
    plan,
    businessType, // NEW
    metadata: {
      // ... existing metadata
      shopType: shopType || null, // NEW - for routing/dashboard only
      businessInfo: businessInfo || null // NEW - for routing/dashboard only
    }
  });
  
  // Seed default inventory categories based on business type and shop type
  await seedDefaultCategories(tenant.id, businessType, shopType);
  
  // Set default modules based on businessType
  // ... logic to enable appropriate modules
};
```


### 4. Feature/Module Filtering

#### Update Feature Access Middleware

- **File**: `Backend/middleware/featureAccess.js`
- **Changes**: Filter features based on both plan AND business type
```javascript
const getTenantFeatures = async (tenantId) => {
  const tenant = await Tenant.findByPk(tenantId);
  const planFeatures = getFeaturesForPlan(tenant.plan);
  
  // Filter by business type
  const businessTypeFeatures = getFeaturesForBusinessType(tenant.businessType);
  
  // Return intersection
  return planFeatures.filter(f => businessTypeFeatures.includes(f));
};
```


#### Create Business Type Feature Mapping

- **File**: `Backend/config/businessTypes.js` (NEW)
- **Structure**:
```javascript
const BUSINESS_TYPE_FEATURES = {
  printing_press: [
    'crm', 'quoteAutomation', 'jobAutomation', 
    'paymentsExpenses', 'inventory', 'reports'
  ],
  shop: [
    'crm', 'inventory', 'paymentsExpenses', 
    'reports', 'shopManagement', 'pos'
  ],
  pharmacy: [
    'crm', 'inventory', 'paymentsExpenses',
    'reports', 'pharmacyManagement', 'prescriptions'
  ]
};
```


#### Create Shop Type Configuration

- **File**: `Backend/config/shopTypes.js` (NEW)
- **Purpose**: Define default inventory categories for each shop type
- **Structure**: See detailed shop types configuration above with default categories for:
  - Supermarket/Grocery Store
  - Hardware Store
  - Electronics Store
  - Clothing/Fashion Store
  - Furniture Store
  - Bookstore
  - Auto Parts Store
  - General Store/Convenience Store
  - Beauty/Cosmetics Store
  - Sports Store
  - Toy Store
  - Pet Store
  - Stationery Store
  - Other

#### Create Category Seeder Utility

- **File**: `Backend/utils/categorySeeder.js` (NEW)
- **Purpose**: Seed default inventory categories based on business type and shop type
- **Function**:
```javascript
const { InventoryCategory } = require('../models');
const { SHOP_TYPES } = require('../config/shopTypes');

async function seedDefaultCategories(tenantId, businessType, shopType) {
  let categories = [];
  
  if (businessType === 'printing_press') {
    // Use existing printing press categories
    categories = [/* existing printing press categories */];
  } else if (businessType === 'shop' && shopType) {
    // Get categories from shop type configuration
    const shopConfig = SHOP_TYPES[shopType];
    if (shopConfig) {
      categories = shopConfig.defaultCategories;
    }
  } else if (businessType === 'pharmacy') {
    // Pharmacy-specific categories
    categories = [
      { name: 'Prescription Drugs', description: 'Prescription medications' },
      { name: 'Over-the-Counter', description: 'OTC medications and health products' },
      { name: 'Vitamins & Supplements', description: 'Vitamins and dietary supplements' },
      { name: 'Personal Care', description: 'Health and personal care products' },
      { name: 'Medical Supplies', description: 'Medical equipment and supplies' }
    ];
  }
  
  // Create categories for tenant
  for (const category of categories) {
    await InventoryCategory.create({
      tenantId,
      name: category.name,
      description: category.description,
      isActive: true
    });
  }
}
```


### 5. Frontend Menu Filtering

#### Update MainLayout Component

- **File**: `Frontend/src/layouts/MainLayout.jsx`
- **Changes**:
  - Fetch tenant business type from context/API
  - Filter menu items based on business type
  - Show only relevant modules in sidebar
```javascript
const getMenuItemsForBusinessType = (businessType) => {
  const allMenuItems = [/* existing items */];
  
  switch(businessType) {
    case 'printing_press':
      return allMenuItems.filter(item => 
        ['/dashboard', '/jobs', '/leads', '/customers', 
         '/quotes', '/invoices', '/expenses', '/pricing',
         '/inventory', '/reports'].includes(item.key)
      );
    case 'shop':
      return allMenuItems.filter(item =>
        ['/dashboard', '/customers', '/products', '/pos',
         '/sales', '/inventory', '/reports'].includes(item.key)
      );
    case 'pharmacy':
      return allMenuItems.filter(item =>
        ['/dashboard', '/customers', '/drugs', '/prescriptions',
         '/inventory', '/reports'].includes(item.key)
      );
    default:
      return allMenuItems; // Fallback to all for existing tenants without businessType
  }
};
```


### 6. Post-Onboarding Routing

#### Create Onboarding Completion Handler

- **File**: `Frontend/src/pages/TenantOnboarding.jsx`
- **Logic**: After successful signup, redirect based on business type:
  - Printing Press → `/dashboard` (existing)
  - Shop → `/shops` or `/dashboard` with shop-focused view
  - Pharmacy → `/pharmacies` or `/dashboard` with pharmacy-focused view

#### Update Dashboard Component

- **File**: `Frontend/src/pages/Dashboard.jsx`
- **Changes**: Show business-type-specific widgets and metrics
- **Logic**: Fetch tenant business type and render appropriate dashboard

### 7. Settings Page Updates

#### Add Business Type Display

- **File**: `Frontend/src/pages/Settings.jsx`
- **Changes**: 
  - Show current business type (read-only, cannot be changed after signup)
  - Show business information (for reference only, not for verification)

### 8. Migration Strategy

#### Database Migration

- **File**: `Backend/migrations/XXXX-add-business-type.js`
- **Steps**:

  1. Add `businessType` column to tenants table
  2. Set default value for existing tenants (e.g., 'printing_press')
  3. Business information stored in metadata JSONB (no migration needed, handled in code)

#### Data Migration

- Update existing tenants:
  - Set `businessType = 'printing_press'` for all existing tenants
  - Preserve existing metadata structure

## Implementation Files

### New Files (9 files)

1. `Backend/config/businessTypes.js` - Business type feature mapping
2. `Backend/config/shopTypes.js` - Shop type configuration with default categories
3. `Backend/migrations/XXXX-add-business-type.js` - Database migration
4. `Frontend/src/components/AppUsageSelector.jsx` - "How do you want to use the app?" selection component
5. `Frontend/src/components/ShopTypeSelector.jsx` - Shop type selection component (conditional)
6. `Frontend/src/components/BusinessInfoForm.jsx` - Business information form component
7. `Backend/utils/businessTypeUtils.js` - Business type utility functions
8. `Backend/utils/categorySeeder.js` - Utility to seed default categories based on business/shop type
9. `Frontend/src/hooks/useBusinessType.js` - Hook to get current business type
10. `Frontend/src/components/BusinessInfoDisplay.jsx` - Business information display component (optional, for Settings page)

### Modified Files (6 files)

1. `Backend/models/Tenant.js` - Add businessType field
2. `Backend/controllers/tenantController.js` - Handle business type and business info in signup
3. `Frontend/src/pages/TenantOnboarding.jsx` - Add business type and business info steps
4. `Frontend/src/layouts/MainLayout.jsx` - Filter menu items by business type
5. `Backend/middleware/featureAccess.js` - Filter features by business type
6. `Frontend/src/pages/Settings.jsx` - Display business type and business information

## User Flow Diagram

```
User Signs Up
    ↓
Step 1: Email Collection
    ↓
Step 2: Name Collection
    ↓
Step 3: How do you want to use the app?
    ├─→ To manage my shop
    ├─→ To manage my pharmacy
    └─→ To manage my printing studio
    ↓
Step 4: What type of shop do you manage? (conditional - only if "To manage my shop" selected)
    ├─→ Supermarket/Grocery Store
    ├─→ Hardware Store
    ├─→ Electronics Store
    ├─→ Clothing/Fashion Store
    ├─→ Furniture Store
    ├─→ Bookstore
    ├─→ Auto Parts Store
    ├─→ General Store/Convenience Store
    ├─→ Beauty/Cosmetics Store
    ├─→ Sports Store
    ├─→ Toy Store
    ├─→ Pet Store
    ├─→ Stationery Store
    └─→ Other
    ↓
Step 5: Business Information (conditional)
    ├─→ Basic Info (all) - for routing/dashboard customization
    └─→ Regulatory Info (pharmacy) - for routing/dashboard customization
    ↓
Step 6: Password Creation
    ↓
Tenant Created with businessType and shopType (if applicable)
    ↓
Default Categories Seeded Based on Business/Shop Type
    ↓
Redirect Based on Business Type
    ├─→ Printing Press → /dashboard (existing)
    ├─→ Shop → /shops or /dashboard
    └─→ Pharmacy → /pharmacies or /dashboard
    ↓
Menu Filtered by Business Type
    ↓
Features Enabled Based on Business Type
```

## Business Information Usage

```
Business Information Collected
    ↓
Used for Routing
    ├─→ Determine which modules to show
    ├─→ Filter menu items
    └─→ Enable appropriate features
    ↓
Used for Dashboard Customization
    ├─→ Show relevant widgets
    ├─→ Display business-type-specific metrics
    └─→ Customize dashboard layout
```

**Note**: Business information is NOT verified by admins. It's collected solely for routing and dashboard customization purposes.

## Configuration Updates

### Feature Registry

- **File**: `Backend/config/features.js`
- **Add**: Business type requirements to each feature
```javascript
{
  key: 'shopManagement',
  name: 'Shop Management',
  businessTypes: ['shop'], // NEW
  // ... existing fields
}
```


### Module Registry  

- **File**: `Backend/config/modules.js`
- **Add**: Business type requirements to each module
```javascript
{
  key: 'shop',
  name: 'Shop Management',
  businessTypes: ['shop'], // NEW
  // ... existing fields
}
```


## Testing Considerations

1. **Onboarding Flow**: Test all app usage selections ("To manage my shop", "To manage my pharmacy", "To manage my printing studio")
2. **Shop Type Selection**: Test shop type selection appears only when "To manage my shop" is selected
3. **Default Categories**: Verify correct default inventory categories are seeded for each shop type
4. **Business Information Collection**: Test conditional fields for pharmacy
5. **Menu Filtering**: Verify correct menu items show for each type
6. **Feature Access**: Verify features are correctly filtered
7. **Migration**: Test migration on existing tenants (default to 'printing_press')
8. **Business Type Immutability**: Verify business type cannot be changed after signup
9. **Shop Type Immutability**: Verify shop type cannot be changed after signup
10. **Dashboard Customization**: Verify dashboard shows relevant widgets/metrics based on business type
11. **Routing**: Verify users are routed to appropriate modules after signup
12. **Dropdown Options**: Verify default dropdown options match shop type (e.g., inventory categories)