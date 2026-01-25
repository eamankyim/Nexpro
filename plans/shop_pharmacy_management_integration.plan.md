---
name: Shop & Pharmacy Management Integration
overview: Add Shop Management and Pharmacy Management modules to the existing Nexpro application, reusing the multi-tenant architecture, authentication, inventory patterns, and UI components while creating domain-specific features for retail and pharmacy operations.
todos:
  - id: analyze-reusability
    content: Analyze existing codebase patterns and identify reusable components
    status: pending
  - id: create-shop-models
    content: Create Shop management database models (Shop, Product, Sale, SaleItem, ProductVariant, Barcode)
    status: pending
    dependencies:
      - analyze-reusability
  - id: create-pharmacy-models
    content: Create Pharmacy management database models (Pharmacy, Drug, Prescription, PrescriptionItem, DrugInteraction, ExpiryAlert)
    status: pending
    dependencies:
      - analyze-reusability
  - id: create-shop-controllers
    content: Create Shop backend controllers (shopController, productController, saleController) following existing patterns
    status: pending
    dependencies:
      - create-shop-models
  - id: create-pharmacy-controllers
    content: Create Pharmacy backend controllers (pharmacyController, drugController, prescriptionController) following existing patterns
    status: pending
    dependencies:
      - create-pharmacy-models
  - id: create-backend-routes
    content: Create backend routes for shop and pharmacy modules with tenantContext middleware
    status: pending
    dependencies:
      - create-shop-controllers
      - create-pharmacy-controllers
  - id: create-frontend-services
    content: Create frontend API services (shopService, productService, saleService, pharmacyService, drugService, prescriptionService)
    status: pending
    dependencies:
      - create-backend-routes
  - id: create-shop-pages
    content: Create Shop frontend pages (Shops.jsx, Products.jsx, POS.jsx, Sales.jsx) reusing patterns from Customers.jsx and Inventory.jsx
    status: pending
    dependencies:
      - create-frontend-services
  - id: create-pharmacy-pages
    content: Create Pharmacy frontend pages (Pharmacies.jsx, Drugs.jsx, Prescriptions.jsx) reusing patterns from existing pages
    status: pending
    dependencies:
      - create-frontend-services
  - id: create-specialized-components
    content: Create specialized components (POSInterface.jsx, PrescriptionForm.jsx, DrugInteractionChecker.jsx)
    status: pending
    dependencies:
      - create-shop-pages
      - create-pharmacy-pages
  - id: update-configuration
    content: Update feature registry, module registry, routing, and navigation menu
    status: pending
    dependencies:
      - create-specialized-components
  - id: create-migrations
    content: Create database migrations for all new tables and extend Customer table
    status: pending
    dependencies:
      - create-shop-models
      - create-pharmacy-models
  - id: integrate-existing-modules
    content: Integrate with existing Customer, Invoice, and Inventory modules
    status: pending
    dependencies:
      - update-configuration
---

# Shop & Pharmacy Management Integration Plan

## Overview

This plan outlines how to add Shop Management and Pharmacy Management modules to Nexpro, maximizing code reuse while creating domain-specific features. The modules will be fully integrated with existing features (customers, invoices, inventory, etc.).

## Reusable Components & Infrastructure

### 1. **Multi-Tenant Architecture** (100% Reusable)

- **Location**: `Backend/middleware/tenant.js`, `Backend/utils/tenantUtils.js`
- **Reuse**: All new models will use `tenantId` foreign key pattern
- **Pattern**: Use `applyTenantFilter(req.tenantId, where)` in all queries
- **Example**: `Shop`, `Pharmacy`, `Product`, `Sale` models will follow same pattern as `Customer`, `Job`, `Invoice`

### 2. **Authentication & Authorization** (100% Reusable)

- **Location**: `Backend/middleware/auth.js`, `Frontend/context/AuthContext.jsx`
- **Reuse**: 
  - JWT authentication
  - Role-based access control (ADMIN, MANAGER, USER)
  - `protect` and `authorize` middleware
  - `PrivateRoute` component
