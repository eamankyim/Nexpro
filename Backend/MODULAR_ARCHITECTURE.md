# Backend Modular Architecture

## Overview

The ShopWISE backend is built with a modular architecture that supports multiple business types (Printing Press, Shop, Pharmacy) while maximizing code reuse.

## Module Classification

### 🔄 **Reusable Modules** (Available for ALL Business Types)

These modules are shared across all business types and follow the multi-tenant pattern:

#### 1. **CRM & Contacts Module**
- **Models**: `Customer`, `Vendor`
- **Controllers**: `customerController`, `vendorController`
- **Routes**: `/api/customers`, `/api/vendors`
- **Business Types**: `printing_press`, `shop`, `pharmacy`
- **Usage**:
  - Printing Press: Customers and vendors for jobs/quotes
  - Shop: Customers for sales transactions
  - Pharmacy: Patients/customers for prescriptions

#### 2. **Inventory Module**
- **Models**: `InventoryCategory`, `InventoryItem`, `InventoryMovement`
- **Controllers**: `inventoryController`
- **Routes**: `/api/inventory`
- **Business Types**: `printing_press`, `shop`, `pharmacy`
- **Usage**:
  - Printing Press: Printing supplies and materials
  - Shop: Product inventory (can also use Product model)
  - Pharmacy: Drug inventory (can also use Drug model)
- **Note**: Categories are seeded differently based on business/shop type

#### 3. **Finance & Billing Module**
- **Models**: `Invoice`, `Payment`, `Expense`
- **Controllers**: `invoiceController`, `expenseController`
- **Routes**: `/api/invoices`, `/api/expenses`
- **Business Types**: `printing_press`, `shop`, `pharmacy`
- **Usage**:
  - Printing Press: Job invoices, vendor payments
  - Shop: Sales invoices, purchase expenses
  - Pharmacy: Prescription invoices, supplier expenses

#### 4. **Accounting Module**
- **Models**: `Account`, `JournalEntry`, `JournalEntryLine`, `AccountBalance`
- **Controllers**: `accountingController`
- **Routes**: `/api/accounting`
- **Business Types**: `printing_press`, `shop`, `pharmacy`
- **Usage**: Unified accounting system for all business types

#### 5. **Reports & Analytics Module**
- **Controllers**: `dashboardController`, `reportController`
- **Routes**: `/api/dashboard`, `/api/reports`
- **Business Types**: `printing_press`, `shop`, `pharmacy`
- **Usage**: Business-type-specific dashboards and reports

#### 6. **Settings Module**
- **Models**: `Setting`
- **Controllers**: `settingsController`
- **Routes**: `/api/settings`
- **Business Types**: `printing_press`, `shop`, `pharmacy`
- **Usage**: Organization settings, preferences, configuration

#### 7. **User & Team Management Module**
- **Models**: `User`, `UserTenant`, `Employee`
- **Controllers**: `userController`, `employeeController`
- **Routes**: `/api/users`, `/api/employees`
- **Business Types**: `printing_press`, `shop`, `pharmacy`
- **Usage**: User management, roles, permissions

---

### 🖨️ **Printing Press Specific Modules**

These modules are ONLY available for `printing_press` business type:

#### 1. **Job Management Module**
- **Models**: `Job`, `JobItem`, `JobStatusHistory`
- **Controllers**: `jobController`
- **Routes**: `/api/jobs`
- **Business Types**: `printing_press` only
- **Features**: Job workflow, status tracking, job-to-invoice conversion

#### 2. **Sales & Quoting Module**
- **Models**: `Quote`, `QuoteItem`, `PricingTemplate`, `VendorPriceList`
- **Controllers**: `quoteController`, `pricingController`
- **Routes**: `/api/quotes`, `/api/pricing`
- **Business Types**: `printing_press` only
- **Features**: Quote generation, pricing templates, quote-to-job conversion

#### 3. **Lead Pipeline Module**
- **Models**: `Lead`, `LeadActivity`
- **Controllers**: `leadController`
- **Routes**: `/api/leads`
- **Business Types**: `printing_press` only
- **Features**: Lead tracking, conversion pipeline

---

### 🏪 **Shop Management Specific Modules**

These modules are ONLY available for `shop` business type:

