require('dotenv').config();
const { sequelize } = require('../config/database');
const dayjs = require('dayjs');
const {
  User,
  Tenant,
  UserTenant,
  Customer,
  Vendor,
  Product,
  Sale,
  SaleItem,
  Invoice,
  Expense,
  Quote,
  QuoteItem,
  Lead,
  InventoryItem,
  InventoryCategory,
  SaleActivity
} = require('../models');
const { Op } = require('sequelize');

// Import controllers
const customerController = require('../controllers/customerController');
const vendorController = require('../controllers/vendorController');
const productController = require('../controllers/productController');
const saleController = require('../controllers/saleController');
const invoiceController = require('../controllers/invoiceController');
const expenseController = require('../controllers/expenseController');
const quoteController = require('../controllers/quoteController');
const leadController = require('../controllers/leadController');
const inventoryController = require('../controllers/inventoryController');

// Configuration
const TARGET_EMAIL = 'sasamoah@gmail.com';
const TARGET_PASSWORD = '111111@1A';

// Data counts
const COUNTS = {
  customers: 12,
  vendors: 6,
  products: 40,
  leads: 40,
  sales: 150,
  expenses: 120,
  quotes: 50,
  inventoryItems: 25
};

// Helper functions
function randomPick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function generatePhoneNumber() {
  const prefixes = ['020', '024', '026', '027', '050', '054', '055', '056', '057', '059'];
  return `${randomPick(prefixes)}${randomInRange(1000000, 9999999)}`;
}

function getRandomDateInRange(startMonthsAgo, endMonthsAgo) {
  const start = dayjs().subtract(startMonthsAgo, 'month');
  const end = dayjs().subtract(endMonthsAgo, 'month');
  const diffDays = end.diff(start, 'day');
  const randomDays = Math.floor(Math.random() * diffDays);
  return start.add(randomDays, 'day').toDate();
}

// Mock request/response objects
function createMockRequest(tenantId, user) {
  return {
    tenantId,
    user,
    body: {},
    query: {},
    params: {},
    headers: {}
  };
}

function createMockResponse() {
  const res = {
    statusCode: 200,
    data: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.data = data;
      return data;
    }
  };
  return res;
}

const mockNext = (error) => {
  if (error) {
    console.error('Controller error:', error);
    throw error;
  }
};

// Data generators
const customerNames = [
  'Kwame Mensah', 'Ama Osei', 'Kofi Asante', 'Akosua Boateng', 'Yaw Owusu',
  'Efua Appiah', 'Kojo Darko', 'Abena Agyeman', 'Kwaku Amoah', 'Adwoa Bonsu',
  'Kwabena Danso', 'Yaa Frimpong', 'Fiifi Gyasi', 'Akua Kwarteng', 'Kweku Manu'
];

const companyNames = [
  'Accra Printing Solutions', 'Kumasi Business Center', 'Tema Office Supplies',
  'Takoradi Retail Hub', 'Tamale Commercial Services', 'Cape Coast Enterprises',
  'Sunyani Trading Company', 'Ho Business Solutions', 'Koforidua Retail Store',
  'Techiman Commercial Center', 'Wa Business Hub', 'Bolgatanga Services'
];

const vendorNames = [
  'Ghana Paper Suppliers', 'Ink & Toner Co.', 'Equipment Rentals Ltd',
  'Office Furniture Ghana', 'Printing Materials Inc', 'Business Services Group'
];

const productCategories = [
  'Electronics', 'Clothing', 'Food & Beverages', 'Home & Garden', 'Books',
  'Sports & Outdoors', 'Beauty & Personal Care', 'Toys & Games', 'Automotive',
  'Health & Wellness', 'Office Supplies', 'Fashion Accessories'
];

const productNames = [
  'Wireless Mouse', 'USB Flash Drive 32GB', 'Laptop Stand', 'Keyboard Cover',
  'Phone Case', 'Screen Protector', 'Cable Organizer', 'Power Bank 10000mAh',
  'Bluetooth Speaker', 'Headphones', 'Webcam HD', 'USB-C Hub',
  'T-Shirt Cotton', 'Jeans Classic', 'Sneakers Running', 'Backpack Travel',
  'Watch Digital', 'Sunglasses', 'Wallet Leather', 'Belt Genuine',
  'Rice 5kg', 'Cooking Oil 2L', 'Sugar 1kg', 'Flour 2kg',
  'Tomatoes Fresh', 'Onions 1kg', 'Pepper Red', 'Garlic 100g',
  'Garden Tools Set', 'Plant Pot Ceramic', 'Seeds Variety', 'Fertilizer 5kg',
  'Novel Fiction', 'Textbook Math', 'Notebook A4', 'Pen Set',
  'Football', 'Basketball', 'Tennis Racket', 'Yoga Mat'
];