- **Extension**: Add shop/pharmacy-specific roles if needed (e.g., `SHOP_MANAGER`, `PHARMACIST`)

### 3. **API Service Pattern** (100% Reusable)

- **Location**: `Frontend/src/services/*.js`
- **Pattern**: All services follow same structure:
  ```javascript
  import api from './api';
  const shopService = {
    getAll: async (params) => api.get('/shops', { params }),
    getById: async (id) => api.get(`/shops/${id}`),
    create: async (data) => api.post('/shops', data),
    update: async (id, data) => api.put(`/shops/${id}`, data),
    delete: async (id) => api.delete(`/shops/${id}`)
  };
  ```

- **Reuse**: Create `shopService.js` and `pharmacyService.js` following this pattern

### 4. **UI Components** (90% Reusable)

- **Location**: `Frontend/src/components/`
- **Reusable Components**:
  - `ActionColumn.jsx` - Table action buttons (View/Edit/Delete)
  - `DetailsDrawer.jsx` - Side drawer for viewing details
  - `PhoneNumberInput.jsx` - Phone input with validation
- **Reusable Patterns**:
  - Ant Design Form patterns from `Customers.jsx`, `Jobs.jsx`
  - Table with pagination, search, filters
  - Modal forms for create/edit
  - Status tags and badges

### 5. **Database Models Pattern** (100% Reusable)

- **Location**: `Backend/models/`
- **Pattern**: All models follow Sequelize pattern with:
  - `tenantId` foreign key
  - Timestamps (`createdAt`, `updatedAt`)
  - Relationships defined in `models/index.js`
- **Example Structure**:
  ```javascript
  // Backend/models/Shop.js
  module.exports = (sequelize, DataTypes) => {
    const Shop = sequelize.define('Shop', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenantId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      // ... other fields
    });
    return Shop;
  };
  ```


### 6. **Controller Pattern** (95% Reusable)

- **Location**: `Backend/controllers/`
- **Pattern**: All controllers follow same structure:
  - Use `applyTenantFilter(req.tenantId, where)` for queries
  - Standard CRUD operations
  - Pagination support
  - Search/filter capabilities
- **Reuse**: Copy pattern from `customerController.js` or `inventoryController.js`

### 7. **Route Pattern** (100% Reusable)

- **Location**: `Backend/routes/`
- **Pattern**: All routes follow same structure:
  ```javascript
  const router = express.Router();
  router.use(protect);
  router.use(tenantContext);
  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);
  ```

- **Reuse**: Create `shopRoutes.js` and `pharmacyRoutes.js` following this pattern

### 8. **Frontend Page Pattern** (85% Reusable)

- **Location**: `Frontend/src/pages/`
- **Reusable Patterns from `Customers.jsx` and `Inventory.jsx`**:
  - State management (useState, useEffect)
  - Form handling with Ant Design
  - Table with pagination
  - Search and filter UI
  - Modal forms
  - Details drawer
  - Toast notifications
- **Reuse**: Copy structure from `Customers.jsx` or `Inventory.jsx` as base

### 9. **Inventory System** (80% Reusable for Shop)

- **Location**: `Backend/models/InventoryItem.js`, `Backend/controllers/inventoryController.js`, `Frontend/src/pages/Inventory.jsx`
- **Reuse for Shop**:
  - Stock tracking logic
  - Low stock alerts
  - Category management
  - Stock movements
- **Extend for Shop**: Add barcode scanning, product variants (size, color), pricing tiers

### 10. **Invoice/Quote System** (90% Reusable)

- **Location**: `Backend/models/Invoice.js`, `Frontend/src/pages/Invoices.jsx`
- **Reuse for Shop/Pharmacy**:
  - Sales invoice generation
  - Payment tracking
  - Receipt printing
- **Extend**: Add POS-specific features (quick checkout, cash drawer integration)

### 11. **Customer Management** (100% Reusable)

- **Location**: `Backend/models/Customer.js`, `Frontend/src/pages/Customers.jsx`
- **Reuse**: Shop customers and pharmacy patients can use existing Customer model
- **Extend**: Add customer loyalty points, purchase history, prescription history

