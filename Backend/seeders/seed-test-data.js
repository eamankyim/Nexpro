const { sequelize } = require('../config/database');
const { 
  Customer, 
  Vendor, 
  Job, 
  JobItem, 
  Invoice, 
  Expense, 
  Quote,
  QuoteItem,
  PricingTemplate,
  User,
  Tenant,
  Lead
} = require('../models');
const dayjs = require('dayjs');

// Helper to generate random date in the past year
const randomDateInPastYear = () => {
  const daysAgo = Math.floor(Math.random() * 365);
  return dayjs().subtract(daysAgo, 'day').toDate();
};

// Helper to generate random number in range
const randomInRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper to pick random item from array
const randomPick = (array) => array[Math.floor(Math.random() * array.length)];

async function seedTestData() {
  try {
    console.log('[Seed] Starting database seeding...');
    
    // Get the first tenant (assuming it exists)
    const tenant = await Tenant.findOne();
    if (!tenant) {
      console.log('[Seed] No tenant found. Please create a tenant first.');
      return;
    }
    
    const tenantId = tenant.id;
    console.log(`[Seed] Using tenant: ${tenant.name} (${tenantId})`);

    // Get the first user for the tenant
    const user = await User.findOne();
    if (!user) {
      console.log('[Seed] No user found. Please create a user first.');
      return;
    }
    
    const userId = user.id;
    console.log(`[Seed] Using user: ${user.name} (${userId})`);

    // Clear existing data (optional - comment out if you want to keep existing data)
    // await Customer.destroy({ where: { tenantId }, force: true });
    // await Vendor.destroy({ where: { tenantId }, force: true });
    // await Job.destroy({ where: { tenantId }, force: true });
    // await Invoice.destroy({ where: { tenantId }, force: true });
    // await Expense.destroy({ where: { tenantId }, force: true });

    // === SEED CUSTOMERS ===
    console.log('[Seed] Creating customers...');
    const customerNames = [
      { name: 'Eric Amankyim', company: 'Unext Business Solutions', email: 'eric@unext.com', phone: '0209735525' },
      { name: 'Kofi Mensah', company: 'Mensah Enterprises', email: 'kofi@mensah.com', phone: '0244123456' },
      { name: 'Ama Serwaa', company: 'Serwaa Graphics', email: 'ama@serwaa.com', phone: '0201234567' },
      { name: 'Kwame Osei', company: 'Osei Trading', email: 'kwame@osei.com', phone: '0551234567' },
      { name: 'Akua Boateng', company: 'Boateng School', email: 'akua@school.com', phone: '0277654321' },
      { name: 'Yaw Agyeman', company: 'Agyeman Church', email: 'yaw@church.com', phone: '0208765432' },
      { name: 'Adwoa Appiah', company: 'Appiah Events', email: 'adwoa@events.com', phone: '0245678901' },
      { name: 'Kojo Asante', company: 'Asante Corp', email: 'kojo@asante.com', phone: '0267890123' },
      { name: 'Efua Darko', company: 'Darko Ventures', email: 'efua@ventures.com', phone: '0203456789' },
      { name: 'Kwabena Owusu', company: 'Owusu Ltd', email: 'kwabena@owusu.com', phone: '0241111222' }
    ];

    const customers = [];
    for (let i = 0; i < customerNames.length; i++) {
      const custData = customerNames[i];
      const customer = await Customer.create({
        tenantId,
        name: custData.name,
        company: custData.company,
        email: custData.email,
        phone: custData.phone,
        address: `${randomInRange(1, 100)} Independence Avenue`,
        town: randomPick(['Accra', 'Kumasi', 'Tema', 'Takoradi', 'Adenta']),
        region: randomPick(['Greater Accra', 'Ashanti', 'Western', 'Eastern']),
        howDidYouHear: null, // Will be set based on Customer model constraints
        isActive: true
      });
      customers.push(customer);
    }
    console.log(`[Seed] Created ${customers.length} customers`);

    // === SEED VENDORS ===
    console.log('[Seed] Creating vendors...');
    const vendorNames = [
      { name: 'Paper Supplies Ghana', company: 'Paper Supplies Ghana Ltd', email: 'sales@papersupplies.gh', phone: '0302123456' },
      { name: 'Ink Masters', company: 'Ink Masters Ltd', email: 'info@inkmasters.com', phone: '0302234567' },
      { name: 'Equipment Pro', company: 'Equipment Pro Ghana', email: 'sales@equipmentpro.gh', phone: '0302345678' }
    ];

    const vendors = [];
    for (const vendData of vendorNames) {
      const vendor = await Vendor.create({
        tenantId,
        name: vendData.name,
        company: vendData.company,
        email: vendData.email,
        phone: vendData.phone,
        address: 'Accra, Ghana',
        isActive: true
      });
      vendors.push(vendor);
    }
    console.log(`[Seed] Created ${vendors.length} vendors`);

    // === SEED PRICING TEMPLATES ===
    console.log('[Seed] Creating pricing templates...');
    const pricingTemplates = [];
    const templates = [
      { name: 'A4 Black & White Photocopy', category: 'Photocopying', materialType: 'Paper', pricePerUnit: 0.50 },
      { name: 'A4 Color Photocopy', category: 'Photocopying', materialType: 'Paper', pricePerUnit: 2.00 },
      { name: 'T-Shirt Printing', category: 'Printing', materialType: 'Fabric', pricePerUnit: 25.00 },
      { name: 'Banner Printing', category: 'Printing', materialType: 'Vinyl', pricePerUnit: 15.00 },
      { name: 'Business Cards', category: 'Printing', materialType: 'Cardstock', pricePerUnit: 0.80 },
      { name: 'Binding Service', category: 'Binding', materialType: 'Paper', pricePerUnit: 5.00 }
    ];

    for (const tmpl of templates) {
      const template = await PricingTemplate.create({
        tenantId,
        name: tmpl.name,
        category: tmpl.category,
        materialType: tmpl.materialType,
        pricePerUnit: tmpl.pricePerUnit,
        status: 'active',
        basePrice: 0
      });
      pricingTemplates.push(template);
    }
    console.log(`[Seed] Created ${pricingTemplates.length} pricing templates`);

    // === SEED LEADS ===
    console.log('[Seed] Creating leads...');
    const leadSources = [
      'Social Media - Facebook',
      'Social Media - Instagram', 
      'Online - Google',
      'Online - Website',
      'Referral',
      'Walk-in',
      'Phone Call',
      'Email',
      'Event/Exhibition',
      'Cold Call'
    ];
    const leadStatuses = ['new', 'contacted', 'qualified', 'lost', 'converted'];
    const leadPriorities = ['low', 'medium', 'high'];
    const leadTags = ['printing', 'design', 'bulk-order', 'corporate', 'wedding', 'event', 'urgent', 'regular-customer'];
    
    const existingLeadCount = await Lead.count({ where: { tenantId } });
    let leadCounter = 0;
    const leads = [];
    
    // Create 30-50 leads with various statuses
    const totalLeads = randomInRange(30, 50);
    
    for (let i = 0; i < totalLeads; i++) {
      const leadDate = dayjs().subtract(randomInRange(0, 90), 'day'); // Leads from last 3 months
      const status = randomPick(leadStatuses);
      const priority = randomPick(leadPriorities);
      const source = randomPick(leadSources);
      
      // Generate lead name and company
      const firstNames = ['Kwame', 'Ama', 'Kofi', 'Akua', 'Yaw', 'Abena', 'Kwesi', 'Efua', 'Fiifi', 'Adjoa'];
      const lastNames = ['Mensah', 'Asante', 'Boateng', 'Osei', 'Owusu', 'Agyeman', 'Ansah', 'Appiah'];
      const companies = [
        'Future Tech Ltd',
        'Bright Stars Academy',
        'Golden Events GH',
        'Smart Solutions',
        'Royal Weddings',
        'Excel Ventures',
        'Prime Services',
        'Victory Church',
        'Elite Consulting',
        'Green Valley School',
        null // Some leads without company
      ];
      
      const leadName = `${randomPick(firstNames)} ${randomPick(lastNames)}`;
      const company = randomPick(companies);
      const phone = `0${randomInRange(20, 59)}${randomInRange(1000000, 9999999)}`;
      const email = leadName.toLowerCase().replace(' ', '.') + '@' + (company ? company.toLowerCase().replace(/\s+/g, '') : 'email') + '.com';
      
      // Set follow-up dates and last contacted based on status
      let lastContactedAt = null;
      let nextFollowUp = null;
      let convertedCustomerId = null;
      let convertedJobId = null;
      
      if (status !== 'new') {
        lastContactedAt = leadDate.add(randomInRange(1, 3), 'day').toDate();
      }
      
      if (status === 'contacted' || status === 'qualified') {
        nextFollowUp = dayjs().add(randomInRange(1, 7), 'day').toDate();
      }
      
      // Some qualified leads might be converted to customers
      if (status === 'converted' && customers.length > 0) {
        const customer = randomPick(customers);
        convertedCustomerId = customer.id;
      }
      
      // Select 1-3 random tags
      const numTags = randomInRange(1, 3);
      const selectedTags = [];
      for (let t = 0; t < numTags; t++) {
        const tag = randomPick(leadTags);
        if (!selectedTags.includes(tag)) {
          selectedTags.push(tag);
        }
      }
      
      const leadNotes = [
        'Interested in bulk printing services for corporate events',
        'Looking for affordable wedding invitation packages',
        'Needs quotation for school magazine printing',
        'Wants to discuss branding and design services',
        'Inquired about photocopying rates for large volumes',
        'Interested in banner printing for upcoming event',
        'Looking for regular printing partner for monthly newsletters',
        'Needs urgent lamination services',
        'Wants custom design for business cards',
        'Inquiring about binding services for project reports'
      ];
      
      const leadCreatedAt = leadDate.toDate();
      const lead = await Lead.create({
        tenantId,
        name: leadName,
        company,
        email,
        phone,
        source,
        status,
        priority,
        assignedTo: userId,
        nextFollowUp,
        lastContactedAt,
        notes: randomPick(leadNotes),
        tags: selectedTags,
        metadata: {},
        convertedCustomerId,
        convertedJobId,
        isActive: status !== 'lost',
        createdAt: leadCreatedAt,
        updatedAt: leadCreatedAt
      });
      
      leads.push(lead);
      leadCounter++;
    }
    
    console.log(`[Seed] Created ${leadCounter} leads`);

    // === SEED JOBS, INVOICES, AND JOB ITEMS ===
    console.log('[Seed] Creating jobs, invoices, and items...');
    const jobStatuses = ['new', 'in_progress', 'completed', 'on_hold'];
    const priorities = ['low', 'medium', 'high'];
    const categories = ['Printing', 'Photocopying', 'Binding', 'Design', 'Lamination'];
    
    // Get existing job count to avoid duplicates
    const existingJobCount = await Job.count({ where: { tenantId } });
    const existingInvoiceCount = await Invoice.count({ where: { tenantId } });
    
    let globalJobCounter = existingJobCount + 1;
    let globalInvoiceCounter = existingInvoiceCount + 1;

    for (let month = 0; month < 12; month++) {
      // Create 10-20 jobs per month
      const jobsThisMonth = randomInRange(10, 20);
      
      for (let j = 0; j < jobsThisMonth; j++) {
        const jobDate = dayjs().subtract(month, 'month').subtract(randomInRange(0, 28), 'day');
        const customer = randomPick(customers);
        const status = month === 0 ? randomPick(['new', 'in_progress', 'completed']) : 'completed';
        const itemCount = randomInRange(1, 3);
        
        // Create job with timestamp-based unique number to avoid conflicts
        const uniqueNumber = Date.now().toString().slice(-6) + randomInRange(100, 999);
        const jobCreatedAt = jobDate.toDate();
        const job = await Job.create({
          tenantId,
          jobNumber: `JOB-${jobDate.format('YYYYMM')}-${uniqueNumber}`,
          customerId: customer.id,
          title: `${randomPick(categories)} for ${customer.company}`,
          description: 'Customer project',
          status,
          priority: randomPick(priorities),
          startDate: jobDate.toDate(),
          dueDate: jobDate.add(randomInRange(3, 14), 'day').toDate(),
          completionDate: status === 'completed' ? jobDate.add(randomInRange(1, 10), 'day').toDate() : null,
          finalPrice: 0,
          createdBy: userId,
          assignedTo: userId,
          createdAt: jobCreatedAt,
          updatedAt: jobCreatedAt
        });
        globalJobCounter++;

        // Create job items
        let totalJobPrice = 0;
        for (let i = 0; i < itemCount; i++) {
          const category = randomPick(categories);
          const quantity = randomInRange(10, 500);
          const unitPrice = randomInRange(1, 50);
          const totalPrice = quantity * unitPrice;
          totalJobPrice += totalPrice;

          await JobItem.create({
            tenantId,
            jobId: job.id,
            category,
            description: `${category} service - ${quantity} units`,
            quantity,
            unitPrice,
            totalPrice,
            specifications: {}
          });
        }

        // Update job final price
        await job.update({ finalPrice: totalJobPrice });

        // Create invoice for ALL jobs (matching real app behavior)
        const uniqueInvNumber = Date.now().toString().slice(-6) + randomInRange(100, 999);
        const invoiceCreatedAt = jobDate.add(1, 'day').toDate();
        
        // Determine invoice status based on job status
        let invoiceStatus = 'draft';
        let amountPaid = 0;
        let paidDate = null;
        
        if (status === 'completed') {
          // Completed jobs have paid/sent/overdue invoices
          invoiceStatus = Math.random() > 0.3 ? 'paid' : (Math.random() > 0.5 ? 'sent' : 'overdue');
          amountPaid = invoiceStatus === 'paid' ? totalJobPrice : (Math.random() > 0.5 ? totalJobPrice * randomInRange(0, 80) / 100 : 0);
          paidDate = invoiceStatus === 'paid' ? jobDate.add(randomInRange(5, 25), 'day').toDate() : null;
        } else if (status === 'in_progress') {
          // In-progress jobs have sent or draft invoices
          invoiceStatus = Math.random() > 0.5 ? 'sent' : 'draft';
        } else {
          // New jobs have draft invoices
          invoiceStatus = 'draft';
        }
        
        const invoice = await Invoice.create({
          tenantId,
          invoiceNumber: `INV-${jobDate.format('YYYYMM')}-${uniqueInvNumber}`,
          customerId: customer.id,
          jobId: job.id,
          invoiceDate: jobDate.add(1, 'day').toDate(),
          dueDate: jobDate.add(31, 'day').toDate(),
          subtotal: totalJobPrice,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: totalJobPrice,
          amountPaid: amountPaid,
          balance: totalJobPrice - amountPaid,
          status: invoiceStatus,
          paidDate: paidDate,
          paymentTerms: 'Net 30',
          notes: null,
          createdAt: invoiceCreatedAt,
          updatedAt: invoiceCreatedAt
        });
        
        globalInvoiceCounter++;

        // Invoice items are stored in JSON field, not separate table
        // Skip separate invoice item creation
      }
    }
    console.log(`[Seed] Created ${globalJobCounter - existingJobCount - 1} new jobs and ${globalInvoiceCounter - existingInvoiceCount - 1} new invoices`);

    // === SEED EXPENSES ===
    console.log('[Seed] Creating expenses...');
    const expenseCategories = ['Materials', 'Salaries', 'Utilities', 'Rent', 'Equipment', 'Marketing', 'Office Supplies', 'Maintenance'];
    
    const existingExpenseCount = await Expense.count({ where: { tenantId } });
    let expenseCounter = existingExpenseCount + 1;

    for (let month = 0; month < 12; month++) {
      const expensesThisMonth = randomInRange(8, 15);
      
      for (let i = 0; i < expensesThisMonth; i++) {
        const expenseDate = dayjs().subtract(month, 'month').subtract(randomInRange(0, 28), 'day');
        const category = randomPick(expenseCategories);
        let amount;

        // Set realistic amounts based on category
        switch (category) {
          case 'Salaries':
            amount = randomInRange(800, 2000);
            break;
          case 'Rent':
            amount = randomInRange(3000, 5000);
            break;
          case 'Materials':
            amount = randomInRange(500, 3000);
            break;
          case 'Utilities':
            amount = randomInRange(400, 800);
            break;
          default:
            amount = randomInRange(100, 1000);
        }

        const uniqueExpNumber = Date.now().toString().slice(-6) + randomInRange(100, 999);
        const expenseCreatedAt = expenseDate.toDate();
        await Expense.create({
          tenantId,
          expenseNumber: `EXP-${expenseDate.format('YYYYMM')}-${uniqueExpNumber}`,
          vendorId: category === 'Materials' ? randomPick(vendors).id : null,
          category,
          description: `${category} expense for ${expenseDate.format('MMMM YYYY')}`,
          amount,
          expenseDate: expenseDate.toDate(),
          paymentMethod: randomPick(['cash', 'bank_transfer', 'check']),
          status: 'paid',
          approvalStatus: 'approved',
          submittedBy: userId,
          approvedBy: userId,
          approvedAt: expenseDate.toDate(),
          createdAt: expenseCreatedAt,
          updatedAt: expenseCreatedAt
        });
        expenseCounter++;
      }
    }
    console.log(`[Seed] Created ${expenseCounter - 1} expenses`);

    // === SEED QUOTES ===
    console.log('[Seed] Creating quotes...');
    
    const existingQuoteCount = await Quote.count({ where: { tenantId } });
    let quoteCounter = existingQuoteCount + 1;

    for (let month = 0; month < 12; month++) {
      const quotesThisMonth = randomInRange(3, 8);
      
      for (let i = 0; i < quotesThisMonth; i++) {
        const quoteDate = dayjs().subtract(month, 'month').subtract(randomInRange(0, 28), 'day');
        const customer = randomPick(customers);
        const itemCount = randomInRange(1, 3);
        
        let totalQuotePrice = 0;
        const uniqueQuoteNumber = Date.now().toString().slice(-6) + randomInRange(100, 999);
        const quoteCreatedAt = quoteDate.toDate();
        const quote = await Quote.create({
          tenantId,
          quoteNumber: `QUO-${quoteDate.format('YYYYMM')}-${uniqueQuoteNumber}`,
          customerId: customer.id,
          title: `Quote for ${customer.company}`,
          description: 'Printing services quote',
          status: randomPick(['draft', 'sent', 'accepted', 'declined']),
          validUntil: quoteDate.add(30, 'day').toDate(),
          subtotal: 0,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 0,
          createdBy: userId,
          createdAt: quoteCreatedAt,
          updatedAt: quoteCreatedAt
        });
        quoteCounter++;

        // Create quote items
        for (let qi = 0; qi < itemCount; qi++) {
          const category = randomPick(categories);
          const quantity = randomInRange(10, 200);
          const unitPrice = randomInRange(2, 30);
          const totalPrice = quantity * unitPrice;
          totalQuotePrice += totalPrice;

          await QuoteItem.create({
            tenantId,
            quoteId: quote.id,
            category,
            description: `${category} - ${quantity} units`,
            quantity,
            unitPrice,
            totalPrice,
            specifications: {}
          });
        }

        // Update quote totals
        await quote.update({
          subtotal: totalQuotePrice,
          totalAmount: totalQuotePrice
        });
      }
    }
    console.log(`[Seed] Created ${quoteCounter - 1} quotes`);

    console.log('[Seed] ✅ Database seeding completed successfully!');
    console.log('[Seed] Summary:');
    console.log(`  - Customers: ${customers.length}`);
    console.log(`  - Vendors: ${vendors.length}`);
    console.log(`  - Leads: ${leadCounter}`);
    console.log(`  - Jobs: ${globalJobCounter - existingJobCount - 1}`);
    console.log(`  - Invoices: ${globalInvoiceCounter - existingInvoiceCount - 1}`);
    console.log(`  - Expenses: ${expenseCounter - existingExpenseCount - 1}`);
    console.log(`  - Quotes: ${quoteCounter - existingQuoteCount - 1}`);
    
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
    throw error;
  }
}

// Run the seeder
seedTestData()
  .then(() => {
    console.log('[Seed] Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('[Seed] Failed:', error);
    process.exit(1);
  });

