/**
 * Delete legacy Expense rows that were auto-created from product cost price.
 *
 * Background: productController.createProduct() used to call
 * maybeCreateExpenseFromProductCost() whenever a tenant had the legacy
 * `autoCreateExpenseFromProductCost` setting enabled. That helper created an
 * Expense row with a very specific, unambiguous signature:
 *   - description: "Auto-created from product cost: <name> (<qty> x <unitCost>)"
 *   - notes:       "Created automatically from product cost automation setting."
 * This has been removed — product cost now only flows into COGS at sale time
 * (see saleAccountingService.createSaleCogsJournal / dashboard & report COGS
 * queries), so these Expense rows double-count cost (once as an Expense, once
 * as COGS) and must be cleaned up.
 *
 * Identification is intentionally strict and matches BOTH the exact `notes`
 * text AND the `description` prefix used by the removed code. No other
 * fields (category, amount, etc.) are used to identify rows, so real
 * operating expenses (rent, salaries, ad-hoc "Other" expenses, etc.) can
 * never match, even if manually assigned an "Inventory"/"Materials" category.
 *
 * These rows were created via `Expense.create()` directly (bypassing
 * expenseController.createExpense), so no accounting journal entries
 * (JournalEntry/JournalEntryLine) were ever posted for them — there is
 * nothing to reverse in the accounting ledger.
 *
 * Dry-run is the default and only lists/summarizes matches. Destructive
 * action requires --execute AND --confirm-delete. By default --execute
 * archives matches (isArchived = true), which is reversible and consistent
 * with the app's existing "archive expense" soft-delete feature. Pass
 * --hard-delete to permanently destroy the rows instead (still requires
 * --execute --confirm-delete). A JSON backup of every matched row is always
 * written to disk immediately before any destructive action.
 *
 * Usage (from Backend directory):
 *   node scripts/delete-product-cost-expenses.js
 *   node scripts/delete-product-cost-expenses.js --tenant-id <tenant-id>
 *   node scripts/delete-product-cost-expenses.js --execute --confirm-delete
 *   node scripts/delete-product-cost-expenses.js --tenant-id <tenant-id> --execute --confirm-delete
 *   node scripts/delete-product-cost-expenses.js --execute --confirm-delete --hard-delete
 *
 * npm scripts (Backend/package.json):
 *   npm run cleanup:product-cost-expenses -- --tenant-id <tenant-id>
 *   npm run cleanup:product-cost-expenses -- --execute --confirm-delete
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { Expense, ExpenseActivity, Tenant } = require('../models');

const AUTO_EXPENSE_NOTES = 'Created automatically from product cost automation setting.';
const AUTO_EXPENSE_DESCRIPTION_PREFIX = 'Auto-created from product cost:';

/** Splits `--flag=value` into separate `--flag`, `value` tokens so the rest of the parser only has to handle space-separated flags. */
function tokenize(argv) {
  const tokens = [];
  for (const raw of argv) {
    if (raw.startsWith('--') && raw.includes('=')) {
      const eqIndex = raw.indexOf('=');
      tokens.push(raw.slice(0, eqIndex), raw.slice(eqIndex + 1));
    } else {
      tokens.push(raw);
    }
  }
  return tokens;
}