### 12. **Dashboard & Reporting** (85% Reusable)

- **Location**: `Backend/controllers/dashboardController.js`, `Frontend/src/pages/Dashboard.jsx`
- **Reuse**: Dashboard structure, chart components, statistics cards
- **Extend**: Add shop/pharmacy-specific metrics (daily sales, top products, prescription stats)

## New Components to Create

### Backend Models

1. **Shop Management**:

   - `Shop.js` - Shop locations/branches
   - `Product.js` - Shop products (extends InventoryItem)
   - `Sale.js` - Sales transactions
   - `SaleItem.js` - Individual items in a sale
   - `ProductVariant.js` - Product variants (size, color, etc.)
   - `Barcode.js` - Barcode management

2. **Pharmacy Management**:

   - `Pharmacy.js` - Pharmacy locations
   - `Drug.js` - Drug/medication catalog
   - `Prescription.js` - Prescription records
   - `PrescriptionItem.js` - Individual drugs in prescription
   - `DrugInteraction.js` - Drug interaction database
   - `ExpiryAlert.js` - Drug expiry tracking

### Backend Controllers

1. **Shop Controllers**:

   - `shopController.js` - Shop CRUD
   - `productController.js` - Product management
   - `saleController.js` - Sales/POS operations
   - `barcodeController.js` - Barcode scanning

2. **Pharmacy Controllers**:

   - `pharmacyController.js` - Pharmacy CRUD
   - `drugController.js` - Drug catalog management
   - `prescriptionController.js` - Prescription management
   - `drugInteractionController.js` - Interaction checking

### Backend Routes

- `shopRoutes.js` - Shop API routes
- `productRoutes.js` - Product API routes
- `saleRoutes.js` - Sales API routes
- `pharmacyRoutes.js` - Pharmacy API routes
- `drugRoutes.js` - Drug API routes
- `prescriptionRoutes.js` - Prescription API routes

### Frontend Pages

- `Shops.jsx` - Shop management page
- `Products.jsx` - Product catalog page
- `POS.jsx` - Point of Sale interface
- `Sales.jsx` - Sales history page
- `Pharmacies.jsx` - Pharmacy management page
- `Drugs.jsx` - Drug catalog page
- `Prescriptions.jsx` - Prescription management page

### Frontend Services

- `shopService.js` - Shop API service
- `productService.js` - Product API service
- `saleService.js` - Sales API service
- `pharmacyService.js` - Pharmacy API service
- `drugService.js` - Drug API service
- `prescriptionService.js` - Prescription API service

### Frontend Components

- `POSInterface.jsx` - Point of Sale UI component
- `BarcodeScanner.jsx` - Barcode scanning component
- `PrescriptionForm.jsx` - Prescription entry form
- `DrugInteractionChecker.jsx` - Drug interaction validation
- `ExpiryAlert.jsx` - Drug expiry warning component

## Integration Points

### 1. **Shared Customer Base**

- Shop customers and pharmacy patients use existing `Customer` model
- Add `customerType` field: `'shop'`, `'pharmacy'`, `'both'`, `'general'`

### 2. **Unified Inventory**

- Shop products can reference `InventoryItem` for stock tracking
- Pharmacy drugs can use separate `Drug` model but share inventory movement patterns

### 3. **Shared Invoicing**

- Shop sales generate invoices using existing `Invoice` model
- Pharmacy prescriptions can generate invoices for payment tracking

### 4. **Unified Reporting**

- Extend `Dashboard.jsx` to show shop/pharmacy metrics
- Add shop/pharmacy filters to existing reports

## Configuration Updates

### 1. **Feature Registry**

- **File**: `Backend/config/features.js`
- Add shop and pharmacy features to `FEATURE_CATALOG`

### 2. **Module Registry**

- **File**: `Backend/config/modules.js`
- Add `shop` and `pharmacy` modules to `MODULES` array

### 3. **Frontend Routing**