const expenseCategories = [
  'Materials', 'Salaries', 'Utilities', 'Rent', 'Equipment',
  'Marketing', 'Transportation', 'Office Supplies', 'Insurance', 'Professional Fees'
];

const paymentMethods = ['cash', 'card', 'mobile_money', 'bank_transfer', 'credit'];

const leadStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
const leadPriorities = ['low', 'medium', 'high'];

// Cleanup function to remove existing test data
async function cleanupTestData(tenantId) {
  console.log('🧹 Cleaning up existing test data...\n');
  
  try {
    // Delete in order to respect foreign key constraints
    
    // 1. Get all sales for this tenant first
    const sales = await Sale.findAll({ 
      where: { tenantId },
      attributes: ['id']
    });
    const saleIds = sales.map(s => s.id);
    
    // 2. Delete SaleItems (depend on Sales)
    let saleItemsDeleted = 0;
    if (saleIds.length > 0) {
      saleItemsDeleted = await SaleItem.destroy({
        where: { saleId: { [Op.in]: saleIds } }
      });
    }
    console.log(`   Deleted ${saleItemsDeleted} sale items`);
    
    // 3. Delete SaleActivities (depend on Sales)
    let saleActivitiesDeleted = 0;
    if (saleIds.length > 0) {
      saleActivitiesDeleted = await SaleActivity.destroy({
        where: { saleId: { [Op.in]: saleIds } }
      });
    }
    console.log(`   Deleted ${saleActivitiesDeleted} sale activities`);
    
    // 4. Delete Sales (depend on Customers, Products, Invoices)
    const salesDeleted = await Sale.destroy({ where: { tenantId } });
    console.log(`   Deleted ${salesDeleted} sales`);
    
    // 5. Get all quotes for this tenant
    const quotes = await Quote.findAll({ 
      where: { tenantId },
      attributes: ['id']
    });
    const quoteIds = quotes.map(q => q.id);
    
    // 6. Delete QuoteItems (depend on Quotes, Products)
    let quoteItemsDeleted = 0;
    if (quoteIds.length > 0) {
      quoteItemsDeleted = await QuoteItem.destroy({
        where: { quoteId: { [Op.in]: quoteIds } }
      });
    }
    console.log(`   Deleted ${quoteItemsDeleted} quote items`);
    
    // 7. Delete Quotes (depend on Customers, Products)
    const quotesDeleted = await Quote.destroy({ where: { tenantId } });
    console.log(`   Deleted ${quotesDeleted} quotes`);
    
    // 8. Delete Payments (depend on Invoices)
    const { Payment } = require('../models');
    const invoices = await Invoice.findAll({ 
      where: { tenantId },
      attributes: ['id']
    });
    const invoiceIds = invoices.map(i => i.id);
    let paymentsDeleted = 0;
    if (invoiceIds.length > 0) {
      paymentsDeleted = await Payment.destroy({
        where: { invoiceId: { [Op.in]: invoiceIds } }
      });
    }
    console.log(`   Deleted ${paymentsDeleted} payments`);
    
    // 9. Delete Invoices (depend on Sales, Customers)
    const invoicesDeleted = await Invoice.destroy({ where: { tenantId } });
    console.log(`   Deleted ${invoicesDeleted} invoices`);
    
    // 10. Delete Expenses (depend on Vendors)
    const expensesDeleted = await Expense.destroy({ where: { tenantId } });
    console.log(`   Deleted ${expensesDeleted} expenses`);
    
    // 11. Delete InventoryItems (depend on Products, InventoryCategories)
    const inventoryItemsDeleted = await InventoryItem.destroy({ where: { tenantId } });
    console.log(`   Deleted ${inventoryItemsDeleted} inventory items`);
    
    // 12. Delete Leads
    const leadsDeleted = await Lead.destroy({ where: { tenantId } });
    console.log(`   Deleted ${leadsDeleted} leads`);
    
    // 13. Delete Products (depend on InventoryCategories, but we'll keep categories)
    const productsDeleted = await Product.destroy({ where: { tenantId } });
    console.log(`   Deleted ${productsDeleted} products`);
    
    // 14. Delete Customers
    const customersDeleted = await Customer.destroy({ where: { tenantId } });
    console.log(`   Deleted ${customersDeleted} customers`);
    
    // 15. Delete Vendors
    const vendorsDeleted = await Vendor.destroy({ where: { tenantId } });
    console.log(`   Deleted ${vendorsDeleted} vendors`);
    
    console.log('✅ Cleanup completed\n');
  } catch (error) {
    console.error('⚠️  Error during cleanup:', error.message);
    // Continue anyway - some records might not exist
    console.log('   Continuing with seeding...\n');
  }
}

