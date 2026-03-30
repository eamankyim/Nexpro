# Bulk Import: Products, Materials, Equipment

## Template and scope (user requirement)

- **Template format**: CSV only for the downloadable template. Users download a CSV, fill in details, and re-upload. No image column; **images are not part of bulk import** (product images stay as-is or are added later via product edit).
- **Template content**: First row = headers. Columns match the import schema for each entity (products, materials, equipment). No `imageUrl` or image-related columns in template or import.

## Current state

- **Products**: Backend has `POST /api/products/bulk` and export (CSV/Excel). No import-from-file or template download.
- **Materials**: Single-item create only; no bulk, no export/import.
- **Equipment**: Single-item create only; no bulk, no export/import.
- **Shared**: `bulkOperations.js` (bulkCreate), `dataExport.js` (toCSV, ExcelJS), multer for uploads.

## Backend

### 1. Import parse utility (`utils/importParse.js`)

- **parseCSV(bufferOrString)** – rows to objects (first row = headers). No image handling.
- **parseExcel(buffer)** – optional; for uploads that are Excel. Template is CSV only.
- Per-entity column config: header → model field. **Products**: exclude image/imageUrl; include name, sku, category (name), costPrice, sellingPrice, quantityOnHand, reorderLevel, unit, isActive, optional description/barcode. **Materials** / **Equipment**: same idea, no image columns.

### 2. CSV template download (per entity)

- **GET /api/products/import/template** → CSV with header row only (Product Name, SKU, Category, Cost Price, Selling Price, Stock, Reorder Level, Unit, Active, etc.). No image column.
- **GET /api/materials/items/import/template** → CSV headers for materials.
- **GET /api/equipment/items/import/template** → CSV headers for equipment.

Template = one row of headers so the user fills rows below in Excel/Sheets and saves as CSV.

### 3. Products import

- **POST /api/products/import** – file (CSV or Excel). Parse → map rows (no image) → resolve category by name → `bulkCreate(Product, records)`. Response: `{ successCount, errorCount, created, errors }`.

### 4. Materials bulk + import

- **POST /api/materials/items/bulk** – `{ materials: [...] }`, bulkCreate.
- **POST /api/materials/items/import** – file → parse → map → bulk create.
- **GET /api/materials/items/import/template** – CSV headers only.

### 5. Equipment bulk + import

- **POST /api/equipment/items/bulk** – `{ equipment: [...] }`, bulkCreate.
- **POST /api/equipment/items/import** – file → parse → map → bulk create.
- **GET /api/equipment/items/import/template** – CSV headers only.

### 6. Category resolution and validation

- Category column = category name; resolve to `categoryId` from tenant categories. No image validation or columns.

## Frontend

- **Products / Materials / Equipment pages**: “Import” button → modal with “Download CSV template” (GET template → trigger download) and file input (accept `.csv` or `.csv,.xlsx` if backend accepts Excel). Submit → show result (X created, Y failed, error list). No image upload in this flow.
- Services: `getProductImportTemplate()`, `getMaterialsImportTemplate()`, `getEquipmentImportTemplate()` each return blob for CSV download.

## Summary

- **Downloadable template**: CSV only, one row of headers per entity; user fills and re-uploads.
- **Images**: Not part of bulk import; no image column in template or in import payload.
