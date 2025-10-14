const { sequelize } = require('../config/database');
const { User, Customer, Vendor, Job, Payment, Expense, PricingTemplate } = require('../models');
require('dotenv').config();

const seedData = async () => {
  try {
    await sequelize.sync({ force: true });
    console.log('📊 Database cleared and synced');

    // Create Users
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@printingpress.com',
      password: 'admin123',
      role: 'admin'
    });

    const manager = await User.create({
      name: 'Manager User',
      email: 'manager@printingpress.com',
      password: 'manager123',
      role: 'manager'
    });

    const staff = await User.create({
      name: 'Staff User',
      email: 'staff@printingpress.com',
      password: 'staff123',
      role: 'staff'
    });

    console.log('✅ Users created');

    // Create Customers
    const customer1 = await Customer.create({
      name: 'John Doe',
      company: 'ABC Corporation',
      email: 'john@abc.com',
      phone: '555-0101',
      address: '123 Business Ave',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      creditLimit: 5000
    });

    const customer2 = await Customer.create({
      name: 'Jane Smith',
      company: 'XYZ Solutions',
      email: 'jane@xyz.com',
      phone: '555-0102',
      address: '456 Commerce St',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      creditLimit: 10000
    });

    console.log('✅ Customers created');

    // Create Vendors
    const vendor1 = await Vendor.create({
      name: 'Paper Supply Co',
      company: 'Paper Supply Co',
      email: 'info@papersupply.com',
      phone: '555-0201',
      address: '789 Supply Lane',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      category: 'Paper Supplier'
    });

    const vendor2 = await Vendor.create({
      name: 'Ink Masters',
      company: 'Ink Masters LLC',
      email: 'sales@inkmasters.com',
      phone: '555-0202',
      address: '321 Ink Street',
      city: 'Houston',
      state: 'TX',
      zipCode: '77001',
      category: 'Ink Supplier'
    });

    console.log('✅ Vendors created');

    // Create Pricing Templates
    const template1 = await PricingTemplate.create({
      name: 'Standard Business Cards',
      category: 'Business Cards',
      jobType: 'business_cards',
      paperType: 'Standard',
      paperSize: '3.5x2',
      colorType: 'color',
      basePrice: 50.00,
      pricePerUnit: 0.10,
      setupFee: 25.00,
      minimumQuantity: 100,
      discountTiers: [
        { minQuantity: 500, maxQuantity: 999, discountPercent: 5 },
        { minQuantity: 1000, maxQuantity: null, discountPercent: 10 }
      ]
    });

    const template2 = await PricingTemplate.create({
      name: 'Flyer Printing',
      category: 'Flyers',
      jobType: 'flyers',
      paperType: 'Glossy',
      paperSize: '8.5x11',
      colorType: 'color',
      basePrice: 100.00,
      pricePerUnit: 0.25,
      setupFee: 50.00,
      minimumQuantity: 100,
      discountTiers: [
        { minQuantity: 500, maxQuantity: 999, discountPercent: 10 },
        { minQuantity: 1000, maxQuantity: null, discountPercent: 15 }
      ]
    });

    console.log('✅ Pricing templates created');

    // Create Jobs
    const job1 = await Job.create({
      jobNumber: 'JOB-202401-0001',
      customerId: customer1.id,
      title: 'Business Cards - ABC Corp',
      description: '1000 premium business cards with glossy finish',
      status: 'in_progress',
      priority: 'high',
      jobType: 'business_cards',
      quantity: 1000,
      paperType: 'Glossy',
      paperSize: '3.5x2',
      colorType: 'color',
      quotedPrice: 150.00,
      finalPrice: 150.00,
      assignedTo: staff.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    });

    const job2 = await Job.create({
      jobNumber: 'JOB-202401-0002',
      customerId: customer2.id,
      title: 'Marketing Flyers',
      description: '500 promotional flyers',
      status: 'pending',
      priority: 'medium',
      jobType: 'flyers',
      quantity: 500,
      paperType: 'Glossy',
      paperSize: '8.5x11',
      colorType: 'color',
      quotedPrice: 250.00,
      finalPrice: 250.00,
      assignedTo: staff.id,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
    });

    console.log('✅ Jobs created');

    // Create Expenses
    const expense1 = await Expense.create({
      expenseNumber: 'EXP-202401-0001',
      vendorId: vendor1.id,
      jobId: job1.id,
      category: 'Materials',
      description: 'Paper for business cards',
      amount: 75.00,
      status: 'paid',
      paymentMethod: 'bank_transfer'
    });

    const expense2 = await Expense.create({
      expenseNumber: 'EXP-202401-0002',
      vendorId: vendor2.id,
      jobId: job2.id,
      category: 'Materials',
      description: 'Color ink cartridges',
      amount: 120.00,
      status: 'pending',
      paymentMethod: 'credit_card'
    });

    console.log('✅ Expenses created');

    // Create Payments
    const payment1 = await Payment.create({
      paymentNumber: 'PAY-IN-202401-0001',
      type: 'income',
      customerId: customer1.id,
      jobId: job1.id,
      amount: 75.00,
      paymentMethod: 'credit_card',
      status: 'completed'
    });

    const payment2 = await Payment.create({
      paymentNumber: 'PAY-OUT-202401-0001',
      type: 'expense',
      vendorId: vendor1.id,
      amount: 75.00,
      paymentMethod: 'bank_transfer',
      status: 'completed'
    });

    console.log('✅ Payments created');

    console.log('\n🎉 Seed data created successfully!');
    console.log('\n📧 Test Users:');
    console.log('   Admin: admin@printingpress.com / admin123');
    console.log('   Manager: manager@printingpress.com / manager123');
    console.log('   Staff: staff@printingpress.com / staff123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();


