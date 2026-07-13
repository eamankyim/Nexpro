/**
 * Read-only audit of product cost coverage and COGS visibility.
 *
 * Context: product cost is no longer pushed into Expense rows. Instead,
 * COGS (cost of goods sold) is derived live at query time from
 * Product.costPrice / ProductVariant.costPrice, joined against sale_items,
 * exactly like saleAccountingService.createSaleCogsJournal and the
 * dashboard/report COGS queries do:
 *   COGS = SUM(sale_items.quantity * COALESCE(variant.costPrice, product.costPrice, 0))
 *   (excluding lines whose product has trackStock = false)
 *
 * Product.costPrice is NOT NULL with a default of 0, and sale_items has no
 * unitCost/costPrice column and never did — historical sale lines were never
 * snapshotted with a cost. That means:
 *   - There is nothing to "backfill" onto sale_items without adding a new
 *     column, and doing so would not be more accurate than the existing
 *     live join (it would just freeze today's cost onto old rows).
 *   - The only real gap is products/variants that still have costPrice = 0
 *     ("uncosted") — for those, COGS (and therefore profit) silently shows
 *     as if the item cost nothing.
 *
 * This script reports, per tenant:
 *   1. How many products/variants have costPrice = 0 vs > 0.
 *   2. COGS coverage for sales in a date range: revenue, computed COGS, and
 *      how many sale lines are "uncosted" (product exists, is stocked, but
 *      costPrice = 0) so gross margin is understated for those lines.
 *   3. (optional, --backfill-from-expenses) A best-effort, REPORT-ONLY
 *      comparison against the legacy auto-created product-cost Expense rows
 *      (see delete-product-cost-expenses.js). Those rows never stored a
 *      productId — only a product NAME baked into the description — so any
 *      match here is a fuzzy, exact-name lookup, not a reliable 1:1 link.
 *      This flag NEVER writes to the database; it only prints a comparison
 *      table so a human can decide whether to manually update any
 *      product's costPrice.
 *
 * Usage (from Backend directory):
 *   node scripts/audit-product-cost-coverage.js
 *   node scripts/audit-product-cost-coverage.js --tenant-id <tenant-id>
 *   node scripts/audit-product-cost-coverage.js --start 2026-01-01 --end 2026-06-30
 *   node scripts/audit-product-cost-coverage.js --backfill-from-expenses
 *
 * npm script (Backend/package.json):
 *   npm run audit:product-cost-coverage -- --tenant-id <tenant-id>
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { Expense, Product, Tenant } = require('../models');

const AUTO_EXPENSE_NOTES = 'Created automatically from product cost automation setting.';
const AUTO_EXPENSE_DESCRIPTION_PREFIX = 'Auto-created from product cost:';
const DESCRIPTION_PATTERN = /^Auto-created from product cost: (.+) \(([\d.]+) x ([\d.]+)\)$/;

/** Splits `--flag=value` into separate `--flag`, `value` tokens. */
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
  const args = { backfillFromExpenses: false, sampleSize: 10 };
  const tokens = tokenize(argv);

  for (let i = 0; i < tokens.length; i += 1) {
    const value = tokens[i];
    const next = tokens[i + 1];

    if (value === '--tenant-id') {
      args.tenantId = next;
      i += 1;
    } else if (value === '--start') {
      args.start = next;
      i += 1;
    } else if (value === '--end') {
      args.end = next;
      i += 1;
    } else if (value === '--backfill-from-expenses') {
      args.backfillFromExpenses = true;
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
Read-only audit of product cost coverage and COGS visibility.

Examples:
  node scripts/audit-product-cost-coverage.js
  node scripts/audit-product-cost-coverage.js --tenant-id <tenant-id>
  node scripts/audit-product-cost-coverage.js --start 2026-01-01 --end 2026-06-30
  node scripts/audit-product-cost-coverage.js --backfill-from-expenses

Flags:
  --tenant-id <id>            Limit to a single tenant (default: all tenants)
  --start <date>               COGS coverage range start (default: all-time)
  --end <date>                 COGS coverage range end (default: all-time)
  --backfill-from-expenses     Also print a report-only comparison against legacy
                                auto-created product-cost expenses (name-matched,
                                never writes to the database)
  --sample-size <n>            Rows to print per section (default: 10)

This script never writes to the database.
`);
}

function money(value) {
  return Number.parseFloat(value || 0).toFixed(2);
}

async function loadTenantNames(tenantIds) {
  if (!tenantIds.length) return new Map();
  const tenants = await Tenant.findAll({ where: { id: tenantIds }, attributes: ['id', 'name'] });
  return new Map(tenants.map((t) => [t.id, t.name]));
}

/** Guards against environments where a migration (e.g. sales.deletedAt) hasn't run yet. */
async function columnExists(table, column) {
  const rows = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column LIMIT 1`,
    { replacements: { table, column }, type: sequelize.QueryTypes.SELECT }
  );
  return rows.length > 0;
}

