require('dotenv').config();

const { sequelize } = require('../config/database');
const {
  Invoice,
  User,
  UserTenant,
  JournalEntry,
  JournalEntryLine,
  Account
} = require('../models');
const accountingService = require('../services/accountingService');
const { getAccountCodes } = require('../config/accountingAccountCodes');
const { Op } = require('sequelize');

function parseArgs() {
  return process.argv.slice(2).reduce((acc, arg) => {
    if (!arg.startsWith('--')) return acc;
    const [key, ...rest] = arg.slice(2).split('=');
    acc[key] = rest.join('=') || 'true';
    return acc;
  }, {});
}

function toNumber(value) {
  const parsed = parseFloat(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function resolveTenantId(email) {
  if (!email) return null;
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await User.findOne({
    where: { email: normalizedEmail },
    attributes: ['id']
  });
  if (!user) return null;

  const membership = await UserTenant.findOne({
    where: { userId: user.id, status: 'active' },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
    attributes: ['tenantId']
  });

  return membership?.tenantId || null;
}

async function run() {
  const args = parseArgs();
  const invoiceNumber = args.invoiceNumber || 'INV-202604-0006';
  const userEmail = args.userEmail || 'icreationsghana@gmail.com';
  const targetPaidAmount = toNumber(args.targetPaid || 400);
  const dryRun = args.dryRun === 'true';

  await sequelize.authenticate();

  const tenantId = args.tenantId || (await resolveTenantId(userEmail));
  if (!tenantId) {
    throw new Error('Could not resolve tenant. Provide --tenantId or valid --userEmail.');
  }

  const invoice = await Invoice.findOne({
    where: { tenantId, invoiceNumber }
  });
  if (!invoice) {
    throw new Error(`Invoice not found for tenant. invoiceNumber=${invoiceNumber}, tenantId=${tenantId}`);
  }

  const totalAmount = toNumber(invoice.totalAmount);
  if (targetPaidAmount < 0 || targetPaidAmount > totalAmount) {
    throw new Error(`targetPaid must be between 0 and ${totalAmount.toFixed(2)}`);
  }

  const oldPaid = toNumber(invoice.amountPaid);
  const newPaid = targetPaidAmount;
  const newBalance = Math.max(0, totalAmount - newPaid);
  const newStatus = newPaid <= 0 ? (invoice.status === 'draft' ? 'draft' : 'sent') : (newBalance <= 0.01 ? 'paid' : 'partial');
  const newPaidDate = newStatus === 'paid' ? (invoice.paidDate || new Date()) : null;

  const codes = await getAccountCodes(tenantId);

  const postedPaymentJournals = await JournalEntry.findAll({
    where: {
      tenantId,
      source: { [Op.in]: ['invoice_payment', 'invoice_payment_adjustment'] },
      sourceId: invoice.id,
      status: 'posted'
    },
    include: [{
      model: JournalEntryLine,
      as: 'lines',
      required: false,
      include: [{ model: Account, as: 'account', attributes: ['code'] }]
    }]
  });

  let netPaidInAccounting = 0;
  for (const journal of postedPaymentJournals) {
    for (const line of journal.lines || []) {
      const code = line.account?.code;
      const debit = toNumber(line.debit);
      const credit = toNumber(line.credit);
      if (code === codes.accountsReceivable) {
        netPaidInAccounting += credit - debit;
      }
    }
  }

  const accountingDelta = Number((newPaid - netPaidInAccounting).toFixed(2));
  const needsAccountingAdjustment = Math.abs(accountingDelta) >= 0.01;

  const result = {
    invoiceNumber,
    tenantId,
    oldPaid,
    newPaid,
    totalAmount,
    newBalance,
    newStatus,
    netPaidInAccounting: Number(netPaidInAccounting.toFixed(2)),
    accountingDelta,
    dryRun
  };

  if (dryRun) {
    console.log(JSON.stringify({ success: true, preview: result }, null, 2));
    return;
  }

  await invoice.update({
    amountPaid: newPaid,
    balance: newBalance,
    status: newStatus,
    paidDate: newPaidDate
  });

  if (needsAccountingAdjustment) {
    const arAccount = await accountingService.getAccountByCode(tenantId, codes.accountsReceivable);
    const cashAccount = await accountingService.getAccountByCode(tenantId, codes.cash);
    if (!arAccount || !cashAccount) {
      throw new Error('Could not find AR/Cash accounts for accounting adjustment.');
    }

    // paymentDelta > 0 means extra payment to record; < 0 means reversal of over-recorded payment
    const lines = accountingDelta > 0
      ? [
          {
            accountId: cashAccount.id,
            debit: accountingDelta,
            credit: 0,
            description: `Payment adjustment for ${invoiceNumber}`
          },
          {
            accountId: arAccount.id,
            debit: 0,
            credit: accountingDelta,
            description: `AR adjustment for ${invoiceNumber}`
          }
        ]
      : [
          {
            accountId: arAccount.id,
            debit: Math.abs(accountingDelta),
            credit: 0,
            description: `Payment reversal for ${invoiceNumber}`
          },
          {
            accountId: cashAccount.id,
            debit: 0,
            credit: Math.abs(accountingDelta),
            description: `Cash reversal for ${invoiceNumber}`
          }
        ];

    await accountingService.createJournalEntry({
      tenantId,
      reference: `INV-PAY-ADJ-${invoiceNumber}-${Date.now()}`,
      description: `Invoice payment correction for ${invoiceNumber}`,
      entryDate: new Date(),
      status: 'posted',
      source: 'invoice_payment_adjustment',
      sourceId: invoice.id,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber,
        oldPaid,
        newPaid,
        netPaidInAccounting,
        accountingDelta
      },
      lines
    });
  }

  const updated = await Invoice.findByPk(invoice.id, {
    attributes: ['invoiceNumber', 'amountPaid', 'balance', 'status', 'totalAmount']
  });

  console.log(JSON.stringify({ success: true, updatedInvoice: updated, adjustment: result }, null, 2));
}

run()
  .catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
