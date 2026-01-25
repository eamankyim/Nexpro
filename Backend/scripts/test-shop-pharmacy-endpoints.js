/**
 * Test Script for Shop and Pharmacy Endpoints
 * 
 * This script tests all Shop and Pharmacy API endpoints to ensure they work correctly.
 * 
 * Usage: node scripts/test-shop-pharmacy-endpoints.js
 */

require('dotenv').config();
const axios = require('axios');
const { sequelize } = require('../config/database');
const { User, Tenant, UserTenant, Shop, Product, Sale, SaleItem, Pharmacy, Drug, Prescription, PrescriptionItem, Customer, InventoryCategory } = require('../models');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api`;

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  errors: []
};

// Helper functions
function log(message, color = 'white') {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bright: '\x1b[1m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[color] || ''}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(80), 'cyan');
  log(title, 'bright');
  log('='.repeat(80), 'cyan');
}

function logTest(testName) {
  log(`\n🧪 Testing: ${testName}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
  results.passed++;
}

function logError(message, error) {
  log(`❌ ${message}`, 'red');
  if (error) {
    log(`   Error: ${error.message || error}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
  }
  results.failed++;
  results.errors.push({ test: message, error: error?.message || error });
}

// Test data storage
let testData = {
  token: null,
  tenantId: null,
  userId: null,
  shopId: null,
  productId: null,
  saleId: null,
  pharmacyId: null,
  drugId: null,
  prescriptionId: null,
  customerId: null,
  categoryId: null
};

// API request helper
async function apiRequest(method, endpoint, data = null, token = null) {
  const config = {
    method,
    url: `${API_BASE}${endpoint}`,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { success: false, error, status: error.response?.status };
  }
}

// Setup: Create test user and authenticate
async function setup() {
  logSection('SETUP: Creating Test Environment');
  
  try {
    await sequelize.authenticate();
    logSuccess('Database connection established');

    // Find or create test tenant
    let tenant = await Tenant.findOne({ where: { slug: 'test-shop-pharmacy' } });
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'Test Shop Pharmacy Tenant',
        slug: 'test-shop-pharmacy',
        plan: 'trial',
        businessType: 'shop', // Start with shop, we'll test pharmacy too
        status: 'active'
      });
      logSuccess('Created test tenant');
    } else {
      logSuccess('Using existing test tenant');
    }
    testData.tenantId = tenant.id;

    // Find or create test user
    const testEmail = 'test-shop-pharmacy@example.com';
    let user = await User.findOne({ where: { email: testEmail } });
    if (!user) {
      user = await User.create({
        name: 'Test User',
        email: testEmail,
        password: 'Test123!@#',
        role: 'admin',
        isActive: true
      });
      logSuccess('Created test user');
    } else {
      logSuccess('Using existing test user');
    }
    testData.userId = user.id;

    // Associate user with tenant
    const [userTenant, created] = await UserTenant.findOrCreate({
      where: {
        userId: user.id,
        tenantId: tenant.id
      },
      defaults: {
        role: 'admin',
        isDefault: true
      }
    });
    if (created) {
      logSuccess('Associated user with tenant');
    }

    // Create test customer
    let customer = await Customer.findOne({
      where: { tenantId: tenant.id, email: 'test-customer@example.com' }
    });
    if (!customer) {
      customer = await Customer.create({
        tenantId: tenant.id,
        name: 'Test Customer',
        email: 'test-customer@example.com',
        phone: '+233241234567'
      });
      logSuccess('Created test customer');
    }
    testData.customerId = customer.id;

    // Create test category
    let category = await InventoryCategory.findOne({
      where: { tenantId: tenant.id, name: 'Test Category' }
    });
    if (!category) {
      category = await InventoryCategory.create({
        tenantId: tenant.id,
        name: 'Test Category',
        description: 'Test category for endpoints'
      });
      logSuccess('Created test category');
    }
    testData.categoryId = category.id;

    // Authenticate to get token
    const authResult = await apiRequest('POST', '/auth/login', {
      email: testEmail,
      password: 'Test123!@#'
    });

    if (authResult.success && authResult.data.success) {
      testData.token = authResult.data.token || authResult.data.data?.token;
      logSuccess('Authentication successful');
    } else {
      log(`Auth result: ${JSON.stringify(authResult, null, 2)}`, 'yellow');
      // Try to update password if user exists (using model's password hashing)
      if (user) {
        await user.update({ password: 'Test123!@#' }); // This will trigger the beforeUpdate hook to hash the password
        log('Updated user password, retrying authentication...', 'yellow');
        const retryAuth = await apiRequest('POST', '/auth/login', {
          email: testEmail,
          password: 'Test123!@#'
        });
        if (retryAuth.success && retryAuth.data.success) {
          testData.token = retryAuth.data.data?.token || retryAuth.data.token;
          logSuccess('Authentication successful after password update');
        } else {
          log(`Retry auth error: ${JSON.stringify(retryAuth.error?.response?.data || retryAuth.error)}`, 'red');
          throw new Error(`Failed to authenticate: ${retryAuth.error?.response?.data?.message || retryAuth.error?.message || 'Unknown error'}`);
        }
      } else {
        throw new Error(`Failed to authenticate: ${authResult.error?.response?.data?.message || authResult.error?.message || 'Unknown error'}`);
      }
    }

    return true;
  } catch (error) {
    logError('Setup failed', error);
    return false;
  }
}

// SHOP ENDPOINTS TESTS
async function testShopEndpoints() {
  logSection('SHOP ENDPOINTS TESTS');

  // Test 1: Create Shop
  logTest('POST /api/shops - Create Shop');
  const createShopResult = await apiRequest('POST', '/shops', {
    name: 'Test Shop',
    address: '123 Test Street',
    phone: '+233241234567',
    email: 'shop@example.com'
  }, testData.token);

  if (createShopResult.success && createShopResult.data.success) {
    testData.shopId = createShopResult.data.data.id;
    logSuccess('Shop created successfully');
  } else {
    logError('Failed to create shop', createShopResult.error);
    return false;
  }

  // Test 2: Get All Shops
  logTest('GET /api/shops - Get All Shops');
  const getShopsResult = await apiRequest('GET', '/shops', null, testData.token);
  if (getShopsResult.success && getShopsResult.data.success) {
    logSuccess(`Retrieved ${getShopsResult.data.count} shops`);
  } else {
    logError('Failed to get shops', getShopsResult.error);
  }

  // Test 3: Get Shop by ID
  logTest('GET /api/shops/:id - Get Shop by ID');
  const getShopResult = await apiRequest('GET', `/shops/${testData.shopId}`, null, testData.token);
  if (getShopResult.success && getShopResult.data.success) {
    logSuccess('Shop retrieved successfully');
  } else {
    logError('Failed to get shop', getShopResult.error);
  }

  // Test 4: Update Shop
  logTest('PUT /api/shops/:id - Update Shop');
  const updateShopResult = await apiRequest('PUT', `/shops/${testData.shopId}`, {
    name: 'Updated Test Shop',
    phone: '+233241234568'
  }, testData.token);
  if (updateShopResult.success && updateShopResult.data.success) {
    logSuccess('Shop updated successfully');
  } else {
    logError('Failed to update shop', updateShopResult.error);
  }

  return true;
}

// PRODUCT ENDPOINTS TESTS
async function testProductEndpoints() {
  logSection('PRODUCT ENDPOINTS TESTS');

  // Test 1: Create Product
  logTest('POST /api/products - Create Product');
  const createProductResult = await apiRequest('POST', '/products', {
    name: 'Test Product',
    description: 'A test product',
    sku: 'TEST-001',
    barcode: '1234567890123',
    price: 100.00,
    cost: 50.00,
    quantity: 100,
    reorderLevel: 10,
    shopId: testData.shopId,
    categoryId: testData.categoryId
  }, testData.token);

  if (createProductResult.success && createProductResult.data.success) {
    testData.productId = createProductResult.data.data.id;
    logSuccess('Product created successfully');
  } else {
    logError('Failed to create product', createProductResult.error);
    return false;
  }

  // Test 2: Get All Products
  logTest('GET /api/products - Get All Products');
  const getProductsResult = await apiRequest('GET', '/products', null, testData.token);
  if (getProductsResult.success && getProductsResult.data.success) {
    logSuccess(`Retrieved ${getProductsResult.data.count} products`);
  } else {
    logError('Failed to get products', getProductsResult.error);
  }

  // Test 3: Get Product by Barcode
  logTest('GET /api/products/barcode/:barcode - Get Product by Barcode');
  const getByBarcodeResult = await apiRequest('GET', '/products/barcode/1234567890123', null, testData.token);
  if (getByBarcodeResult.success && getByBarcodeResult.data.success) {
    logSuccess('Product retrieved by barcode successfully');
  } else {
    logError('Failed to get product by barcode', getByBarcodeResult.error);
  }

  // Test 4: Get Product by ID
  logTest('GET /api/products/:id - Get Product by ID');
  const getProductResult = await apiRequest('GET', `/products/${testData.productId}`, null, testData.token);
  if (getProductResult.success && getProductResult.data.success) {
    logSuccess('Product retrieved successfully');
  } else {
    logError('Failed to get product', getProductResult.error);
  }

  // Test 5: Update Product
  logTest('PUT /api/products/:id - Update Product');
  const updateProductResult = await apiRequest('PUT', `/products/${testData.productId}`, {
    price: 120.00,
    quantity: 80
  }, testData.token);
  if (updateProductResult.success && updateProductResult.data.success) {
    logSuccess('Product updated successfully');
  } else {
    logError('Failed to update product', updateProductResult.error);
  }

  return true;
}

// SALE ENDPOINTS TESTS
async function testSaleEndpoints() {
  logSection('SALE ENDPOINTS TESTS');

  // Test 1: Create Sale
  logTest('POST /api/sales - Create Sale');
  const createSaleResult = await apiRequest('POST', '/sales', {
    shopId: testData.shopId,
    customerId: testData.customerId,
    saleDate: new Date().toISOString(),
    totalAmount: 200.00,
    amountPaid: 200.00,
    balance: 0,
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    items: [
      {
        productId: testData.productId,
        productName: 'Test Product',
        quantity: 2,
        unitPrice: 100.00,
        totalPrice: 200.00
      }
    ]
  }, testData.token);

  if (createSaleResult.success && createSaleResult.data.success) {
    testData.saleId = createSaleResult.data.data.id;
    logSuccess('Sale created successfully');
  } else {
    logError('Failed to create sale', createSaleResult.error);
    return false;
  }

  // Test 2: Get All Sales
  logTest('GET /api/sales - Get All Sales');
  const getSalesResult = await apiRequest('GET', '/sales', null, testData.token);
  if (getSalesResult.success && getSalesResult.data.success) {
    logSuccess(`Retrieved ${getSalesResult.data.count} sales`);
  } else {
    logError('Failed to get sales', getSalesResult.error);
  }

  // Test 3: Get Sale by ID
  logTest('GET /api/sales/:id - Get Sale by ID');
  const getSaleResult = await apiRequest('GET', `/sales/${testData.saleId}`, null, testData.token);
  if (getSaleResult.success && getSaleResult.data.success) {
    logSuccess('Sale retrieved successfully');
  } else {
    logError('Failed to get sale', getSaleResult.error);
  }

  // Test 4: Generate Invoice from Sale
  logTest('POST /api/sales/:id/generate-invoice - Generate Invoice');
  const generateInvoiceResult = await apiRequest('POST', `/sales/${testData.saleId}/generate-invoice`, null, testData.token);
  if (generateInvoiceResult.success && generateInvoiceResult.data.success) {
    logSuccess('Invoice generated from sale successfully');
  } else {
    logError('Failed to generate invoice', generateInvoiceResult.error);
  }

  // Test 5: Get Receipt
  logTest('GET /api/sales/:id/receipt - Get Receipt');
  const getReceiptResult = await apiRequest('GET', `/sales/${testData.saleId}/receipt`, null, testData.token);
  if (getReceiptResult.success && getReceiptResult.data.success) {
    logSuccess('Receipt data retrieved successfully');
  } else {
    logError('Failed to get receipt', getReceiptResult.error);
  }

  return true;
}

// PHARMACY ENDPOINTS TESTS
async function testPharmacyEndpoints() {
  logSection('PHARMACY ENDPOINTS TESTS');

  // Update tenant business type to pharmacy
  const tenant = await Tenant.findByPk(testData.tenantId);
  await tenant.update({ businessType: 'pharmacy' });

  // Test 1: Create Pharmacy
  logTest('POST /api/pharmacies - Create Pharmacy');
  const createPharmacyResult = await apiRequest('POST', '/pharmacies', {
    name: 'Test Pharmacy',
    licenseNumber: 'PH-12345',
    address: '456 Pharmacy Street',
    phone: '+233241234567',
    email: 'pharmacy@example.com'
  }, testData.token);

  if (createPharmacyResult.success && createPharmacyResult.data.success) {
    testData.pharmacyId = createPharmacyResult.data.data.id;
    logSuccess('Pharmacy created successfully');
  } else {
    logError('Failed to create pharmacy', createPharmacyResult.error);
    return false;
  }

  // Test 2: Get All Pharmacies
  logTest('GET /api/pharmacies - Get All Pharmacies');
  const getPharmaciesResult = await apiRequest('GET', '/pharmacies', null, testData.token);
  if (getPharmaciesResult.success && getPharmaciesResult.data.success) {
    logSuccess(`Retrieved ${getPharmaciesResult.data.count} pharmacies`);
  } else {
    logError('Failed to get pharmacies', getPharmaciesResult.error);
  }

  // Test 3: Get Pharmacy by ID
  logTest('GET /api/pharmacies/:id - Get Pharmacy by ID');
  const getPharmacyResult = await apiRequest('GET', `/pharmacies/${testData.pharmacyId}`, null, testData.token);
  if (getPharmacyResult.success && getPharmacyResult.data.success) {
    logSuccess('Pharmacy retrieved successfully');
  } else {
    logError('Failed to get pharmacy', getPharmacyResult.error);
  }

  // Test 4: Update Pharmacy
  logTest('PUT /api/pharmacies/:id - Update Pharmacy');
  const updatePharmacyResult = await apiRequest('PUT', `/pharmacies/${testData.pharmacyId}`, {
    name: 'Updated Test Pharmacy',
    phone: '+233241234568'
  }, testData.token);
  if (updatePharmacyResult.success && updatePharmacyResult.data.success) {
    logSuccess('Pharmacy updated successfully');
  } else {
    logError('Failed to update pharmacy', updatePharmacyResult.error);
  }

  return true;
}

// DRUG ENDPOINTS TESTS
async function testDrugEndpoints() {
  logSection('DRUG ENDPOINTS TESTS');

  // Test 1: Create Drug
  logTest('POST /api/drugs - Create Drug');
  const createDrugResult = await apiRequest('POST', '/drugs', {
    name: 'Test Drug',
    genericName: 'Test Generic',
    dosage: '500mg',
    form: 'tablet',
    strength: '500mg',
    manufacturer: 'Test Pharma',
    sku: 'DRUG-001',
    barcode: '9876543210987',
    price: 50.00,
    cost: 25.00,
    quantity: 200,
    reorderLevel: 20,
    expiryDate: '2025-12-31',
    pharmacyId: testData.pharmacyId,
    categoryId: testData.categoryId
  }, testData.token);

  if (createDrugResult.success && createDrugResult.data.success) {
    testData.drugId = createDrugResult.data.data.id;
    logSuccess('Drug created successfully');
  } else {
    logError('Failed to create drug', createDrugResult.error);
    return false;
  }

  // Test 2: Get All Drugs
  logTest('GET /api/drugs - Get All Drugs');
  const getDrugsResult = await apiRequest('GET', '/drugs', null, testData.token);
  if (getDrugsResult.success && getDrugsResult.data.success) {
    logSuccess(`Retrieved ${getDrugsResult.data.count} drugs`);
  } else {
    logError('Failed to get drugs', getDrugsResult.error);
  }

  // Test 3: Get Expiring Drugs
  logTest('GET /api/drugs/expiring - Get Expiring Drugs');
  const getExpiringResult = await apiRequest('GET', '/drugs/expiring?days=365', null, testData.token);
  if (getExpiringResult.success && getExpiringResult.data.success) {
    logSuccess(`Found ${getExpiringResult.data.count} expiring drugs`);
  } else {
    logError('Failed to get expiring drugs', getExpiringResult.error);
  }

  // Test 4: Get Drug by ID
  logTest('GET /api/drugs/:id - Get Drug by ID');
  const getDrugResult = await apiRequest('GET', `/drugs/${testData.drugId}`, null, testData.token);
  if (getDrugResult.success && getDrugResult.data.success) {
    logSuccess('Drug retrieved successfully');
  } else {
    logError('Failed to get drug', getDrugResult.error);
  }

  // Test 5: Update Drug
  logTest('PUT /api/drugs/:id - Update Drug');
  const updateDrugResult = await apiRequest('PUT', `/drugs/${testData.drugId}`, {
    price: 55.00,
    quantity: 180
  }, testData.token);
  if (updateDrugResult.success && updateDrugResult.data.success) {
    logSuccess('Drug updated successfully');
  } else {
    logError('Failed to update drug', updateDrugResult.error);
  }

  return true;
}

// PRESCRIPTION ENDPOINTS TESTS
async function testPrescriptionEndpoints() {
  logSection('PRESCRIPTION ENDPOINTS TESTS');

  // Test 1: Create Prescription
  logTest('POST /api/prescriptions - Create Prescription');
  const createPrescriptionResult = await apiRequest('POST', '/prescriptions', {
    pharmacyId: testData.pharmacyId,
    customerId: testData.customerId,
    prescriberName: 'Dr. Test',
    prescriberLicense: 'MD-12345',
    prescriptionDate: new Date().toISOString().split('T')[0],
    items: [
      {
        drugId: testData.drugId,
        drugName: 'Test Drug',
        quantity: 30,
        dosageInstructions: 'Take 1 tablet twice daily',
        refills: 2
      }
    ]
  }, testData.token);

  if (createPrescriptionResult.success && createPrescriptionResult.data.success) {
    testData.prescriptionId = createPrescriptionResult.data.data.id;
    logSuccess('Prescription created successfully');
  } else {
    logError('Failed to create prescription', createPrescriptionResult.error);
    return false;
  }

  // Test 2: Get All Prescriptions
  logTest('GET /api/prescriptions - Get All Prescriptions');
  const getPrescriptionsResult = await apiRequest('GET', '/prescriptions', null, testData.token);
  if (getPrescriptionsResult.success && getPrescriptionsResult.data.success) {
    logSuccess(`Retrieved ${getPrescriptionsResult.data.count} prescriptions`);
  } else {
    logError('Failed to get prescriptions', getPrescriptionsResult.error);
  }

  // Test 3: Get Prescription by ID
  logTest('GET /api/prescriptions/:id - Get Prescription by ID');
  const getPrescriptionResult = await apiRequest('GET', `/prescriptions/${testData.prescriptionId}`, null, testData.token);
  if (getPrescriptionResult.success && getPrescriptionResult.data.success) {
    logSuccess('Prescription retrieved successfully');
  } else {
    logError('Failed to get prescription', getPrescriptionResult.error);
  }

  // Test 4: Check Drug Interactions
  logTest('POST /api/prescriptions/check-interactions - Check Drug Interactions');
  const checkInteractionsResult = await apiRequest('POST', '/prescriptions/check-interactions', {
    drugIds: [testData.drugId]
  }, testData.token);
  if (checkInteractionsResult.success) {
    logSuccess('Drug interactions checked successfully');
  } else {
    logError('Failed to check drug interactions', checkInteractionsResult.error);
  }

  // Test 5: Fill Prescription
  logTest('POST /api/prescriptions/:id/fill - Fill Prescription');
  const fillPrescriptionResult = await apiRequest('POST', `/prescriptions/${testData.prescriptionId}/fill`, {
    items: [
      {
        itemId: null, // Will be set from prescription items
        quantityFilled: 30,
        unitPrice: 50.00
      }
    ]
  }, testData.token);
  if (fillPrescriptionResult.success && fillPrescriptionResult.data.success) {
    logSuccess('Prescription filled successfully');
  } else {
    logError('Failed to fill prescription', fillPrescriptionResult.error);
  }

  // Test 6: Generate Invoice from Prescription
  logTest('POST /api/prescriptions/:id/generate-invoice - Generate Invoice');
  const generateInvoiceResult = await apiRequest('POST', `/prescriptions/${testData.prescriptionId}/generate-invoice`, null, testData.token);
  if (generateInvoiceResult.success && generateInvoiceResult.data.success) {
    logSuccess('Invoice generated from prescription successfully');
  } else {
    logError('Failed to generate invoice', generateInvoiceResult.error);
  }

  // Test 7: Get Prescription Label
  logTest('GET /api/prescriptions/:id/label - Get Prescription Label');
  const getLabelResult = await apiRequest('GET', `/prescriptions/${testData.prescriptionId}/label`, null, testData.token);
  if (getLabelResult.success && getLabelResult.data.success) {
    logSuccess('Prescription label retrieved successfully');
  } else {
    logError('Failed to get prescription label', getLabelResult.error);
  }

  return true;
}

// Cleanup function
async function cleanup() {
  logSection('CLEANUP');
  
  try {
    // Delete test data in reverse order of creation
    if (testData.prescriptionId) {
      await Prescription.destroy({ where: { id: testData.prescriptionId }, force: true });
      logSuccess('Cleaned up prescription');
    }
    if (testData.drugId) {
      await Drug.destroy({ where: { id: testData.drugId }, force: true });
      logSuccess('Cleaned up drug');
    }
    if (testData.pharmacyId) {
      await Pharmacy.destroy({ where: { id: testData.pharmacyId }, force: true });
      logSuccess('Cleaned up pharmacy');
    }
    if (testData.saleId) {
      await Sale.destroy({ where: { id: testData.saleId }, force: true });
      logSuccess('Cleaned up sale');
    }
    if (testData.productId) {
      await Product.destroy({ where: { id: testData.productId }, force: true });
      logSuccess('Cleaned up product');
    }
    if (testData.shopId) {
      await Shop.destroy({ where: { id: testData.shopId }, force: true });
      logSuccess('Cleaned up shop');
    }
  } catch (error) {
    logError('Cleanup failed', error);
  }
}

// Main test runner
async function runTests() {
  logSection('SHOP & PHARMACY ENDPOINTS TEST SUITE');
  log(`Starting tests at ${new Date().toISOString()}`, 'bright');
  log(`Base URL: ${BASE_URL}`, 'bright');

  try {
    // Setup
    const setupSuccess = await setup();
    if (!setupSuccess) {
      logError('Setup failed, aborting tests');
      return;
    }

    // Run tests
    await testShopEndpoints();
    await testProductEndpoints();
    await testSaleEndpoints();
    await testPharmacyEndpoints();
    await testDrugEndpoints();
    await testPrescriptionEndpoints();

    // Cleanup
    await cleanup();

    // Print summary
    logSection('TEST SUMMARY');
    log(`Total Tests: ${results.passed + results.failed}`, 'bright');
    log(`Passed: ${results.passed}`, 'green');
    log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');

    if (results.errors.length > 0) {
      log('\nErrors:', 'red');
      results.errors.forEach((err, index) => {
        log(`${index + 1}. ${err.test}: ${err.error}`, 'red');
      });
    }

    if (results.failed === 0) {
      log('\n🎉 All tests passed!', 'green');
      process.exit(0);
    } else {
      log('\n⚠️  Some tests failed. Please review the errors above.', 'yellow');
      process.exit(1);
    }
  } catch (error) {
    logError('Test suite failed', error);
    await cleanup();
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    logError('Fatal error', error);
    process.exit(1);
  });
}

module.exports = { runTests };