#### 1. **Shop Management Module**
- **Models**: `Shop`
- **Controllers**: `shopController`
- **Routes**: `/api/shops`
- **Business Types**: `shop` only
- **Features**: Multi-location shop management

#### 2. **Product Catalog Module**
- **Models**: `Product`, `ProductVariant`, `Barcode`
- **Controllers**: `productController`
- **Routes**: `/api/products`
- **Business Types**: `shop` only
- **Features**: 
  - Product management with variants (size, color, etc.)
  - Barcode scanning support
  - Stock tracking
  - Category management (uses InventoryCategory)

#### 3. **Point of Sale (POS) Module**
- **Models**: `Sale`, `SaleItem`
- **Controllers**: `saleController`
- **Routes**: `/api/sales`
- **Business Types**: `shop` only
- **Features**:
  - Quick checkout
  - Multiple payment methods
  - Automatic stock deduction
  - Sale cancellation with stock restoration
  - Invoice generation (links to Invoice model)

---

### 💊 **Pharmacy Management Specific Modules**

These modules are ONLY available for `pharmacy` business type:

#### 1. **Pharmacy Management Module**
- **Models**: `Pharmacy`
- **Controllers**: `pharmacyController`
- **Routes**: `/api/pharmacies`
- **Business Types**: `pharmacy` only
- **Features**: Multi-location pharmacy management

#### 2. **Drug Catalog Module**
- **Models**: `Drug`, `ExpiryAlert`
- **Controllers**: `drugController`
- **Routes**: `/api/drugs`
- **Business Types**: `pharmacy` only
- **Features**:
  - Drug inventory with classification (prescription/OTC/controlled)
  - Expiry date tracking
  - Batch number management
  - Low stock alerts
  - Expiry alerts (30/60/90 days)

#### 3. **Prescription Management Module**
- **Models**: `Prescription`, `PrescriptionItem`, `DrugInteraction`
- **Controllers**: `prescriptionController`
- **Routes**: `/api/prescriptions`
- **Business Types**: `pharmacy` only
- **Features**:
  - Prescription creation and tracking
  - Prescription filling with stock deduction
  - Drug interaction checking
  - Partial filling support
  - Invoice generation (links to Invoice model)

---

## Module Integration Points

### Shared Customer Base
- **All business types** use the same `Customer` model
- Shop sales link to `Customer`
- Pharmacy prescriptions link to `Customer`
- Printing press jobs link to `Customer`

### Unified Inventory
- **InventoryCategory** is shared but seeded differently per business type
- Shop can use both `Product` (shop-specific) and `InventoryItem` (shared)
- Pharmacy can use both `Drug` (pharmacy-specific) and `InventoryItem` (shared)
- Stock movements follow same patterns

### Shared Invoicing
- **Invoice** model is shared across all business types
- Shop sales can generate invoices
- Pharmacy prescriptions can generate invoices
- Printing press jobs generate invoices

### Unified Reporting
- **Dashboard** shows business-type-specific metrics
- **Reports** module filters by business type
- All modules contribute to unified analytics

---

## Business Type Feature Matrix

| Module | Printing Press | Shop | Pharmacy |
|--------|---------------|------|----------|
| CRM & Contacts | ✅ | ✅ | ✅ |
| Inventory | ✅ | ✅ | ✅ |
| Finance & Billing | ✅ | ✅ | ✅ |
| Accounting | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅ |
| Settings | ✅ | ✅ | ✅ |
| Users & Teams | ✅ | ✅ | ✅ |
| Jobs | ✅ | ❌ | ❌ |
| Quotes | ✅ | ❌ | ❌ |
| Leads | ✅ | ❌ | ❌ |
| Shops | ❌ | ✅ | ❌ |
| Products | ❌ | ✅ | ❌ |
| Sales/POS | ❌ | ✅ | ❌ |
| Pharmacies | ❌ | ❌ | ✅ |
| Drugs | ❌ | ❌ | ✅ |
| Prescriptions | ❌ | ❌ | ✅ |

---

## File Structure

