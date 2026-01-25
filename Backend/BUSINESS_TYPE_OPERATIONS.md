# Business Type Specific Operations

This document outlines the specific operations implemented for each business type.

## Printing Press Operations ✅

### Core Operations
1. **Quote to Job Conversion** ✅
   - Endpoint: `POST /api/quotes/:id/convert`
   - Converts an accepted quote into a job
   - Automatically creates job items from quote items
   - Updates quote status to 'accepted'

2. **Job to Invoice Auto-Generation** ✅
   - Automatically generates invoice when job status changes to 'completed'
   - Endpoint: `PUT /api/jobs/:id` (when status = 'completed')
   - Creates invoice with job items and pricing
   - Links invoice to job via `jobId`

3. **Manual Invoice Creation from Job** ✅
   - Endpoint: `POST /api/invoices` (with `jobId`)
   - Allows manual invoice creation before job completion
   - Prevents duplicate invoices for the same job

4. **Job Status Workflow** ✅
   - Status tracking: `new`, `in_progress`, `on_hold`, `cancelled`, `completed`
   - Status history tracking via `JobStatusHistory` model
   - Activity logging for status changes

## Shop Operations ✅

### Core Operations
1. **POS Sales with Stock Deduction** ✅
   - Endpoint: `POST /api/sales`
   - Creates sale transaction
   - Automatically deducts stock from products/variants
   - Supports multiple payment methods
   - Tracks sale items with quantities and prices

2. **Sale Cancellation with Stock Restoration** ✅
   - Endpoint: `POST /api/sales/:id/cancel`
   - Cancels sale and restores stock to inventory
   - Updates sale status to 'cancelled' or 'refunded'
   - Prevents double cancellation

3. **Barcode Scanning** ✅
   - Endpoint: `GET /api/products/barcode/:barcode`
   - Retrieves product by barcode
   - Supports product variants with barcodes

4. **Product Variants** ✅
   - Supports size, color, and other variant attributes
   - Separate inventory tracking per variant
   - Variant-specific pricing

5. **Sale to Invoice Generation** ✅ (NEW)
   - Endpoint: `POST /api/sales/:id/generate-invoice`
   - Generates invoice from completed sale
   - Links invoice to sale via `saleId`
   - Sets `sourceType` to 'sale'

6. **Receipt Printing** ✅ (NEW)
   - Endpoint: `GET /api/sales/:id/receipt`
   - Returns receipt data for printing
   - Includes sale details, items, payment info, and shop details

## Pharmacy Operations ✅

### Core Operations
1. **Prescription Filling with Stock Deduction** ✅
   - Endpoint: `POST /api/prescriptions/:id/fill`
   - Fills prescription items and deducts drug stock
   - Supports partial filling when stock is insufficient
   - Updates prescription status: `pending`, `filled`, `partially_filled`, `cancelled`

2. **Drug Interaction Checking** ✅
   - Endpoint: `POST /api/prescriptions/check-interactions`
   - Checks for drug interactions before filling
   - Returns severity levels: `minor`, `moderate`, `major`, `severe`
   - Prevents filling if severe interactions detected

3. **Expiry Alerts** ✅
   - Endpoint: `GET /api/drugs/expiring`
   - Returns drugs expiring within specified days
   - Tracks expiry dates via `ExpiryAlert` model
   - Status tracking: `pending`, `notified`, `resolved`, `expired`

4. **Prescription to Invoice Generation** ✅ (NEW)
   - Endpoint: `POST /api/prescriptions/:id/generate-invoice`
   - Generates invoice from dispensed prescription
   - Only includes filled/partially filled items
   - Links invoice to prescription via `prescriptionId`
   - Sets `sourceType` to 'prescription'

5. **Prescription Label Printing** ✅ (NEW)
   - Endpoint: `GET /api/prescriptions/:id/label`
   - Returns prescription label data for printing
   - Includes patient info, doctor info, drug details, and dosage instructions

## Invoice Model Updates ✅

### Multi-Source Support
- **sourceType**: ENUM('job', 'sale', 'prescription') - Tracks invoice source
- **jobId**: UUID (nullable) - Links to Job (printing press)
- **saleId**: UUID (nullable) - Links to Sale (shop)
- **prescriptionId**: UUID (nullable) - Links to Prescription (pharmacy)

### Invoice Filtering
- Filter by `sourceType`: `GET /api/invoices?sourceType=sale`
- Filter by `saleId`: `GET /api/invoices?saleId=<uuid>`
- Filter by `prescriptionId`: `GET /api/invoices?prescriptionId=<uuid>`
- Filter by `jobId`: `GET /api/invoices?jobId=<uuid>` (existing)

## Database Migration

Run the migration to add support for multiple invoice sources:
```bash
node Backend/migrations/add-invoice-source-types.js
```

## Summary

### ✅ Completed Operations

**Printing Press:**
- Quote to Job conversion
- Job to Invoice auto-generation
- Manual invoice creation
- Job status workflow

**Shop:**
- POS sales with stock deduction
- Sale cancellation with stock restoration
- Barcode scanning
- Product variants
- Sale to Invoice generation (NEW)
- Receipt printing (NEW)

**Pharmacy:**
- Prescription filling with stock deduction
- Drug interaction checking
- Expiry alerts
- Prescription to Invoice generation (NEW)
- Prescription label printing (NEW)

All business-type-specific operations are now implemented and ready for use!
