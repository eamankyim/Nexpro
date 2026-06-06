#!/usr/bin/env node
/**
 * Safely update product cost/selling prices from a CSV for one tenant shop.
 *
 * Safety model:
 * - Dry run by default
 * - Requires --execute and --confirm-update for real writes
 * - Resolves an existing tenant by --email or --tenant-id
 * - Resolves an existing shop by --shop-name or --shop-id
 * - Updates only Product.costPrice and Product.sellingPrice
 * - Does not create products, categories, or stock movements
 *
 * Usage (from Backend/):
 *   node scripts/update-product-prices-csv-for-tenant.js --email raphine19@gmail.com --source scripts/data/josfaa-product-price-updates-for-raphine19.csv --shop-name warehouse
 *
 *   node scripts/update-product-prices-csv-for-tenant.js \
 *     --email raphine19@gmail.com \
 *     --source scripts/data/josfaa-product-price-updates-for-raphine19.csv \
 *     --shop-name warehouse \
 *     --execute --confirm-update
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { parseCSV } = require('../utils/importParse');
const { User, UserTenant, Tenant, Product, Shop, Barcode } = require('../models');

const DEFAULT_SOURCE = path.resolve(__dirname, 'data', 'josfaa-product-price-updates-for-raphine19.csv');
const argv = process.argv.slice(2);

const hasFlag = (flag) => argv.includes(flag);
const getArgValue = (flag, fallback = null) => {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
};

const isExecute = hasFlag('--execute');
const isDryRun = !isExecute;
const shouldConfirm = hasFlag('--confirm-update');
const email = (getArgValue('--email', '') || '').trim().toLowerCase();
const explicitTenantId = (getArgValue('--tenant-id', '') || '').trim() || null;
const explicitShopId = (getArgValue('--shop-id', '') || '').trim() || null;
const explicitShopName = normalizeText(getArgValue('--shop-name', '') || '') || null;
const sourcePath = path.resolve(process.cwd(), getArgValue('--source', DEFAULT_SOURCE));

const USAGE = `
Usage:
  node scripts/update-product-prices-csv-for-tenant.js --email <user-email> --source <path-to-csv> (--shop-id <uuid> | --shop-name <name>) [--tenant-id <uuid>] [--execute --confirm-update]
  node scripts/update-product-prices-csv-for-tenant.js --tenant-id <uuid> --source <path-to-csv> (--shop-id <uuid> | --shop-name <name>) [--execute --confirm-update]

Examples:
  node scripts/update-product-prices-csv-for-tenant.js --email raphine19@gmail.com --source scripts/data/josfaa-product-price-updates-for-raphine19.csv --shop-name warehouse

  node scripts/update-product-prices-csv-for-tenant.js --email raphine19@gmail.com --source scripts/data/josfaa-product-price-updates-for-raphine19.csv --shop-name warehouse --execute --confirm-update
`;

function fail(message) {
  console.error(`\nERROR: ${message}`);
  console.error(USAGE);
  process.exit(1);
}

function printSummary(label, value) {
  console.log(`${String(label).padEnd(32)} ${value}`);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizedKey(value) {
  return normalizeText(value).toLowerCase();
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function toMoney(value) {
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
    .trim();
  if (!cleaned) return null;
  const number = Number(cleaned);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

function valuesEqualMoney(left, right) {
  return toMoney(left) === toMoney(right);
}

function getField(row, names) {
  for (const name of names) {
    if (row[name] != null) return row[name];
  }
  const lowerMap = new Map(Object.entries(row).map(([key, value]) => [normalizedKey(key), value]));
  for (const name of names) {
    const value = lowerMap.get(normalizedKey(name));
    if (value != null) return value;
  }
  return '';
}

function loadPriceRows(filePath) {
  if (!fs.existsSync(filePath)) fail(`Source CSV not found: ${filePath}`);
  const parsed = parseCSV(fs.readFileSync(filePath));
  const rows = [];
  const errors = [];

  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = normalizeText(getField(row, ['Product Name', 'Name', 'Description']));
    const sku = normalizeText(getField(row, ['SKU', 'Part No', 'PART NO.', 'Part No.']));
    const barcode = normalizeText(getField(row, ['Barcode', 'BARCODE']));
    const costPrice = toMoney(getField(row, ['Cost Price', 'costPrice']));
    const sellingPrice = toMoney(getField(row, ['Selling Price', 'sellingPrice']));
    const sourceRow = normalizeText(getField(row, ['Source Row', 'sourceRow']));

    if (!name && !sku && !barcode && costPrice == null && sellingPrice == null) return;
    if (!name) errors.push({ row: rowNumber, message: 'Product Name is required' });
    if (!sku && !barcode && !name) errors.push({ row: rowNumber, message: 'SKU, Barcode, or Product Name is required' });
    if (costPrice == null) errors.push({ row: rowNumber, message: 'Cost Price must be a non-negative number' });
    if (sellingPrice == null) errors.push({ row: rowNumber, message: 'Selling Price must be a non-negative number' });

    rows.push({ rowNumber, sourceRow, name, sku, barcode, costPrice, sellingPrice });
  });

  return { headers: parsed.headers, rows, errors };
}

async function resolveTenantById(tenantId) {
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['id', 'name', 'status', 'businessType'],
    raw: true,
  });
  if (!tenant) fail(`No tenant found for tenantId: ${tenantId}`);
  return { user: null, tenant, tenantId: tenant.id, membershipRole: null };
}

async function resolveTenantByEmail(targetEmail, tenantIdOverride) {
  const user = await User.findOne({
    where: { email: targetEmail },
    attributes: ['id', 'email', 'name'],
    raw: true,
  });
  if (!user) fail(`No user found for email: ${targetEmail}`);

  const memberships = await UserTenant.findAll({
    where: {
      userId: user.id,
      status: { [Op.in]: ['active', 'invited'] },
      ...(tenantIdOverride ? { tenantId: tenantIdOverride } : {}),
    },
    include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name', 'status', 'businessType'] }],
    order: [['createdAt', 'ASC']],
  });

  if (!memberships.length) {
    const suffix = tenantIdOverride ? ` for tenant ${tenantIdOverride}` : '';
    fail(`User ${targetEmail} has no tenant membership${suffix}`);
  }

  if (memberships.length > 1 && !tenantIdOverride) {
    console.error('\nUser belongs to multiple tenants. Re-run with --tenant-id:');
    for (const membership of memberships) {
      console.error(`- ${membership.tenantId} (${membership.tenant?.name || 'Unknown tenant'}) status=${membership.tenant?.status || 'unknown'}`);
    }
    process.exit(1);
  }

  const selected = memberships[0];
  return {
    user,
    tenant: selected.tenant?.toJSON ? selected.tenant.toJSON() : selected.tenant,
    tenantId: selected.tenantId,
    membershipRole: selected.role,
  };
}

async function resolveTenantTarget() {
  if (email) return resolveTenantByEmail(email, explicitTenantId);
  return resolveTenantById(explicitTenantId);
}

async function resolveShop(tenantId) {
  if (explicitShopId) {
    const shop = await Shop.findOne({ where: { id: explicitShopId, tenantId } });
    if (!shop) fail(`No shop ${explicitShopId} found for tenant ${tenantId}`);
    if (explicitShopName && !normalizedKey(shop.name).includes(normalizedKey(explicitShopName))) {
      fail(`Shop ${explicitShopId} (${shop.name}) does not match --shop-name "${explicitShopName}"`);
    }
    return shop;
  }

  if (!explicitShopName) fail('Missing --shop-id or --shop-name');

  const shops = await Shop.findAll({
    where: { tenantId },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });
  const searchName = normalizedKey(explicitShopName);
  const exactMatches = shops.filter((shop) => normalizedKey(shop.name) === searchName);
  const partialMatches = shops.filter((shop) => normalizedKey(shop.name).includes(searchName));
  const matches = exactMatches.length ? exactMatches : partialMatches;

  if (!matches.length) fail(`No shop matching "${explicitShopName}" found for tenant ${tenantId}`);
  if (matches.length > 1) {
    console.error(`\nMultiple shops matched "${explicitShopName}". Re-run with --shop-id:`);
    for (const match of matches) {
      console.error(`- ${match.id} (${match.name})${match.isDefault ? ' default' : ''}`);
    }
    process.exit(1);
  }

  return matches[0];
}

function addCodeMatch(map, conflicts, code, product, source) {
  const key = normalizeText(code);
  if (!key) return;
  const existing = map.get(key);
  if (existing && existing.product.id !== product.id) {
    conflicts.push({
      code: key,
      sources: [existing.source, source],
      products: [existing.product.id, product.id],
    });
    return;
  }
  map.set(key, { product, source });
}

async function loadProductIndexes(tenantId, shopId, rows) {
  const codes = uniqueValues(rows.flatMap((row) => [row.sku, row.barcode]));
  const products = await Product.findAll({
    where: { tenantId, shopId },
    attributes: ['id', 'name', 'sku', 'barcode', 'costPrice', 'sellingPrice', 'shopId'],
    order: [['createdAt', 'ASC']],
  });

  const codeConflicts = [];
  const productsByCode = new Map();
  const productsByName = new Map();
  const duplicateNames = new Set();

  for (const product of products) {
    addCodeMatch(productsByCode, codeConflicts, product.sku, product, 'product.sku');
    addCodeMatch(productsByCode, codeConflicts, product.barcode, product, 'product.barcode');

    const nameKey = normalizedKey(product.name);
    if (!nameKey) continue;
    if (productsByName.has(nameKey)) duplicateNames.add(nameKey);
    productsByName.set(nameKey, product);
  }

  if (codes.length) {
    const aliases = await Barcode.findAll({
      where: {
        tenantId,
        barcode: { [Op.in]: codes },
        productId: { [Op.ne]: null },
      },
      attributes: ['barcode', 'productId'],
      include: [{
        model: Product,
        as: 'product',
        required: true,
        attributes: ['id', 'name', 'sku', 'barcode', 'costPrice', 'sellingPrice', 'shopId'],
        where: { tenantId, shopId },
      }],
    });

    for (const alias of aliases) {
      addCodeMatch(productsByCode, codeConflicts, alias.barcode, alias.product, 'barcode.alias');
    }
  }

  return { products, productsByCode, productsByName, duplicateNames, codeConflicts };
}

function classifyRows(rows, indexes) {
  const seenInputKeys = new Map();
  const duplicateInputRows = [];
  const unmatchedRows = [];
  const ambiguousRows = [];
  const unchangedRows = [];
  const toUpdate = [];

  for (const row of rows) {
    const rowCodes = uniqueValues([row.sku, row.barcode]);
    const inputKey = rowCodes.length ? `code:${rowCodes.join('|')}` : `name:${normalizedKey(row.name)}`;
    if (seenInputKeys.has(inputKey)) {
      duplicateInputRows.push({
        row: row.rowNumber,
        firstRow: seenInputKeys.get(inputKey),
        key: inputKey,
        name: row.name,
      });
      continue;
    }
    seenInputKeys.set(inputKey, row.rowNumber);

    let product = null;
    let matchedBy = null;
    if (rowCodes.length) {
      const codeMatches = rowCodes.map((code) => indexes.productsByCode.get(code)).filter(Boolean);
      const productIds = new Set(codeMatches.map((match) => match.product.id));
      if (productIds.size > 1) {
        ambiguousRows.push({ row: row.rowNumber, name: row.name, reason: 'SKU and barcode matched different products' });
        continue;
      }
      if (codeMatches.length) {
        product = codeMatches[0].product;
        matchedBy = codeMatches[0].source;
      }
    } else {
      const nameKey = normalizedKey(row.name);
      if (indexes.duplicateNames.has(nameKey)) {
        ambiguousRows.push({ row: row.rowNumber, name: row.name, reason: 'multiple products share this name in the shop' });
        continue;
      }
      product = indexes.productsByName.get(nameKey) || null;
      matchedBy = product ? 'product.name' : null;
    }

    if (!product) {
      unmatchedRows.push({ row: row.rowNumber, name: row.name, sku: row.sku, barcode: row.barcode });
      continue;
    }

    const currentCost = toMoney(product.costPrice);
    const currentSelling = toMoney(product.sellingPrice);
    const entry = {
      row,
      product,
      matchedBy,
      currentCost,
      currentSelling,
      nextCost: row.costPrice,
      nextSelling: row.sellingPrice,
    };

    if (valuesEqualMoney(currentCost, row.costPrice) && valuesEqualMoney(currentSelling, row.sellingPrice)) {
      unchangedRows.push(entry);
    } else {
      toUpdate.push(entry);
    }
  }

  return { duplicateInputRows, unmatchedRows, ambiguousRows, unchangedRows, toUpdate };
}

function printRows(label, rows, formatter) {
  if (!rows.length) return;
  console.log(`\n${label}:`);
  rows.slice(0, 12).forEach((row) => console.log(`- ${formatter(row)}`));
  if (rows.length > 12) console.log(`... ${rows.length - 12} more`);
}

async function main() {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required');
  if (!email && !explicitTenantId) fail('Missing --email or --tenant-id');
  if (isExecute && !shouldConfirm) fail('Execute mode requires --confirm-update');

  console.log('\n=== Product Price CSV Tenant Update ===');
  printSummary('Mode', isDryRun ? 'DRY RUN' : 'EXECUTE');
  printSummary('Source', sourcePath);
  if (email) printSummary('Email', email);
  if (explicitTenantId) printSummary('Tenant override', explicitTenantId);
  if (explicitShopId) printSummary('Shop override', explicitShopId);
  if (explicitShopName) printSummary('Shop name override', explicitShopName);

  const { headers, rows, errors } = loadPriceRows(sourcePath);

  console.log('\nCSV:');
  printSummary('Headers', headers.join(', '));
  printSummary('Rows parsed', rows.length);
  printSummary('Parse errors', errors.length);
  printRows('Parse errors', errors, (error) => `row ${error.row}: ${error.message}`);

  if (errors.length) fail('CSV has parse errors; no prices were updated');

  await testConnection();

  const { user, tenant, tenantId, membershipRole } = await resolveTenantTarget();
  const shop = await resolveShop(tenantId);

  console.log('\nTarget:');
  if (user) printSummary('User', `${user.name || 'Unknown'} <${user.email}>`);
  printSummary('Tenant', `${tenant?.name || 'Unknown'} (${tenantId})`);
  printSummary('Tenant status', tenant?.status || 'unknown');
  if (membershipRole) printSummary('Membership role', membershipRole);
  printSummary('Shop', `${shop.name} (${shop.id})`);

  const indexes = await loadProductIndexes(tenantId, shop.id, rows);
  const plan = classifyRows(rows, indexes);
  const blockingCount = indexes.codeConflicts.length
    + plan.duplicateInputRows.length
    + plan.unmatchedRows.length
    + plan.ambiguousRows.length;

  console.log('\nPlan:');
  printSummary('Products in target shop', indexes.products.length);
  printSummary('Code conflicts', indexes.codeConflicts.length);
  printSummary('Duplicate input rows', plan.duplicateInputRows.length);
  printSummary('Ambiguous rows', plan.ambiguousRows.length);
  printSummary('Unmatched rows', plan.unmatchedRows.length);
  printSummary('Rows already up to date', plan.unchangedRows.length);
  printSummary('Products to update', plan.toUpdate.length);

  printRows('Code conflict examples', indexes.codeConflicts, (item) => `${item.code} maps to products ${item.products.join(', ')}`);
  printRows('Duplicate input examples', plan.duplicateInputRows, (row) => `row ${row.row}: ${row.name} duplicates row ${row.firstRow} (${row.key})`);
  printRows('Ambiguous examples', plan.ambiguousRows, (row) => `row ${row.row}: ${row.name} - ${row.reason}`);
  printRows('Unmatched examples', plan.unmatchedRows, (row) => `row ${row.row}: ${row.name}${row.sku ? ` sku=${row.sku}` : ''}${row.barcode ? ` barcode=${row.barcode}` : ''}`);
  printRows('Update examples', plan.toUpdate, (item) => `${item.product.sku || item.product.barcode || item.product.name}: cost ${item.currentCost} -> ${item.nextCost}, sell ${item.currentSelling} -> ${item.nextSelling} via ${item.matchedBy}`);

  if (blockingCount) {
    const message = 'Blocking rows found; no prices were updated';
    if (isExecute) fail(message);
    console.log(`\nDry run warning: ${message}. Resolve these before execute.`);
    return;
  }

  if (isDryRun) {
    console.log('\nDry run complete. No database changes made.');
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    for (const item of plan.toUpdate) {
      await item.product.update({
        costPrice: item.nextCost,
        sellingPrice: item.nextSelling,
      }, { transaction });
    }

    await transaction.commit();
    console.log(`\nPrice update completed. Updated ${plan.toUpdate.length} products.`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('\nPrice update failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (_error) {
      // Ignore close errors during CLI shutdown.
    }
  });