async function reportProductCostCoverage(tenantId) {
  const where = tenantId ? 'WHERE "tenantId" = :tenantId' : '';
  const rows = await sequelize.query(
    `
    SELECT
      "tenantId",
      COUNT(*) as "totalProducts",
      SUM(CASE WHEN "costPrice" > 0 THEN 1 ELSE 0 END) as "withCost",
      SUM(CASE WHEN "costPrice" IS NULL OR "costPrice" = 0 THEN 1 ELSE 0 END) as "withoutCost",
      SUM(CASE WHEN "trackStock" = false THEN 1 ELSE 0 END) as "untracked"
    FROM products
    ${where}
    GROUP BY "tenantId"
    ORDER BY "withoutCost" DESC
    `,
    { replacements: { tenantId }, type: sequelize.QueryTypes.SELECT }
  );

  const tenantNameById = await loadTenantNames(rows.map((r) => r.tenantId));

  console.log('\n=== 1. Product cost coverage (Product.costPrice) ===');
  if (!rows.length) {
    console.log('  No products found.');
    return;
  }
  console.log('  tenant | total products | with cost (>0) | without cost (=0) | trackStock=false');
  for (const r of rows) {
    const name = tenantNameById.get(r.tenantId) || '(unknown tenant)';
    console.log(
      `  ${name} (${r.tenantId}) | ${r.totalProducts} | ${r.withCost} | ${r.withoutCost} | ${r.untracked}`
    );
  }
}

function buildDateClause(alias, start, end) {
  const clauses = [];
  const replacements = {};
  if (start) {
    clauses.push(`${alias}."createdAt" >= :start`);
    replacements.start = start;
  }
  if (end) {
    clauses.push(`${alias}."createdAt" <= :end`);
    replacements.end = end;
  }
  return { sql: clauses.length ? `AND ${clauses.join(' AND ')}` : '', replacements };
}

