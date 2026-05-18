/**
 * Delete a tenant invoice and its linked job (and quote when safe).
 *
 * Usage (from Backend directory):
 *   node scripts/delete-invoice-and-job.js <owner-email> <invoice-number>
 *   CONFIRM_DELETE=yes node scripts/delete-invoice-and-job.js <owner-email> <invoice-number> --execute
 *
 * Without CONFIRM_DELETE=yes, prints what would be deleted (dry run).
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
const execute = process.argv.includes('--execute');

if (!ownerEmail || !invoiceNumber) {
  console.error('Usage: node scripts/delete-invoice-and-job.js <owner-email> <invoice-number> [--execute]');
  console.error('Example: CONFIRM_DELETE=yes node scripts/delete-invoice-and-job.js user@example.com INV-202605-0002 --execute');
  process.exit(1);
}

if (execute && process.env.CONFIRM_DELETE !== 'yes') {
  console.error('Set CONFIRM_DELETE=yes to run destructive delete.');
  process.exit(1);
}

async function destroyCount(Model, where, options) {
  const count = await Model.destroy({ where, ...options });
  if (count > 0) {
    console.log(`  🗑️  ${Model.name}: ${count}`);
  }
  return count;
}

async function run() {
  await testConnection();

  const user = await User.findOne({ where: { email: ownerEmail } });
  if (!user) {
    console.error(`No user found for email: ${ownerEmail}`);
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
    const found = await Invoice.findOne({
      where: { tenantId: m.tenantId, invoiceNumber },
    });
    if (found) {
      invoice = found;
      tenant = m.tenant;
      break;
    }
  }

  if (!invoice) {
    console.error(`Invoice ${invoiceNumber} not found for any tenant owned by ${ownerEmail}.`);
    process.exit(1);
  }

  const job = invoice.jobId
    ? await Job.findOne({ where: { id: invoice.jobId, tenantId: invoice.tenantId } })
    : null;

  const quote = job?.quoteId
    ? await Quote.findOne({ where: { id: job.quoteId, tenantId: invoice.tenantId } })
    : null;

  const otherJobsOnQuote =
    job?.quoteId
      ? await Job.count({
          where: {
            tenantId: invoice.tenantId,
            quoteId: job.quoteId,
            id: { [Op.ne]: job.id },
          },
        })
      : 0;

  const jobExpenses = job
    ? await Expense.findAll({ where: { jobId: job.id, tenantId: invoice.tenantId }, attributes: ['id'] })
    : [];
  const expenseIds = jobExpenses.map((e) => e.id);

  console.log('\n📋 Target summary');
  console.log(`  Owner:    ${user.name} <${user.email}>`);
  console.log(`  Tenant:   ${tenant?.name} (${invoice.tenantId})`);
  console.log(`  Invoice:  ${invoice.invoiceNumber} (${invoice.id}) status=${invoice.status} total=${invoice.totalAmount}`);
  if (job) {
    console.log(`  Job:      ${job.jobNumber} (${job.id}) status=${job.status} title=${job.title}`);
  } else {
    console.log('  Job:      (none linked)');
  }
  if (quote) {
    console.log(`  Quote:    ${quote.quoteNumber} (${quote.id})${otherJobsOnQuote ? ` — SKIPPED (${otherJobsOnQuote} other job(s) use it)` : ' — will delete'}`);
  }

  if (!execute) {
    console.log('\n⚠️  Dry run only. Re-run with CONFIRM_DELETE=yes ... --execute to delete.');
    await sequelize.close();
    return;
  }

  await sequelize.transaction(async (transaction) => {
    const opts = { transaction };
    const jobId = job?.id;

    if (jobId) {
      if (expenseIds.length) {
        await destroyCount(ExpenseActivity, { expenseId: expenseIds }, opts);
      }
      await destroyCount(Expense, { jobId, tenantId: invoice.tenantId }, opts);
      await destroyCount(Payment, { jobId, tenantId: invoice.tenantId }, opts);
      await destroyCount(MaterialMovement, { jobId, tenantId: invoice.tenantId }, opts);
      await destroyCount(JobStatusHistory, { jobId }, opts);
      await destroyCount(JobItem, { jobId, tenantId: invoice.tenantId }, opts);
    }

    await destroyCount(Invoice, { id: invoice.id, tenantId: invoice.tenantId }, opts);

    if (jobId) {
      await destroyCount(Job, { id: jobId, tenantId: invoice.tenantId }, opts);
    }

    if (quote && otherJobsOnQuote === 0) {
      await destroyCount(QuoteActivity, { quoteId: quote.id }, opts);
      await destroyCount(QuoteItem, { quoteId: quote.id }, opts);
      await destroyCount(Quote, { id: quote.id, tenantId: invoice.tenantId }, opts);
    }

    if (invoice.customerId) {
      await updateCustomerBalance(invoice.customerId, transaction);
    }
  });

  console.log('\n✅ Delete completed.');
  await sequelize.close();
}

run().catch((err) => {
  console.error('❌', err.message);
  if (err.parent) console.error(err.parent.message);
  sequelize.close().finally(() => process.exit(1));
});
