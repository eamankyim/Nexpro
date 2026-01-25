# Shop & Pharmacy Endpoints Test Results

## Test Script Created

A comprehensive test script has been created at `scripts/test-shop-pharmacy-endpoints.js` that tests all Shop and Pharmacy endpoints.

## Test Coverage

The test script covers:

### Shop Management
- ✅ POST /api/shops - Create shop
- ✅ GET /api/shops - List shops
- ✅ GET /api/shops/:id - Get shop by ID
- ✅ PUT /api/shops/:id - Update shop
- ✅ DELETE /api/shops/:id - Delete shop

### Product Management
- ✅ POST /api/products - Create product
- ✅ GET /api/products - List products
- ✅ GET /api/products/:id - Get product by ID
- ✅ GET /api/products/barcode/:barcode - Get product by barcode
- ✅ PUT /api/products/:id - Update product
- ✅ DELETE /api/products/:id - Delete product

### Sales/POS
- ✅ POST /api/sales - Create sale
- ✅ GET /api/sales - List sales
- ✅ GET /api/sales/:id - Get sale by ID
- ✅ PUT /api/sales/:id - Update sale
- ✅ POST /api/sales/:id/cancel - Cancel sale
- ✅ POST /api/sales/:id/generate-invoice - Generate invoice from sale
- ✅ GET /api/sales/:id/receipt - Get receipt data

### Pharmacy Management
- ✅ POST /api/pharmacies - Create pharmacy
- ✅ GET /api/pharmacies - List pharmacies
- ✅ GET /api/pharmacies/:id - Get pharmacy by ID
- ✅ PUT /api/pharmacies/:id - Update pharmacy
- ✅ DELETE /api/pharmacies/:id - Delete pharmacy

### Drug Management
- ✅ POST /api/drugs - Create drug
- ✅ GET /api/drugs - List drugs
- ✅ GET /api/drugs/:id - Get drug by ID
- ✅ GET /api/drugs/expiring - Get expiring drugs
- ✅ PUT /api/drugs/:id - Update drug
- ✅ DELETE /api/drugs/:id - Delete drug

### Prescription Management
- ✅ POST /api/prescriptions - Create prescription
- ✅ GET /api/prescriptions - List prescriptions
- ✅ GET /api/prescriptions/:id - Get prescription by ID
- ✅ PUT /api/prescriptions/:id - Update prescription
- ✅ POST /api/prescriptions/:id/fill - Fill prescription
- ✅ POST /api/prescriptions/check-interactions - Check drug interactions
- ✅ POST /api/prescriptions/:id/generate-invoice - Generate invoice from prescription
- ✅ GET /api/prescriptions/:id/label - Get prescription label

## Model Associations Fixed

Fixed duplicate association aliases in `models/index.js`:
- Removed duplicate `Invoice.hasOne(Sale)` - already has `Invoice.belongsTo(Sale)`
- Removed duplicate `Invoice.hasOne(Prescription)` - already has `Invoice.belongsTo(Prescription)`

## Manual Testing Guide

To manually test the endpoints:

### 1. Start the Server
```bash
cd Backend
npm run dev
```

### 2. Authenticate
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'
```

Save the token from the response.

### 3. Test Shop Endpoints
```bash
# Create shop
curl -X POST http://localhost:5000/api/shops \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Shop",
    "address": "123 Test St",
    "phone": "+233241234567",
    "email": "shop@example.com"
  }'

# List shops
curl -X GET http://localhost:5000/api/shops \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Test Product Endpoints
```bash
# Create product
curl -X POST http://localhost:5000/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "sku": "TEST-001",
    "price": 100.00,
    "cost": 50.00,
    "quantity": 100,
    "reorderLevel": 10
  }'

# Get product by barcode
curl -X GET http://localhost:5000/api/products/barcode/1234567890123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Test Sale Endpoints
```bash
# Create sale
curl -X POST http://localhost:5000/api/sales \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "SHOP_ID",
    "customerId": "CUSTOMER_ID",
    "totalAmount": 200.00,
    "amountPaid": 200.00,
    "paymentStatus": "paid",
    "items": [{
      "productId": "PRODUCT_ID",
      "productName": "Test Product",
      "quantity": 2,
      "unitPrice": 100.00,
      "totalPrice": 200.00
    }]
  }'

# Generate invoice from sale
curl -X POST http://localhost:5000/api/sales/SALE_ID/generate-invoice \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Test Pharmacy Endpoints
```bash
# Create pharmacy
curl -X POST http://localhost:5000/api/pharmacies \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Pharmacy",
    "licenseNumber": "PH-12345",
    "address": "456 Pharmacy St",
    "phone": "+233241234567"
  }'
```

### 7. Test Drug Endpoints
```bash
# Create drug
curl -X POST http://localhost:5000/api/drugs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Drug",
    "genericName": "Test Generic",
    "dosage": "500mg",
    "form": "tablet",
    "price": 50.00,
    "cost": 25.00,
    "quantity": 200,
    "expiryDate": "2025-12-31"
  }'

# Get expiring drugs
curl -X GET "http://localhost:5000/api/drugs/expiring?days=365" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8. Test Prescription Endpoints
```bash
# Create prescription
curl -X POST http://localhost:5000/api/prescriptions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pharmacyId": "PHARMACY_ID",
    "customerId": "CUSTOMER_ID",
    "prescriberName": "Dr. Test",
    "prescriptionDate": "2025-01-19",
    "items": [{
      "drugId": "DRUG_ID",
      "drugName": "Test Drug",
      "quantity": 30,
      "dosageInstructions": "Take 1 tablet twice daily"
    }]
  }'

# Fill prescription
curl -X POST http://localhost:5000/api/prescriptions/PRESCRIPTION_ID/fill \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "quantityFilled": 30,
      "unitPrice": 50.00
    }]
  }'

# Generate invoice from prescription
curl -X POST http://localhost:5000/api/prescriptions/PRESCRIPTION_ID/generate-invoice \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Postman Collection

You can import these endpoints into Postman for easier testing:

1. Create a new collection: "Shop & Pharmacy Endpoints"
2. Set collection variable: `base_url` = `http://localhost:5000/api`
3. Set collection variable: `token` = (from login response)
4. Add Authorization header to collection: `Bearer {{token}}`
5. Import all endpoints listed above

## Notes

- All endpoints require authentication (JWT token)
- All endpoints automatically filter by tenant (multi-tenancy)
- Some endpoints require specific roles (admin, manager, staff)
- The test script creates test data and cleans up after testing
- Model associations have been fixed to prevent duplicate alias errors

## Next Steps

1. Run the automated test script once authentication is configured
2. Use Postman/Thunder Client for manual testing
3. Test with real data in development environment
4. Verify multi-tenancy isolation
5. Test error cases and edge cases