function parseArgs(argv) {
  const args = {
    execute: false,
    confirmDelete: false,
    hardDelete: false,
    sampleSize: 10,
  };

  const tokens = tokenize(argv);

  for (let i = 0; i < tokens.length; i += 1) {
    const value = tokens[i];
    const next = tokens[i + 1];

    if (value === '--tenant-id') {
      args.tenantId = next;
      i += 1;
    } else if (value === '--execute') {
      args.execute = true;
    } else if (value === '--confirm-delete') {
      args.confirmDelete = true;
    } else if (value === '--hard-delete') {
      args.hardDelete = true;
    } else if (value === '--sample-size') {
      args.sampleSize = Number.parseInt(next, 10) || 10;
      i += 1;
    } else if (value === '--help' || value === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${value}`);
    }
  }

  if (args.tenantId) args.tenantId = String(args.tenantId).trim();

  return args;
}

function printUsage() {
  console.log(`
Delete legacy Expense rows auto-created from product cost price.

Dry-run examples (safe, read-only):
  node scripts/delete-product-cost-expenses.js
  node scripts/delete-product-cost-expenses.js --tenant-id <tenant-id>

Execute examples (soft-delete/archive, reversible):
  node scripts/delete-product-cost-expenses.js --execute --confirm-delete
  node scripts/delete-product-cost-expenses.js --tenant-id <tenant-id> --execute --confirm-delete

Execute with permanent deletion instead of archiving:
  node scripts/delete-product-cost-expenses.js --execute --confirm-delete --hard-delete

Flags:
  --tenant-id <id>   Limit to a single tenant (default: all tenants)
  --execute          Perform the action (default: dry-run only)
  --confirm-delete   Required in addition to --execute to actually change data
  --hard-delete      Permanently destroy matched rows instead of archiving them
  --sample-size <n>  Number of sample rows to print (default: 10)
`);
}

function buildIdentifyWhere(tenantId) {
  return {
    ...(tenantId ? { tenantId } : {}),
    notes: AUTO_EXPENSE_NOTES,
    description: { [Op.like]: `${AUTO_EXPENSE_DESCRIPTION_PREFIX}%` },
  };
}

function money(value) {
  return Number.parseFloat(value || 0).toFixed(2);
}

async function summarizeByTenant(matches) {
  const byTenant = new Map();
  for (const expense of matches) {
    const key = expense.tenantId || 'unknown';
    if (!byTenant.has(key)) {
      byTenant.set(key, { count: 0, total: 0, archivedCount: 0 });
    }
    const entry = byTenant.get(key);
    entry.count += 1;
    entry.total += Number.parseFloat(expense.amount || 0);
    if (expense.isArchived) entry.archivedCount += 1;
  }

  const tenantIds = [...byTenant.keys()].filter((id) => id !== 'unknown');
  const tenants = tenantIds.length
    ? await Tenant.findAll({ where: { id: tenantIds }, attributes: ['id', 'name'] })
    : [];
  const tenantNameById = new Map(tenants.map((t) => [t.id, t.name]));

  return [...byTenant.entries()].map(([tenantId, stats]) => ({
    tenantId,
    tenantName: tenantNameById.get(tenantId) || '(unknown tenant)',
    ...stats,
  }));
}

function printSummary(matches, byTenant, sampleSize) {
  const totalAmount = matches.reduce((sum, e) => sum + Number.parseFloat(e.amount || 0), 0);
  const alreadyArchived = matches.filter((e) => e.isArchived).length;

  console.log('\n--- Match summary ---');
  console.log(`Total matched expenses: ${matches.length}`);
  console.log(`Total amount:           ${money(totalAmount)}`);
  console.log(`Already archived:       ${alreadyArchived}`);

  if (byTenant.length) {
    console.log('\nBy tenant:');
    for (const t of byTenant) {
      console.log(
        `  ${t.tenantName} (${t.tenantId}): ${t.count} rows, total ${money(t.total)}, already archived ${t.archivedCount}`
      );
    }
  }

  if (matches.length) {
    console.log(`\nSample rows (up to ${sampleSize}):`);
    for (const e of matches.slice(0, sampleSize)) {
      console.log(
        `  [${e.expenseNumber}] tenant=${e.tenantId} category=${e.category} amount=${money(e.amount)} date=${e.expenseDate?.toISOString?.().slice(0, 10) || e.expenseDate} archived=${e.isArchived} | ${e.description}`
      );
    }
  }
}

function writeBackup(matches) {
  const backupDir = path.resolve(__dirname, 'data', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(backupDir, `product-cost-expenses-${timestamp}.json`);
  const rows = matches.map((e) => e.toJSON());
  fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
  return filePath;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Load Backend/.env or set DATABASE_URL before running.');
  }

  await testConnection();

  const where = buildIdentifyWhere(args.tenantId);
  const matches = await Expense.findAll({
    where,
    order: [['tenantId', 'ASC'], ['expenseDate', 'ASC']],
  });

  const byTenant = await summarizeByTenant(matches);
  printSummary(matches, byTenant, args.sampleSize);

  if (matches.length === 0) {
    console.log('\nNothing to do.');
    return;
  }

  if (!args.execute) {
    console.log('\nDRY RUN ONLY. No rows were changed.');
    console.log('To archive (soft-delete, reversible), re-run with --execute --confirm-delete.');
    console.log('To permanently delete instead, add --hard-delete as well.');
    return;
  }

  if (!args.confirmDelete) {
    throw new Error('Execution requires --confirm-delete.');
  }

  const backupPath = writeBackup(matches);
  console.log(`\nBackup written: ${backupPath}`);

  const expenseIds = matches.map((e) => e.id);

  await sequelize.transaction(async (transaction) => {
    if (args.hardDelete) {
      const activityCount = await ExpenseActivity.destroy({
        where: { expenseId: expenseIds },
        transaction,
      });
      console.log(`Deleted ${activityCount} related expense_activities`);

      const deletedCount = await Expense.destroy({
        where: { id: expenseIds },
        transaction,
      });
      console.log(`Permanently deleted ${deletedCount} expenses`);
    } else {
      const [archivedCount] = await Expense.update(
        { isArchived: true },
        { where: { id: expenseIds, isArchived: false }, transaction }
      );
      console.log(`Archived ${archivedCount} expenses (isArchived = true)`);
      console.log(`(${matches.length - archivedCount} were already archived and left as-is)`);
    }
  });

  console.log('\nDone.');
}

run()
  .catch((error) => {
    console.error('\nError:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
