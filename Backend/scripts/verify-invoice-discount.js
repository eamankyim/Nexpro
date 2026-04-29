require('dotenv').config();
const { Op } = require('sequelize');

const { sequelize } = require('../config/database');
const { Invoice, User, UserTenant, JournalEntry, JournalEntryLine, Account, Job } = require('../models');
const accountingService = require('../services/accountingService');
const { getAccountCodes } = require('../config/accountingAccountCodes');

const DEFAULT_INVOICE_NUMBER = 'INV-202604-0007';
const DEFAULT_USER_EMAIL = 'icreationsghana@gmail.com';
const DEFAULT_EXPECTED_DISCOUNT = 4000;
const DEFAULT_ITEM_INDEX = 0;

/**
 * Parse CLI args in --key=value format.
 * @returns {Object<string, string>}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return args.reduce((acc, arg) => {
    if (!arg.startsWith('--')) return acc;
    const [key, ...rest] = arg.slice(2).split('=');
    acc[key] = rest.join('=') || 'true';
    return acc;
  }, {});
}

/**
 * Convert any numeric-like value to number.
 * @param {unknown} value
 * @returns {number}
 */
function toNumber(value) {
  const parsed = parseFloat(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Build normalized line item and derived totals.
 * @param {Array} items
 * @param {number} targetItemIndex
 * @param {number} expectedDiscount
 * @returns {{items: Array, subtotal: number, totalLineDiscount: number}}
 */
function rebuildItems(items, targetItemIndex, expectedDiscount) {
  const updatedItems = (Array.isArray(items) ? items : []).map((item, index) => {
    const quantity = toNumber(item.quantity || 1);
    const unitPrice = toNumber(item.unitPrice);
    const baseTotal = quantity * unitPrice;
    const originalDiscount = toNumber(item.discountAmount);
    const discountAmount = index === targetItemIndex ? expectedDiscount : originalDiscount;
    const clampedDiscount = Math.max(0, Math.min(discountAmount, baseTotal));
    const lineTotal = Math.max(0, baseTotal - clampedDiscount);

    return {
      ...item,
      quantity,
      unitPrice,
      discountAmount: clampedDiscount,
      total: lineTotal
    };
  });

  const subtotal = updatedItems.reduce((sum, item) => sum + (toNumber(item.quantity) * toNumber(item.unitPrice)), 0);
  const totalLineDiscount = updatedItems.reduce((sum, item) => sum + toNumber(item.discountAmount), 0);

  return { items: updatedItems, subtotal, totalLineDiscount };
}

async function resolveTenantIdByUserEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;

  const user = await User.findOne({
    where: { email: normalizedEmail },
    attributes: ['id', 'email']
  });

  if (!user) return null;

  const membership = await UserTenant.findOne({
    where: { userId: user.id, status: 'active' },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
    attributes: ['tenantId', 'isDefault']
  });

  return membership?.tenantId || null;
}

async function run() {
  const args = parseArgs();
  const invoiceNumber = args.invoiceNumber || DEFAULT_INVOICE_NUMBER;
  const userEmail = args.userEmail || DEFAULT_USER_EMAIL;
  const expectedDiscount = toNumber(args.expectedDiscount || DEFAULT_EXPECTED_DISCOUNT);
  const targetItemIndex = Math.max(0, parseInt(args.itemIndex || DEFAULT_ITEM_INDEX, 10) || DEFAULT_ITEM_INDEX);
  const shouldApplyFix = args.fix === 'true';
  const shouldSyncAccounting = args.syncAccounting === 'true';
  const shouldSyncJob = args.syncJob === 'true';

  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const tenantId = args.tenantId || (await resolveTenantIdByUserEmail(userEmail));
    if (!tenantId) {
      console.error(`❌ Could not resolve tenantId. Provide --tenantId=... or confirm user email exists: ${userEmail}`);
      process.exit(1);
    }

    const invoice = await Invoice.findOne({
      where: { tenantId, invoiceNumber }
    });

    if (!invoice) {
      console.error(`❌ Invoice not found: ${invoiceNumber} for tenant ${tenantId}`);
      process.exit(1);
    }

    const originalItems = Array.isArray(invoice.items) ? invoice.items : [];
    if (originalItems.length <= targetItemIndex) {
      console.error(`❌ Item index ${targetItemIndex} does not exist. Invoice has ${originalItems.length} item(s).`);
      process.exit(1);
    }

    const currentDiscount = toNumber(originalItems[targetItemIndex]?.discountAmount);
    const currentHeaderDiscount = toNumber(invoice.discountValue);
    const { items: recomputedItems, subtotal, totalLineDiscount } = rebuildItems(
      originalItems,
      targetItemIndex,
      expectedDiscount
    );
    const taxRate = toNumber(invoice.taxRate);
    const taxableBase = Math.max(0, subtotal - totalLineDiscount);
    const expectedTaxAmount = (taxableBase * taxRate) / 100;
    const expectedTotal = taxableBase + expectedTaxAmount;
    const amountPaid = toNumber(invoice.amountPaid);
    const expectedBalance = Math.max(0, expectedTotal - amountPaid);

    const isLineDiscountOk = Math.abs(currentDiscount - expectedDiscount) < 0.01;
    const isHeaderDiscountOk = Math.abs(currentHeaderDiscount - totalLineDiscount) < 0.01;
    const isSubtotalOk = Math.abs(toNumber(invoice.subtotal) - subtotal) < 0.01;
    const isTotalOk = Math.abs(toNumber(invoice.totalAmount) - expectedTotal) < 0.01;
    const invoiceDataOk = isLineDiscountOk && isHeaderDiscountOk && isSubtotalOk && isTotalOk;

    const codes = await getAccountCodes(tenantId);

    const revenueJournals = await JournalEntry.findAll({
      where: {
        tenantId,
        source: { [Op.in]: ['invoice_revenue', 'invoice_revenue_reconcile'] },
        sourceId: invoice.id
      },
      include: [
        {
          model: JournalEntryLine,
          as: 'lines',
          required: false,
          include: [{ model: Account, as: 'account', attributes: ['id', 'code', 'name'] }]
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    const postedRevenueJournals = revenueJournals.filter((entry) => entry.status === 'posted');
    let accountingStatus = 'not_found';
    let expectedRevenue = taxableBase;
    let expectedArDebit = expectedTotal;
    let expectedVatCredit = expectedTaxAmount;
    let actualArDebit = 0;
    let actualRevenueCredit = 0;
    let actualVatCredit = 0;
    let arAccount = null;
    let revenueAccount = null;
    let vatAccount = null;

    if (postedRevenueJournals.length > 0) {
      for (const journal of postedRevenueJournals) {
        for (const line of journal.lines || []) {
          const code = line.account?.code;
          const debit = toNumber(line.debit);
          const credit = toNumber(line.credit);
          if (code === codes.accountsReceivable) actualArDebit += debit - credit;
          if (code === codes.revenue) actualRevenueCredit += credit - debit;
          if (code === codes.vatPayable) actualVatCredit += credit - debit;
        }
      }

      const isArOk = Math.abs(actualArDebit - expectedArDebit) < 0.01;
      const isRevenueOk = Math.abs(actualRevenueCredit - expectedRevenue) < 0.01;
      const isVatOk = Math.abs(actualVatCredit - expectedVatCredit) < 0.01;
      accountingStatus = isArOk && isRevenueOk && isVatOk ? 'ok' : 'mismatch';
    }

    arAccount = await accountingService.getAccountByCode(tenantId, codes.accountsReceivable);
    revenueAccount = await accountingService.getAccountByCode(tenantId, codes.revenue);
    vatAccount = expectedVatCredit > 0
      ? await accountingService.getAccountByCode(tenantId, codes.vatPayable)
      : null;

    const arDelta = expectedArDebit - actualArDebit;
    const revenueDelta = expectedRevenue - actualRevenueCredit;
    const vatDelta = expectedVatCredit - actualVatCredit;
    const accountingMismatch =
      Math.abs(arDelta) >= 0.01 ||
      Math.abs(revenueDelta) >= 0.01 ||
      Math.abs(vatDelta) >= 0.01;

    console.log('\n=== Invoice Discount Verification ===');
    console.log(`Invoice Number: ${invoice.invoiceNumber}`);
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`User Email: ${userEmail}`);
    console.log(`Target Item Index: ${targetItemIndex}`);
    console.log(`Expected Item Discount: ${expectedDiscount.toFixed(2)}`);
    console.log(`Current Item Discount: ${currentDiscount.toFixed(2)}`);
    console.log(`Current Header Discount: ${currentHeaderDiscount.toFixed(2)}`);
    console.log(`Expected Header Discount (sum of line discounts): ${totalLineDiscount.toFixed(2)}`);
    console.log(`Current Subtotal: ${toNumber(invoice.subtotal).toFixed(2)} | Expected Subtotal: ${subtotal.toFixed(2)}`);
    console.log(`Current Total: ${toNumber(invoice.totalAmount).toFixed(2)} | Expected Total: ${expectedTotal.toFixed(2)}`);
    console.log(`Expected Tax Amount: ${expectedTaxAmount.toFixed(2)} (taxRate ${taxRate.toFixed(2)}%)`);
    console.log(`Expected Balance: ${expectedBalance.toFixed(2)}`);

    let jobStatus = 'not_linked';
    let linkedJob = null;
    let expectedJobFinalPrice = taxableBase;
    let jobFinalPriceDelta = 0;

    if (invoice.jobId) {
      linkedJob = await Job.findOne({
        where: { id: invoice.jobId, tenantId },
        attributes: ['id', 'jobNumber', 'finalPrice', 'quotedPrice', 'actualCost', 'status']
      });

      if (!linkedJob) {
        jobStatus = 'missing';
      } else {
        const currentJobFinalPrice = toNumber(linkedJob.finalPrice);
        jobFinalPriceDelta = expectedJobFinalPrice - currentJobFinalPrice;
        jobStatus = Math.abs(jobFinalPriceDelta) < 0.01 ? 'ok' : 'mismatch';
      }
    }

    console.log('\n=== Job Link Verification ===');
    if (!invoice.jobId) {
      console.log('Invoice is not linked to a job.');
    } else if (!linkedJob) {
      console.log(`Linked job not found for jobId: ${invoice.jobId}`);
    } else {
      console.log(`Job Number: ${linkedJob.jobNumber || linkedJob.id}`);
      console.log(`Current job.finalPrice: ${toNumber(linkedJob.finalPrice).toFixed(2)}`);
      console.log(`Expected job.finalPrice: ${expectedJobFinalPrice.toFixed(2)}`);
      console.log(`Delta: ${jobFinalPriceDelta.toFixed(2)} | Status: ${jobStatus}`);
    }
    console.log('\n=== Accounting Verification (posted net across invoice_revenue + invoice_revenue_reconcile) ===');
    console.log(`Revenue journal status: ${accountingStatus}`);
    console.log(`Posted revenue journals found: ${postedRevenueJournals.length}`);
    console.log(`Expected AR debit: ${expectedArDebit.toFixed(2)} | Actual AR debit: ${actualArDebit.toFixed(2)} | Delta: ${arDelta.toFixed(2)}`);
    console.log(`Expected Revenue credit: ${expectedRevenue.toFixed(2)} | Actual Revenue credit: ${actualRevenueCredit.toFixed(2)} | Delta: ${revenueDelta.toFixed(2)}`);
    console.log(`Expected VAT credit: ${expectedVatCredit.toFixed(2)} | Actual VAT credit: ${actualVatCredit.toFixed(2)} | Delta: ${vatDelta.toFixed(2)}`);

    const jobMismatch = jobStatus === 'mismatch' || jobStatus === 'missing';

    if (invoiceDataOk && !accountingMismatch && !jobMismatch) {
      console.log('\n✅ Verification passed. Invoice, accounting, and job link data are consistent.');
      process.exit(0);
    }

    console.log('\n⚠️ Verification failed. At least one value is inconsistent.');
    if (!shouldApplyFix && !shouldSyncAccounting && !shouldSyncJob) {
      console.log('Run again with --fix=true and/or --syncAccounting=true and/or --syncJob=true to apply corrections.');
      process.exit(2);
    }

    if (shouldApplyFix) {
      await sequelize.transaction(async (transaction) => {
        await invoice.update(
          {
            items: recomputedItems,
            subtotal,
            discountType: 'fixed',
            discountValue: totalLineDiscount,
            discountAmount: totalLineDiscount,
            discountReason: `Line discount repair (${invoiceNumber})`,
            totalAmount: expectedTotal,
            taxAmount: expectedTaxAmount,
            balance: expectedBalance
          },
          { transaction }
        );
      });
      console.log('\n✅ Invoice values repaired.');
    }

    if (shouldSyncAccounting && accountingMismatch) {
      if (!arAccount || !revenueAccount) {
        console.error('❌ Cannot sync accounting: required AR/Revenue accounts are missing.');
        process.exit(1);
      }
      if (expectedVatCredit > 0 && !vatAccount) {
        console.error('❌ Cannot sync accounting: VAT payable account is missing.');
        process.exit(1);
      }

      const lines = [];
      if (Math.abs(arDelta) >= 0.01) {
        lines.push({
          accountId: arAccount.id,
          debit: arDelta > 0 ? arDelta : 0,
          credit: arDelta < 0 ? Math.abs(arDelta) : 0,
          description: `AR reconciliation for ${invoiceNumber}`
        });
      }
      if (Math.abs(revenueDelta) >= 0.01) {
        lines.push({
          accountId: revenueAccount.id,
          debit: revenueDelta < 0 ? Math.abs(revenueDelta) : 0,
          credit: revenueDelta > 0 ? revenueDelta : 0,
          description: `Revenue reconciliation for ${invoiceNumber}`
        });
      }
      if (Math.abs(vatDelta) >= 0.01 && vatAccount) {
        lines.push({
          accountId: vatAccount.id,
          debit: vatDelta < 0 ? Math.abs(vatDelta) : 0,
          credit: vatDelta > 0 ? vatDelta : 0,
          description: `VAT reconciliation for ${invoiceNumber}`
        });
      }

      const totalDebit = lines.reduce((sum, line) => sum + toNumber(line.debit), 0);
      const totalCredit = lines.reduce((sum, line) => sum + toNumber(line.credit), 0);
      if (Math.abs(totalDebit - totalCredit) >= 0.01) {
        console.error('❌ Reconciliation lines are not balanced. Aborting accounting sync.');
        process.exit(1);
      }

      if (lines.length >= 2) {
        await accountingService.createJournalEntry({
          tenantId,
          reference: `INV-RECON-${invoiceNumber}`,
          description: `Invoice accounting reconciliation for ${invoiceNumber}`,
          entryDate: new Date(),
          status: 'posted',
          source: 'invoice_revenue_reconcile',
          sourceId: invoice.id,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber,
            arDelta,
            revenueDelta,
            vatDelta
          },
          lines
        });
        console.log('✅ Accounting reconciliation journal posted.');
      } else {
        console.log('ℹ️ No accounting reconciliation lines needed.');
      }
    }

    if (shouldSyncJob && linkedJob && Math.abs(jobFinalPriceDelta) >= 0.01) {
      await linkedJob.update({
        finalPrice: expectedJobFinalPrice
      });
      console.log('✅ Job finalPrice synchronized with invoice net amount.');
    }

    const freshInvoice = await Invoice.findByPk(invoice.id);
    console.log('\n✅ Completed.');
    console.log(`Updated discountValue: ${toNumber(freshInvoice.discountValue).toFixed(2)}`);
    console.log(`Updated totalAmount: ${toNumber(freshInvoice.totalAmount).toFixed(2)}`);
    console.log(`Updated balance: ${toNumber(freshInvoice.balance).toFixed(2)}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
