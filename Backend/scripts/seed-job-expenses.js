require('dotenv').config();
const { sequelize } = require('../config/database');
const { Job, Expense, Vendor, User, UserTenant } = require('../models');

const expenseCategories = [
  'Materials',
  'Labor',
  'Equipment',
  'Transportation',
  'Utilities',
  'Marketing',
  'Office Supplies',
  'Maintenance',
  'Other'
];

const paymentMethods = ['cash', 'check', 'credit_card', 'bank_transfer', 'other'];
const statuses = ['pending', 'paid', 'overdue'];
const approvalStatuses = ['approved', 'pending_approval', 'draft'];

const expenseDescriptions = {
  'Materials': [
    'Paper stock for printing',
    'Ink cartridges',
    'Binding materials',
    'Lamination sheets',
    'Vinyl for banners',
    'Card stock',
    'Photo paper',
    'Mounting boards'
  ],
  'Labor': [
    'Design work',
    'Printing labor',
    'Binding services',
    'Installation work',
    'Delivery service',
    'Setup labor'
  ],
  'Equipment': [
    'Printer maintenance',
    'Equipment rental',
    'Tool purchase',
    'Machine repair'
  ],
  'Transportation': [
    'Delivery to customer',
    'Material pickup',
    'Site visit',
    'Courier service'
  ],
  'Utilities': [
    'Electricity for printing',
    'Internet service',
    'Phone bills'
  ],
  'Marketing': [
    'Advertising materials',
    'Promotional items',
    'Social media ads'
  ],
  'Office Supplies': [
    'Stationery',
    'Cleaning supplies',
    'Office equipment'
  ],
  'Maintenance': [
    'Printer cleaning',
    'Equipment servicing',
    'Facility maintenance'
  ],
  'Other': [
    'Miscellaneous expenses',
    'Unexpected costs',
    'Additional services'
  ]
};

function randomPick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

async function seedJobExpenses() {
  try {
    console.log('[Seed] Starting job expenses seeding...');

    // Get tenant ID from first job
    const firstJob = await Job.findOne({ limit: 1 });
    if (!firstJob) {
      console.log('[Seed] No jobs found. Please create jobs first.');
      return;
    }

    const tenantId = firstJob.tenantId;
    console.log(`[Seed] Using tenant ID: ${tenantId}`);

    // Get jobs for this tenant
    const jobs = await Job.findAll({
      where: { tenantId },
      limit: 50, // Get up to 50 jobs
      order: [['createdAt', 'DESC']]
    });

    if (jobs.length === 0) {
      console.log('[Seed] No jobs found for this tenant.');
      return;
    }

    console.log(`[Seed] Found ${jobs.length} jobs. Creating expenses...`);

    // Get vendors for this tenant
    const vendors = await Vendor.findAll({
      where: { tenantId },
      limit: 10
    });

    // Get users for this tenant through UserTenant (for submittedBy and approvedBy)
    const userTenants = await UserTenant.findAll({
      where: { tenantId, status: 'active' },
      include: [{ model: User, as: 'user' }],
      limit: 5
    });

    const users = userTenants.map(ut => ut.user).filter(Boolean);

    if (users.length === 0) {
      console.log('[Seed] No users found. Expenses will be created without submitter/approver.');
    }

    let expenseCounter = 0;
    const existingExpenseNumbers = new Set();

    // Create expenses for 60% of jobs (random selection)
    const jobsToExpense = jobs.slice(0, Math.floor(jobs.length * 0.6));
    const shuffledJobs = jobsToExpense.sort(() => Math.random() - 0.5);

    for (const job of shuffledJobs) {
      // Each job gets 1-3 expenses
      const numExpenses = randomInRange(1, 3);

      for (let i = 0; i < numExpenses; i++) {
        const category = randomPick(expenseCategories);
        const descriptions = expenseDescriptions[category];
        const description = randomPick(descriptions);
        
        // Amount based on category and job value
        let amount;
        if (category === 'Materials') {
          amount = randomDecimal(50, 500);
        } else if (category === 'Labor') {
          amount = randomDecimal(100, 800);
        } else if (category === 'Equipment') {
          amount = randomDecimal(200, 1000);
        } else {
          amount = randomDecimal(20, 300);
        }

        // Generate unique expense number
        let expenseNumber;
        do {
          expenseNumber = `EXP-${Date.now().toString().slice(-6)}${randomInRange(100, 999)}`;
        } while (existingExpenseNumbers.has(expenseNumber));
        existingExpenseNumbers.add(expenseNumber);

        // Random vendor (60% chance)
        const vendorId = Math.random() < 0.6 && vendors.length > 0 
          ? randomPick(vendors).id 
          : null;

        // Random user for submittedBy and approvedBy
        const submittedBy = users.length > 0 ? randomPick(users).id : null;
        const approvedBy = users.length > 0 && Math.random() < 0.7 ? randomPick(users).id : null;

        // Approval status - most are approved
        const approvalStatus = randomPick(['approved', 'approved', 'approved', 'pending_approval', 'draft']);
        const status = approvalStatus === 'approved' ? randomPick(['paid', 'paid', 'pending']) : 'pending';

        // Expense date - within the last 6 months, but after job creation
        const jobDate = new Date(job.createdAt);
        const now = new Date();
        const sixMonthsAgo = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000));
        const minDate = jobDate > sixMonthsAgo ? jobDate : sixMonthsAgo;
        const expenseDate = new Date(minDate.getTime() + Math.random() * (now.getTime() - minDate.getTime()));

        // Approved at date (if approved)
        const approvedAt = approvedBy && approvalStatus === 'approved' 
          ? new Date(expenseDate.getTime() + randomInRange(1, 7) * 24 * 60 * 60 * 1000)
          : null;

        try {
          await Expense.create({
            tenantId,
            expenseNumber,
            jobId: job.id,
            vendorId,
            category,
            description: `${description} for ${job.jobNumber}`,
            amount,
            expenseDate,
            paymentMethod: randomPick(paymentMethods),
            status,
            approvalStatus,
            submittedBy,
            approvedBy,
            approvedAt,
            notes: Math.random() < 0.3 ? `Expense related to ${job.title}` : null,
            createdAt: expenseDate,
            updatedAt: expenseDate
          });

          expenseCounter++;
        } catch (error) {
          console.error(`[Seed] Error creating expense for job ${job.jobNumber}:`, error.message);
        }
      }
    }

    console.log(`[Seed] ✅ Created ${expenseCounter} expenses for ${shuffledJobs.length} jobs`);
    console.log('[Seed] ✅ Job expenses seeding completed successfully!');

  } catch (error) {
    console.error('[Seed] ❌ Error seeding job expenses:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the seeder
if (require.main === module) {
  seedJobExpenses()
    .then(() => {
      console.log('[Seed] Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Seed] Script failed:', error);
      process.exit(1);
    });
}

module.exports = seedJobExpenses;

