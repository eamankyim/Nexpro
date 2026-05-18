/**
 * Delete a specific invoice and its linked job (and quote if only used by that job).
 *
 * Usage (from Backend directory):
 *   node scripts/delete-invoice-and-related.js <owner-email> <invoice-number>
 *   CONFIRM_DELETE=yes node scripts/delete-invoice-and-related.js icreationsglobal@gmail.com INV-202605-0002
 */

require('dotenv').config();

const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const {
  User,
  UserTenant,
  Tenant,
  Invoice,
  Job,
  Quote,
  QuoteItem,
  QuoteActivity,
  JobItem,
  JobStatusHistory,
  Payment,
  Expense,
  ExpenseActivity,
  MaterialMovement,
} = require('../models');
const { updateCustomerBalance } = require('../services/customerBalanceService');

const ownerEmail = (process.argv[2] || '').trim().toLowerCase();
const invoiceNumber = (process.argv[3] || '').trim();
const confirmDelete = process.env.CONFIRM_DELETE === 'yes';

if (!ownerEmail || !invoiceNumber) {
  console.error('Usage: node scripts/delete-invoice-and-related.js <owner-email> <invoice-number>');
  console.error('Execute: CONFIRM_DELETE=yes node scripts/delete-invoice-and-related.js <email> <invoice#>');
  process.exit(1);
}

async function countDestroy(Model, where, options) {
  const count = await Model.count({ where, ...options });
  if (count > 0) await Model.destroy({ where, ...options });
  return count;
}

async function run() {
  await testConnection();

  const user = await User.findOne({ where: { email: ownerEmail } });
  if (!user) {
    console.error(`No user found with email: ${ownerEmail}`);
    process.exit(1);
  }

  const memberships = await UserTenant.findAll({
    where: { userId: user.id, status: 'active' },
    include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name', 'businessType'] }],
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });

  if (!memberships.length) {
    console.error(`User ${ownerEmail} has no active tenant memberships.`);
    process.exit(1);
  }

  let invoice = null;
  let tenant = null;

  for (const m of memberships) {
    const t = m.tenant;
    const found = await Invoice.findOne({
      where: { tenantId: t.id, invoiceNumber },
    });
    if (found) {
      invoice = found;
      tenant = t;
      break;
    }
  }

  if (!invoice) {
    console.error(`Invoice ${invoiceNumber} not found for any tenant owned by ${ownerEmail}.`);
    process.exit(1);
  }

  const job = invoice.jobId
    ? await Job.findOne({ where: { id: invoice.jobId, tenantId: tenant.id } })
    : null;

  const quote = job?.quoteId
    ? await Quote.findOne({ where: { id: job.quoteId, tenantId: tenant.id } })
    : null;

  const otherJobsOnQuote = job?.quoteId
    ? await Job.count({
        where: { tenantId: tenant.id, quoteId: job.quoteId, id: { [Op.ne]: job.id } },
      })
    : 0;

  const jobIds = job ? [job.id] : [];
  const expenseIds = job
    ? (await Expense.findAll({ where: { jobId: job.id, tenantId: tenant.id }, attributes: ['id'] })).map(
        (e) => e.id
      )
    : [];

  console.log('\n--- Preview ---');
  console.log(`Tenant:     ${tenant.name} (${tenant.id})`);
  console.log(`Owner:      ${user.name} <${user.email}>`);
  console.log(`Invoice:    ${invoice.invoiceNumber} (${invoice.id}) status=${invoice.status} total=${invoice.totalAmount}`);
  if (job) {
    console.log(`Job:        ${job.jobNumber} (${job.id}) status=${job.status} title=${job.title}`);
  } else {
    console.log('Job:        (none linked)');
  }
  if (quote) {
    console.log(`Quote:      ${quote.quoteNumber} (${quote.id}) delete=${otherJobsOnQuote === 0 ? 'yes' : 'no (other jobs use it)'}`);
  }

  if (!confirmDelete) {
    console.log('\nDry run only. To delete, run:');
    console.log(
      `  CONFIRM_DELETE=yes node scripts/delete-invoice-and-related.js ${ownerEmail} ${invoiceNumber}`
    );
    await sequelize.close();
    process.exit(0);
  }

  console.log('\n--- Deleting ---');

  await sequelize.transaction(async (tx) => {
    const options = { transaction: tx };

    if (jobIds.length) {
      const n = await countDestroy(JobStatusHistory, { jobId: jobIds }, options);
      if (n) console.log(`  JobStatusHistory: ${n}`);
      const n2 = await countDestroy(JobItem, { jobId: jobIds, tenantId: tenant.id }, options);
      if (n2) console.log(`  JobItem: ${n2}`);
      const n3 = await countDestroy(MaterialMovement, { jobId: jobIds, tenantId: tenant.id }, options);
      if (n3) console.log(`  MaterialMovement: ${n3}`);
      const n4 = await countDestroy(Payment, { jobId: jobIds, tenantId: tenant.id }, options);
      if (n4) console.log(`  Payment: ${n4}`);
      if (expenseIds.length) {
        const n5 = await countDestroy(ExpenseActivity, { expenseId: expenseIds }, options);
        if (n5) console.log(`  ExpenseActivity: ${n5}`);
      }
      const n6 = await countDestroy(Expense, { jobId: jobIds, tenantId: tenant.id }, options);
      if (n6) console.log(`  Expense: ${n6}`);
    }

    const invCount = await countDestroy(
      Invoice,
      { id: invoice.id, tenantId: tenant.id },
      options
    );
    console.log(`  Invoice: ${invCount}`);

    if (job) {
      const jobCount = await countDestroy(Job, { id: job.id, tenantId: tenant.id }, options);
      console.log(`  Job: ${jobCount}`);
    }

    if (quote && otherJobsOnQuote === 0) {
      await countDestroy(QuoteActivity, { quoteId: quote.id }, options);
      await countDestroy(QuoteItem, { quoteId: quote.id, tenantId: tenant.id }, options);
      const qCount = await countDestroy(Quote, { id: quote.id, tenantId: tenant.id }, options);
      console.log(`  Quote: ${qCount}`);
    }

    if (invoice.customerId) {
      await updateCustomerBalance(invoice.customerId, tx);
      console.log(`  Customer balance updated for ${invoice.customerId}`);
    }
  });

  console.log('\nDone.');
  await sequelize.close();
}

run().catch((err) => {
  console.error('Failed:', err);
  sequelize.close().finally(() => process.exit(1));
});