// Main seeding function
async function seedTestData() {
  try {
    console.log('🚀 Starting test data seeding for shop account...\n');

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Find user
    const user = await User.findOne({
      where: { email: TARGET_EMAIL.toLowerCase() }
    });

    if (!user) {
      throw new Error(`User with email ${TARGET_EMAIL} not found`);
    }

    console.log(`✅ Found user: ${user.name} (${user.email})\n`);

    // Get user's tenant
    const userTenant = await UserTenant.findOne({
      where: {
        userId: user.id,
        status: 'active'
      },
      include: [{ model: Tenant, as: 'tenant' }],
      order: [['isDefault', 'DESC'], ['createdAt', 'ASC']]
    });

    if (!userTenant || !userTenant.tenant) {
      throw new Error(`No active tenant found for user ${TARGET_EMAIL}`);
    }

    const tenant = userTenant.tenant;
    const tenantId = tenant.id;

    console.log(`✅ Found tenant: ${tenant.name} (${tenant.businessType || 'shop'})\n`);

    if (tenant.businessType !== 'shop') {
      console.warn(`⚠️  Warning: Tenant business type is '${tenant.businessType}', expected 'shop'`);
    }

    // Cleanup existing test data before seeding
    await cleanupTestData(tenantId);

    // Get inventory categories for products
    const categories = await InventoryCategory.findAll({
      where: { tenantId },
      limit: 20
    });

    if (categories.length === 0) {
      console.warn('⚠️  No inventory categories found. Products will be created without categories.');
    }

    // Create mock request/response
    const req = createMockRequest(tenantId, user);
    const res = createMockResponse();

    const createdData = {
      customers: [],
      vendors: [],
      products: [],
      leads: [],
      sales: [],
      invoices: [],
      expenses: [],
      quotes: [],
      inventoryItems: []
    };

    // Phase 1: Foundation Data
    console.log('📦 Phase 1: Creating foundation data...\n');

    // Create Customers
    console.log(`Creating ${COUNTS.customers} customers...`);
    for (let i = 0; i < COUNTS.customers; i++) {
      const name = customerNames[i] || `Customer ${i + 1}`;
      const company = companyNames[i] || `Company ${i + 1}`;
      
      req.body = {
        name,
        company,
        email: `customer${i + 1}@example.com`,
        phone: generatePhoneNumber(),
        address: `${randomInRange(1, 100)} Main Street`,
        city: randomPick(['Accra', 'Kumasi', 'Tema', 'Takoradi', 'Tamale']),
        country: 'Ghana'
      };

      try {
        await customerController.createCustomer(req, res, mockNext);
        if (res.data && res.data.success && res.data.data) {
          createdData.customers.push(res.data.data);
          process.stdout.write('.');
        }
      } catch (error) {
        console.error(`\n❌ Error creating customer ${i + 1}:`, error.message);
      }
    }
    console.log(`\n✅ Created ${createdData.customers.length} customers\n`);

    // Create Vendors
    console.log(`Creating ${COUNTS.vendors} vendors...`);
    for (let i = 0; i < COUNTS.vendors; i++) {
      const name = vendorNames[i] || `Vendor ${i + 1}`;
      
      req.body = {
        name,
        email: `vendor${i + 1}@example.com`,
        phone: generatePhoneNumber(),
        address: `${randomInRange(1, 100)} Business Avenue`,
        city: randomPick(['Accra', 'Kumasi', 'Tema']),
        country: 'Ghana',
        contactPerson: name
      };

      try {
        await vendorController.createVendor(req, res, mockNext);
        if (res.data && res.data.success && res.data.data) {
          createdData.vendors.push(res.data.data);
          process.stdout.write('.');
        }
      } catch (error) {
        console.error(`\n❌ Error creating vendor ${i + 1}:`, error.message);
      }
    }
    console.log(`\n✅ Created ${createdData.vendors.length} vendors\n`);

    // Create Products
    console.log(`Creating ${COUNTS.products} products...`);
    for (let i = 0; i < COUNTS.products; i++) {
      const productName = productNames[i] || `Product ${i + 1}`;
      const category = randomPick(productCategories);
      const categoryId = categories.length > 0 ? randomPick(categories).id : null;
      
      // Generate unique SKU with timestamp to avoid conflicts
      const timestamp = Date.now();
      const randomSuffix = randomInRange(1000, 9999);
      const uniqueSku = `SKU-TEST-${timestamp}-${randomSuffix}-${i + 1}`;
      
      req.body = {
        name: productName,
        description: `${productName} - High quality product`,
        sku: uniqueSku,
        category: category,
        categoryId: categoryId,
        quantityOnHand: randomInRange(10, 500),
        reorderLevel: randomInRange(5, 50),
        costPrice: randomDecimal(5, 200),
        sellingPrice: randomDecimal(10, 400),
        unit: 'piece',
        trackInventory: true
      };

      try {
        await productController.createProduct(req, res, mockNext);
        if (res.data && res.data.success && res.data.data) {
          createdData.products.push(res.data.data);
          process.stdout.write('.');
        } else {
          console.error(`\n⚠️  Product ${i + 1} creation returned no data`);
        }
      } catch (error) {
        // Check if it's a unique constraint error (SKU already exists)
        if (error.name === 'SequelizeUniqueConstraintError' || error.original?.code === '23505') {
          console.error(`\n⚠️  Product ${i + 1} SKU already exists, skipping...`);
        } else {
          console.error(`\n❌ Error creating product ${i + 1}:`, error.message);
        }
      }
    }
    console.log(`\n✅ Created ${createdData.products.length} products\n`);

    // Phase 2: Leads
    console.log('\n📋 Phase 2: Creating leads...\n');
    console.log(`Creating ${COUNTS.leads} leads...`);
    
    for (let i = 0; i < COUNTS.leads; i++) {
      const name = customerNames[i % customerNames.length] || `Lead ${i + 1}`;
      const status = randomPick(leadStatuses);
      const priority = randomPick(leadPriorities);
      const createdAt = getRandomDateInRange(3, 0); // Last 3 months
      
      req.body = {
        name,
        email: `lead${i + 1}@example.com`,
        phone: generatePhoneNumber(),
        company: companyNames[i % companyNames.length] || `Company ${i + 1}`,
        status,
        priority,
        source: randomPick(['website', 'referral', 'walk-in', 'social_media', 'phone']),
        notes: `Lead generated for testing - ${status} status`,
        createdAt
      };

      try {
        await leadController.createLead(req, res, mockNext);
        if (res.data && res.data.success && res.data.data) {
          createdData.leads.push(res.data.data);
          process.stdout.write('.');
        }
      } catch (error) {
        console.error(`\n❌ Error creating lead ${i + 1}:`, error.message);
      }
    }
    console.log(`\n✅ Created ${createdData.leads.length} leads\n`);

    // Phase 3: Sales
    // Note: Cash sales create receipts (via GET /api/sales/:id/receipt endpoint)
    // Cash sales are receipt-ready immediately upon creation with status 'completed'
    console.log('\n💰 Phase 3: Creating sales...\n');
    console.log(`Creating ${COUNTS.sales} sales...`);
    
    for (let i = 0; i < COUNTS.sales; i++) {
      const saleDate = getRandomDateInRange(12, 0); // Last 12 months
      const customerId = Math.random() > 0.3 ? randomPick(createdData.customers).id : null; // 70% with customer
      
      // Payment method distribution: 55% cash (for receipts), 20% credit (for invoices), 25% other methods
      let paymentMethod;
      const rand = Math.random();
      if (rand < 0.55) {
        paymentMethod = 'cash'; // 55% cash sales - these create receipts
      } else if (rand < 0.75) {
        paymentMethod = 'credit'; // 20% credit sales - these auto-create invoices
      } else {
        // 25% other payment methods
        const otherMethods = ['card', 'mobile_money', 'bank_transfer'];
        paymentMethod = randomPick(otherMethods);
      }
      
      // Select 1-5 random products
      const numItems = randomInRange(1, 5);
      const selectedProducts = [];
      for (let j = 0; j < numItems; j++) {
        const product = randomPick(createdData.products);
        if (!selectedProducts.find(p => p.id === product.id)) {
          selectedProducts.push(product);
        }
      }

      const items = selectedProducts.map(product => ({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: randomInRange(1, 10),
        unitPrice: parseFloat(product.sellingPrice || product.costPrice * 1.5),
        discount: Math.random() > 0.7 ? randomDecimal(0, 50) : 0, // 30% chance of discount
        tax: 0
      }));

      // Calculate totals for proper amountPaid and change
      // Note: saleController.createSale will recalculate these, but we set them for cash sales
      // to ensure realistic receipt data (exact payment or with change)
      let subtotal = 0;
      let totalDiscount = 0;
      items.forEach(item => {
        const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
        subtotal += itemSubtotal;
        totalDiscount += item.discount || 0;
      });
      const total = subtotal - totalDiscount;

      // For cash sales: ensure amountPaid is realistic (exact or with small change)
      // Cash sales create receipts via GET /api/sales/:id/receipt endpoint
      let amountPaid = total;
      if (paymentMethod === 'cash') {
        // 70% exact payment, 30% with change (round up to nearest 5 or 10 GHS)
        if (Math.random() > 0.7) {
          const roundTo = Math.random() > 0.5 ? 5 : 10;
          amountPaid = Math.ceil(total / roundTo) * roundTo;
        }
        // Cash sales are receipt-ready immediately upon creation
      }

      req.body = {
        customerId,
        items,
        paymentMethod,
        saleDate,
        amountPaid: paymentMethod === 'cash' ? amountPaid : total, // Cash sales may have change for realistic receipts
        notes: `Sale #${i + 1} - Test data${paymentMethod === 'cash' ? ' (Receipt-ready)' : ''}`,
        status: paymentMethod === 'credit' ? 'pending' : 'completed' // Cash sales are completed immediately
      };

      try {
        await saleController.createSale(req, res, mockNext);
        if (res.data && res.data.success && res.data.data) {
          const sale = res.data.data;
          // Store paymentMethod for summary reporting
          sale._paymentMethod = paymentMethod;
          createdData.sales.push(sale);
          
          // For credit sales, manually trigger invoice creation since they're created with 'pending' status
          // The controller only auto-creates invoices for 'completed' status
          if (paymentMethod === 'credit' && !sale.invoiceId) {
            try {
              // Update sale to completed status first, then create invoice
              await sale.update({ status: 'completed' });
              const invoice = await saleController.autoCreateInvoiceFromSale(sale.id, tenantId);
              if (invoice) {
                // Reload sale to get updated invoiceId
                await sale.reload();
                createdData.invoices.push(invoice);
              }
            } catch (invoiceError) {
              console.error(`\n⚠️  Error creating invoice for credit sale ${sale.saleNumber}:`, invoiceError.message);
            }
          } else if (sale.invoiceId) {
            // Invoice was auto-created (shouldn't happen with current logic, but check anyway)
            const invoice = await Invoice.findByPk(sale.invoiceId);
            if (invoice) {
              createdData.invoices.push(invoice);
            }
          }
          
          process.stdout.write('.');
        }
      } catch (error) {
        console.error(`\n❌ Error creating sale ${i + 1}:`, error.message);
      }
    }
    console.log(`\n✅ Created ${createdData.sales.length} sales\n`);

    // Phase 4: Create invoices from some sales (non-credit)
    console.log('\n📄 Phase 4: Creating invoices from sales...\n');
    
    // Get sales without invoices
    const salesWithoutInvoices = createdData.sales.filter(sale => !sale.invoiceId);
    const salesToInvoice = salesWithoutInvoices.slice(0, Math.floor(salesWithoutInvoices.length * 0.3)); // 30% of non-credit sales
    
    console.log(`Creating invoices for ${salesToInvoice.length} sales...`);
    
    for (const sale of salesToInvoice) {
      try {
        // Use the auto-create function from saleController
        const invoice = await saleController.autoCreateInvoiceFromSale(sale.id, tenantId);
        
        if (invoice) {
          createdData.invoices.push(invoice);
          process.stdout.write('.');
        }
      } catch (error) {
        console.error(`\n❌ Error creating invoice for sale ${sale.saleNumber}:`, error.message);
      }
    }
    console.log(`\n✅ Created ${createdData.invoices.length} total invoices\n`);

    // Phase 5: Record payments on invoices
    console.log('\n💳 Phase 5: Recording payments on invoices...\n');
    
    const invoicesToPay = [...createdData.invoices];
    const paidCount = Math.floor(invoicesToPay.length * 0.6); // 60% fully paid
    const partialCount = Math.floor(invoicesToPay.length * 0.1); // 10% partial
    const overdueCount = Math.floor(invoicesToPay.length * 0.1); // 10% overdue
    
    console.log(`Processing payments for ${invoicesToPay.length} invoices...`);
    
    for (let i = 0; i < invoicesToPay.length; i++) {
      const invoice = invoicesToPay[i];
      
      try {
        if (i < paidCount) {
          // Full payment
          req.params = { id: invoice.id };
          req.body = {
            amount: parseFloat(invoice.totalAmount || invoice.subtotal),
            paymentMethod: randomPick(['cash', 'card', 'mobile_money', 'bank_transfer']),
            paymentDate: getRandomDateInRange(12, 0)
          };
          
          await invoiceController.recordPayment(req, res, mockNext);
          process.stdout.write('F'); // Full payment
        } else if (i < paidCount + partialCount) {
          // Partial payment
          req.params = { id: invoice.id };
          req.body = {
            amount: parseFloat(invoice.totalAmount || invoice.subtotal) * 0.5,
            paymentMethod: randomPick(['cash', 'card', 'mobile_money']),
            paymentDate: getRandomDateInRange(12, 0)
          };
          
          await invoiceController.recordPayment(req, res, mockNext);
          process.stdout.write('P'); // Partial payment
        } else if (i < paidCount + partialCount + overdueCount) {
          // Mark as overdue (update status)
          await invoice.update({ status: 'overdue' });
          process.stdout.write('O'); // Overdue
        } else {
          // Leave as sent (unpaid)
          process.stdout.write('U'); // Unpaid
        }
      } catch (error) {
        console.error(`\n❌ Error processing payment for invoice ${invoice.invoiceNumber}:`, error.message);
      }
    }
    console.log(`\n✅ Processed payments for ${invoicesToPay.length} invoices\n`);

    // Phase 6: Expenses
    console.log('\n💸 Phase 6: Creating expenses...\n');
    console.log(`Creating ${COUNTS.expenses} expenses...`);
    
    for (let i = 0; i < COUNTS.expenses; i++) {
      const category = randomPick(expenseCategories);
      const vendorId = Math.random() > 0.4 ? randomPick(createdData.vendors).id : null; // 60% with vendor
      const expenseDate = getRandomDateInRange(12, 0);
      
      req.body = {
        description: `${category} expense - ${i + 1}`,
        category,
        amount: randomDecimal(50, 5000),
        expenseDate,
        paymentMethod: randomPick(['cash', 'card', 'bank_transfer', 'mobile_money']),
        vendorId,
        status: 'approved',
        notes: `Test expense for ${category}`
      };

      try {
        await expenseController.createExpense(req, res, mockNext);
        if (res.data && res.data.success && res.data.data) {
          createdData.expenses.push(res.data.data);
          process.stdout.write('.');
        }
      } catch (error) {
        console.error(`\n❌ Error creating expense ${i + 1}:`, error.message);
      }
    }
    console.log(`\n✅ Created ${createdData.expenses.length} expenses\n`);

    // Phase 7: Quotes
    console.log('\n📝 Phase 7: Creating quotes...\n');
    console.log(`Creating ${COUNTS.quotes} quotes...`);
    
    for (let i = 0; i < COUNTS.quotes; i++) {
      const customer = randomPick(createdData.customers);
      const status = randomPick(['draft', 'sent', 'accepted', 'declined']);
      const createdAt = getRandomDateInRange(12, 0);
      
      // Select 2-4 products for quote
      const numItems = randomInRange(2, 4);
      const selectedProducts = [];
      for (let j = 0; j < numItems; j++) {
        const product = randomPick(createdData.products);
        if (!selectedProducts.find(p => p.id === product.id)) {
          selectedProducts.push(product);
        }
      }

      const items = selectedProducts.map(product => ({
        description: product.name,
        category: product.category || 'General',
        quantity: randomInRange(1, 20),
        unitPrice: parseFloat(product.sellingPrice || product.costPrice * 1.5),
        total: 0 // Will be calculated
      }));

      // Calculate totals
      items.forEach(item => {
        item.total = item.quantity * item.unitPrice;
      });

      req.body = {
        customerId: customer.id,
        title: `Quote for ${customer.name || customer.company}`,
        items,
        status,
        validUntil: dayjs(createdAt).add(30, 'day').toDate(),
        notes: `Test quote - ${status} status`,
        createdAt
      };

      try {
        await quoteController.createQuote(req, res, mockNext);
        if (res.data && res.data.success && res.data.data) {
          createdData.quotes.push(res.data.data);
          process.stdout.write('.');
        }
      } catch (error) {
        console.error(`\n❌ Error creating quote ${i + 1}:`, error.message);
      }
    }
    console.log(`\n✅ Created ${createdData.quotes.length} quotes\n`);

    // Phase 8: Inventory Items (if applicable)
    console.log('\n📦 Phase 8: Creating inventory items...\n');
    console.log(`Creating ${COUNTS.inventoryItems} inventory items...`);
    
    for (let i = 0; i < COUNTS.inventoryItems; i++) {
      const categoryId = categories.length > 0 ? randomPick(categories).id : null;
      const vendorId = Math.random() > 0.5 ? randomPick(createdData.vendors).id : null;
      
      req.body = {
        name: `Inventory Item ${i + 1}`,
        description: `Test inventory item ${i + 1}`,
        categoryId,
        quantityOnHand: randomInRange(10, 500),
        unit: 'piece',
        reorderLevel: randomInRange(5, 50),
        costPrice: randomDecimal(5, 200),
        preferredVendorId: vendorId
      };

      try {
        await inventoryController.createInventoryItem(req, res, mockNext);
        if (res.data && res.data.success && res.data.data) {
          createdData.inventoryItems.push(res.data.data);
          process.stdout.write('.');
        }
      } catch (error) {
        console.error(`\n❌ Error creating inventory item ${i + 1}:`, error.message);
      }
    }
    console.log(`\n✅ Created ${createdData.inventoryItems.length} inventory items\n`);

    // Summary
    const cashSalesCount = createdData.sales.filter(s => s._paymentMethod === 'cash' || s.paymentMethod === 'cash').length;
    const creditSalesCount = createdData.sales.filter(s => s._paymentMethod === 'credit' || s.paymentMethod === 'credit').length;
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST DATA SEEDING COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   Customers: ${createdData.customers.length}`);
    console.log(`   Vendors: ${createdData.vendors.length}`);
    console.log(`   Products: ${createdData.products.length}`);
    console.log(`   Leads: ${createdData.leads.length}`);
    console.log(`   Sales: ${createdData.sales.length}`);
    console.log(`     - Cash sales (receipt-ready): ${cashSalesCount}`);
    console.log(`     - Credit sales (invoice-ready): ${creditSalesCount}`);
    console.log(`   Invoices: ${createdData.invoices.length}`);
    console.log(`   Expenses: ${createdData.expenses.length}`);
    console.log(`   Quotes: ${createdData.quotes.length}`);
    console.log(`   Inventory Items: ${createdData.inventoryItems.length}`);
    console.log('\n🎉 All test data has been created successfully!');
    console.log('\n💡 Note: Cash sales can generate receipts via GET /api/sales/:id/receipt');
    console.log(`\nYou can now log in with: ${TARGET_EMAIL} / ${TARGET_PASSWORD}\n`);

  } catch (error) {
    console.error('\n❌ Error seeding test data:', error);
    throw error;
  } finally {
    await sequelize.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the seeder
if (require.main === module) {
  seedTestData()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { seedTestData };