async function reportCogsCoverage(tenantId, start, end) {
  const dateClause = buildDateClause('s', start, end);
  const where = tenantId ? 'AND s."tenantId" = :tenantId' : '';
  // sales.deletedAt is a recently-added soft-delete column; guard against DBs where the
  // migration hasn't run yet instead of failing the whole audit.
  const hasDeletedAtColumn = await columnExists('sales', 'deletedAt');
  const deletedAtClause = hasDeletedAtColumn ? 'AND s."deletedAt" IS NULL' : '';

  const rows = await sequelize.query(
    `
    SELECT
      s."tenantId",
      COUNT(si.id) as "lineCount",
      COALESCE(SUM(si.quantity * si."unitPrice"), 0) as "grossRevenue",
      COALESCE(SUM(
        CASE WHEN COALESCE(p."trackStock", true) != false
          THEN si.quantity * COALESCE(pv."costPrice", p."costPrice", 0)
          ELSE 0
        END
      ), 0) as "totalCogs",
      SUM(
        CASE WHEN COALESCE(p."trackStock", true) != false
          AND COALESCE(pv."costPrice", p."costPrice", 0) = 0
          AND p.id IS NOT NULL
        THEN 1 ELSE 0 END
      ) as "uncostedLines",
      SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) as "noProductLinkLines"
    FROM sale_items si
    INNER JOIN sales s ON s.id = si."saleId"
    LEFT JOIN products p ON p.id = si."productId"
    LEFT JOIN product_variants pv ON pv.id = si."productVariantId"
    WHERE s.status = 'completed'
      ${deletedAtClause}
      ${where}
      ${dateClause.sql}
    GROUP BY s."tenantId"
    ORDER BY "uncostedLines" DESC
    `,
    {
      replacements: { tenantId, ...dateClause.replacements },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  const tenantNameById = await loadTenantNames(rows.map((r) => r.tenantId));

  console.log('\n=== 2. COGS coverage from completed sales' + (start || end ? ` (${start || 'start'} → ${end || 'now'})` : ' (all-time)') + ' ===');
  if (!rows.length) {
    console.log('  No completed sales found in range.');
    return;
  }
  console.log('  tenant | sale lines | revenue | computed COGS | uncosted lines (cost=0) | lines with no product link');
  for (const r of rows) {
    const name = tenantNameById.get(r.tenantId) || '(unknown tenant)';
    console.log(
      `  ${name} (${r.tenantId}) | ${r.lineCount} | ${money(r.grossRevenue)} | ${money(r.totalCogs)} | ${r.uncostedLines} | ${r.noProductLinkLines}`
    );
  }
  console.log(
    '\n  "Uncosted lines" are sale items for a stocked product whose costPrice is 0 — '
    + 'their margin is overstated because no cost was ever recorded for that product.'
  );
}

async function reportBackfillFromExpensesComparison(tenantId, sampleSize) {
  console.log('\n=== 3. (Report-only) Legacy product-cost expenses vs current Product.costPrice ===');
  console.log('  NOTE: these Expense rows never stored a productId — matching below is by exact');
  console.log('  product NAME within the same tenant, so it is a best-effort hint only. Nothing is');
  console.log('  written to the database by this script.');

  const expenses = await Expense.findAll({
    where: {
      ...(tenantId ? { tenantId } : {}),
      notes: AUTO_EXPENSE_NOTES,
      description: { [Op.like]: `${AUTO_EXPENSE_DESCRIPTION_PREFIX}%` },
    },
    order: [['tenantId', 'ASC'], ['expenseDate', 'ASC']],
  });

  if (!expenses.length) {
    console.log('  No legacy product-cost expenses found.');
    return;
  }

  const parsed = [];
  for (const expense of expenses) {
    const match = expense.description.match(DESCRIPTION_PATTERN);
    if (!match) continue;
    const [, productName, quantityStr, unitCostStr] = match;
    parsed.push({
      tenantId: expense.tenantId,
      expenseNumber: expense.expenseNumber,
      productName,
      impliedQuantity: Number.parseFloat(quantityStr),
      impliedUnitCost: Number.parseFloat(unitCostStr),
    });
  }

  let printed = 0;
  for (const item of parsed) {
    if (printed >= sampleSize) break;
    const candidates = await Product.findAll({
      where: {
        tenantId: item.tenantId,
        name: { [Op.iLike]: item.productName },
      },
      attributes: ['id', 'name', 'costPrice'],
    });

    if (candidates.length === 0) {
      console.log(`  [${item.expenseNumber}] "${item.productName}" — no product with this exact name found (tenant=${item.tenantId})`);
    } else if (candidates.length > 1) {
      console.log(`  [${item.expenseNumber}] "${item.productName}" — ${candidates.length} products share this name; skipping (ambiguous, tenant=${item.tenantId})`);
    } else {
      const product = candidates[0];
      const currentCost = Number.parseFloat(product.costPrice || 0);
      const matchesCurrent = Math.abs(currentCost - item.impliedUnitCost) < 0.01;
      console.log(
        `  [${item.expenseNumber}] "${item.productName}" (product ${product.id}) — expense-implied unit cost ${money(item.impliedUnitCost)} vs current costPrice ${money(currentCost)}${matchesCurrent ? ' (matches)' : ' (DIFFERS)'}`
      );
    }
    printed += 1;
  }

  if (parsed.length > printed) {
    console.log(`  ... ${parsed.length - printed} more legacy expense rows not shown (increase --sample-size to see more)`);
  }
  console.log(
    `\n  Total legacy product-cost expenses parsed: ${parsed.length} / ${expenses.length} matched the expected description format.`
  );
  console.log(
    '  This is informational only — if a product\'s costPrice looks wrong, update it manually'
    + ' via the Products page/API. This script will not change it for you.'
  );
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

  await reportProductCostCoverage(args.tenantId);
  await reportCogsCoverage(args.tenantId, args.start, args.end);

  if (args.backfillFromExpenses) {
    await reportBackfillFromExpensesComparison(args.tenantId, args.sampleSize);
  } else {
    console.log('\n(Pass --backfill-from-expenses to also compare against legacy product-cost expenses.)');
  }

  console.log('\nDone. This script made no changes.');
}

run()
  .catch((error) => {
    console.error('\nError:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
