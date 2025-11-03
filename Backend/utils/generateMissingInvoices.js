const { Job, Invoice, JobItem, Customer } = require('../models');
const { Op } = require('sequelize');

// Generate unique invoice number
const generateInvoiceNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const lastInvoice = await Invoice.findOne({
    where: {
      invoiceNumber: {
        [Op.like]: `INV-${year}${month}%`
      }
    },
    order: [['createdAt', 'DESC']]
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-').pop());
    sequence = lastSequence + 1;
  }

  return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// Helper function to create invoice for a job
const createInvoiceForJob = async (job) => {
  try {
    // Check if invoice already exists for this job
    const existingInvoice = await Invoice.findOne({ where: { jobId: job.id } });
    if (existingInvoice) {
      console.log(`⚠️  Invoice already exists for job ${job.jobNumber}`);
      return null;
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Calculate subtotal from job items or finalPrice
    let subtotal = 0;
    let items = [];

    if (job.items && job.items.length > 0) {
      items = job.items.map(item => ({
        description: item.description || item.category,
        category: item.category,
        paperSize: item.paperSize,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        total: parseFloat(item.quantity) * parseFloat(item.unitPrice)
      }));
      subtotal = items.reduce((sum, item) => sum + item.total, 0);
    } else {
      // If no items, use finalPrice from job
      subtotal = parseFloat(job.finalPrice || 0);
      items = [{
        description: job.title,
        quantity: 1,
        unitPrice: subtotal,
        total: subtotal
      }];
    }

    // Create invoice with default values
    const invoice = await Invoice.create({
      invoiceNumber,
      jobId: job.id,
      customerId: job.customerId,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
      subtotal,
      taxRate: 0,
      discountType: 'fixed',
      discountValue: 0,
      paymentTerms: 'Net 30',
      items,
      notes: `Auto-generated invoice for job ${job.jobNumber}`,
      termsAndConditions: 'Payment is due within the specified payment terms. Late payments may incur additional charges.'
    });

    console.log(`✅ Created invoice ${invoiceNumber} for job ${job.jobNumber}`);
    return invoice;
  } catch (error) {
    console.error(`❌ Error creating invoice for job ${job.jobNumber}:`, error.message);
    return null;
  }
};

// Main function to generate invoices for completed jobs
const generateMissingInvoices = async () => {
  try {
    console.log('\n🔍 Finding completed jobs without invoices...\n');

    // Find all completed jobs
    const completedJobs = await Job.findAll({
      where: {
        status: 'completed'
      },
      include: [
        { model: JobItem, as: 'items' },
        { model: Customer, as: 'customer', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'ASC']]
    });

    console.log(`📊 Found ${completedJobs.length} completed job(s)\n`);

    if (completedJobs.length === 0) {
      console.log('ℹ️  No completed jobs found. Mark jobs as "completed" to generate invoices.\n');
      process.exit(0);
    }

    let created = 0;
    let skipped = 0;

    for (const job of completedJobs) {
      const invoice = await createInvoiceForJob(job);
      if (invoice) {
        created++;
      } else {
        skipped++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✨ Summary:`);
    console.log(`   Invoices created: ${created}`);
    console.log(`   Invoices skipped: ${skipped}`);
    console.log('='.repeat(50) + '\n');

    console.log('✅ Done!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

// Run the script
generateMissingInvoices();