```
Backend/
├── models/
│   ├── Customer.js          # ✅ Reusable
│   ├── Vendor.js            # ✅ Reusable
│   ├── InventoryCategory.js # ✅ Reusable
│   ├── InventoryItem.js     # ✅ Reusable
│   ├── Invoice.js           # ✅ Reusable
│   ├── Expense.js           # ✅ Reusable
│   ├── Job.js               # 🖨️ Printing Press only
│   ├── Quote.js             # 🖨️ Printing Press only
│   ├── Shop.js              # 🏪 Shop only
│   ├── Product.js           # 🏪 Shop only
│   ├── Sale.js              # 🏪 Shop only
│   ├── Pharmacy.js           # 💊 Pharmacy only
│   ├── Drug.js              # 💊 Pharmacy only
│   └── Prescription.js      # 💊 Pharmacy only
├── controllers/
│   ├── customerController.js    # ✅ Reusable
│   ├── inventoryController.js    # ✅ Reusable
│   ├── invoiceController.js      # ✅ Reusable
│   ├── jobController.js         # 🖨️ Printing Press only
│   ├── quoteController.js       # 🖨️ Printing Press only
│   ├── shopController.js        # 🏪 Shop only
│   ├── productController.js     # 🏪 Shop only
│   ├── saleController.js        # 🏪 Shop only
│   ├── pharmacyController.js    # 💊 Pharmacy only
│   ├── drugController.js       # 💊 Pharmacy only
│   └── prescriptionController.js # 💊 Pharmacy only
├── routes/
│   ├── customerRoutes.js    # ✅ Reusable
│   ├── inventoryRoutes.js   # ✅ Reusable
│   ├── invoiceRoutes.js      # ✅ Reusable
│   ├── jobRoutes.js          # 🖨️ Printing Press only
│   ├── quoteRoutes.js        # 🖨️ Printing Press only
│   ├── shopRoutes.js         # 🏪 Shop only
│   ├── productRoutes.js      # 🏪 Shop only
│   ├── saleRoutes.js         # 🏪 Shop only
│   ├── pharmacyRoutes.js     # 💊 Pharmacy only
│   ├── drugRoutes.js         # 💊 Pharmacy only
│   └── prescriptionRoutes.js # 💊 Pharmacy only
└── config/
    ├── modules.js            # Module registry with businessType requirements
    ├── businessTypes.js       # Business type feature mappings
    └── shopTypes.js          # Shop type configurations
```

---

## Middleware & Access Control

### Feature Filtering
- **Location**: `Backend/middleware/featureAccess.js`
- **Function**: Filters features based on both subscription plan AND business type
- **Pattern**: 
  ```javascript
  const businessTypeFeatures = getFeaturesForBusinessType(tenant.businessType);
  planFeatures = planFeatures.filter(f => businessTypeFeatures.includes(f));
  ```

### Route Protection
- All routes use `protect` middleware (JWT authentication)
- All routes use `tenantContext` middleware (multi-tenant isolation)
- Routes are filtered by business type in `modules.js` config

---

## Database Schema

### Tenant Isolation
- **All tables** have `tenantId` foreign key
- **All queries** use `applyTenantFilter(req.tenantId, where)`
- **All relationships** respect tenant boundaries

### Business Type Storage
- **Tenant table**: `businessType` column (ENUM: 'printing_press', 'shop', 'pharmacy')
- **Tenant metadata**: `shopType` (for shop business type)
- **Settings**: Business information stored in `Settings.organization`

---

## Migration Strategy

1. **Run business type migration**: `add-business-type-to-tenants.js`
2. **Run shop/pharmacy tables migration**: `create-shop-pharmacy-tables.js`
3. **Models auto-sync**: Sequelize syncs models with database
4. **Categories auto-seed**: Categories seeded based on business type during onboarding

---

## Testing Checklist

- [ ] Shop models create correctly
- [ ] Pharmacy models create correctly
- [ ] Controllers handle tenant isolation
- [ ] Routes are protected and filtered
- [ ] Features filtered by business type
- [ ] Reusable modules work for all business types
- [ ] Business-type-specific modules only accessible to correct type
- [ ] Database migrations run successfully
- [ ] Relationships work correctly
- [ ] Stock updates work (sales, prescriptions)

---

## Summary

✅ **12 Reusable Modules** - Available for all business types
🖨️ **3 Printing Press Modules** - Jobs, Quotes, Leads
🏪 **3 Shop Modules** - Shops, Products, Sales/POS
💊 **3 Pharmacy Modules** - Pharmacies, Drugs, Prescriptions

**Total**: 21 modules, fully modular and business-type-aware!