- **File**: `Frontend/src/App.jsx`
- Add routes for new pages:
  ```javascript
  <Route path="shops" element={<Shops />} />
  <Route path="products" element={<Products />} />
  <Route path="pos" element={<POS />} />
  <Route path="sales" element={<Sales />} />
  <Route path="pharmacies" element={<Pharmacies />} />
  <Route path="drugs" element={<Drugs />} />
  <Route path="prescriptions" element={<Prescriptions />} />
  ```


### 4. **Navigation Menu**

- **File**: `Frontend/src/layouts/MainLayout.jsx` (or similar)
- Add shop and pharmacy menu items to sidebar

### 5. **Backend Route Registration**

- **File**: `Backend/server.js`
- Register new route files:
  ```javascript
  app.use('/api/shops', shopRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/sales', saleRoutes);
  app.use('/api/pharmacies', pharmacyRoutes);
  app.use('/api/drugs', drugRoutes);
  app.use('/api/prescriptions', prescriptionRoutes);
  ```


## Database Migrations

Create migrations for:

1. Shop tables (shops, products, sales, sale_items, product_variants, barcodes)
2. Pharmacy tables (pharmacies, drugs, prescriptions, prescription_items, drug_interactions, expiry_alerts)
3. Extend Customer table with `customerType` field
4. Add foreign key relationships

## Implementation Order

1. **Phase 1: Infrastructure Setup**

   - Create database models and migrations
   - Set up backend routes and controllers (basic CRUD)
   - Create frontend services

2. **Phase 2: Shop Management**

   - Shop CRUD
   - Product catalog
   - Basic sales tracking

3. **Phase 3: POS System**

   - Point of Sale interface
   - Barcode scanning
   - Quick checkout

4. **Phase 4: Pharmacy Management**

   - Pharmacy CRUD
   - Drug catalog
   - Prescription management

5. **Phase 5: Advanced Features**

   - Drug interactions
   - Expiry tracking
   - Advanced reporting
   - Integration with existing modules

## Files to Create/Modify

### New Backend Files (15 files)

- `Backend/models/Shop.js`
- `Backend/models/Product.js`
- `Backend/models/Sale.js`
- `Backend/models/SaleItem.js`
- `Backend/models/Pharmacy.js`
- `Backend/models/Drug.js`
- `Backend/models/Prescription.js`
- `Backend/models/PrescriptionItem.js`
- `Backend/controllers/shopController.js`
- `Backend/controllers/productController.js`
- `Backend/controllers/saleController.js`
- `Backend/controllers/pharmacyController.js`
- `Backend/controllers/drugController.js`
- `Backend/controllers/prescriptionController.js`
- `Backend/routes/shopRoutes.js`, `productRoutes.js`, `saleRoutes.js`, `pharmacyRoutes.js`, `drugRoutes.js`, `prescriptionRoutes.js`

### New Frontend Files (12 files)

- `Frontend/src/pages/Shops.jsx`
- `Frontend/src/pages/Products.jsx`
- `Frontend/src/pages/POS.jsx`
- `Frontend/src/pages/Sales.jsx`
- `Frontend/src/pages/Pharmacies.jsx`
- `Frontend/src/pages/Drugs.jsx`
- `Frontend/src/pages/Prescriptions.jsx`
- `Frontend/src/services/shopService.js`
- `Frontend/src/services/productService.js`
- `Frontend/src/services/saleService.js`
- `Frontend/src/services/pharmacyService.js`
- `Frontend/src/services/drugService.js`
- `Frontend/src/services/prescriptionService.js`
- `Frontend/src/components/POSInterface.jsx`
- `Frontend/src/components/PrescriptionForm.jsx`

### Modified Files (8 files)

- `Backend/models/index.js` - Add relationships
- `Backend/config/features.js` - Add features
- `Backend/config/modules.js` - Add modules
- `Backend/server.js` - Register routes
- `Frontend/src/App.jsx` - Add routes
- `Frontend/src/layouts/MainLayout.jsx` - Add menu items
- `Backend/models/Customer.js` - Add customerType field (migration)
- Database migrations folder - Add new migration files