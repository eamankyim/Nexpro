#!/usr/bin/env node
/**
 * Import Dapong-spintex stock list (Excel) into a tenant shop's products.
 *
 * Excel layout (no header row):
 * - Column A: Product code / SKU (optional)
 * - Column B: Product name
 * - Column C: Stock quantity
 *
 * Product code / invoice display:
 * - Column A SKU is stored on Product.sku and Product.barcode
 * - Also written to the barcodes table (Barcode model) as an alternate barcode
 *   so invoices resolve "Product Code" via documentLineItemUtils (same as other
 *   ABS products that use alternate barcodes / product codes)
 *
 * Safety model:
 * - Dry run by default
 * - Requires --execute and --confirm-import for real writes
 * - Resolves tenant by --tenant-id, --tenant-slug, --tenant-name, or --email
 * - Resolves shop by --shop-id or --shop-name (required unless SHOP_ID env is set)
 * - Skips duplicates by default; use --on-duplicate update to refresh stock
 *
 * Usage (from Backend/):
 *   # Parse/preview only (no database)
 *   node scripts/import-dapong-products.js --parse-only --source "/path/to/Dapong stocks for Sulas.xlsx"
 *
 *   # Dry run against tenant + shop
 *   node scripts/import-dapong-products.js \
 *     --tenant-name "Sulas Enterprise" \
 *     --shop-name "Dapong-spintex" \
 *     --source "/path/to/Dapong stocks for Sulas.xlsx"
 *
 *   # Execute import
 *   node scripts/import-dapong-products.js \
 *     --tenant-name "Sulas Enterprise" \
 *     --shop-name "Dapong-spintex" \
 *     --source "/path/to/Dapong stocks for Sulas.xlsx" \
 *     --execute --confirm-import
 *
 * Env overrides (optional):
 *   DAPONG_IMPORT_TENANT_ID, DAPONG_IMPORT_TENANT_NAME, DAPONG_IMPORT_TENANT_SLUG
 *   DAPONG_IMPORT_SHOP_ID, DAPONG_IMPORT_SHOP_NAME
 *   DAPONG_IMPORT_SOURCE, DAPONG_IMPORT_ON_DUPLICATE=skip|update
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { User, UserTenant, Tenant, Product, Shop, Barcode } = require('../models');

const DEFAULT_TENANT_NAME = process.env.DAPONG_IMPORT_TENANT_NAME || 'Sulas Enterprise';
const DEFAULT_SHOP_NAME = process.env.DAPONG_IMPORT_SHOP_NAME || 'Dapong-spintex';
const DEFAULT_SOURCE = process.env.DAPONG_IMPORT_SOURCE
  || path.resolve('/Users/us/Desktop/Dapong stocks for Sulas.xlsx');

const SAMPLE_LIMIT = 12;
const VALUE_FLAGS = new Set([
  '--email',
  '--tenant-id',
  '--tenant-slug',
  '--tenant-name',
  '--shop-id',
  '--shop-name',
  '--source',
  '--on-duplicate',
]);
const BOOLEAN_FLAGS = new Set([
  '--execute',
  '--confirm-import',
  '--parse-only',
  '--help',
  '-h',
]);

const argv = process.argv.slice(2);

const hasFlag = (flag) => argv.includes(flag);
const getArgValue = (flag, fallback = null) => {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
};

const isExecute = hasFlag('--execute');
const isDryRun = !isExecute;
const isParseOnly = hasFlag('--parse-only');
const shouldConfirm = hasFlag('--confirm-import');
const email = normalizeEmail(getArgValue('--email', ''));
const explicitTenantId = normalizeText(getArgValue('--tenant-id', process.env.DAPONG_IMPORT_TENANT_ID || '')) || null;
const tenantSlug = normalizeText(getArgValue('--tenant-slug', process.env.DAPONG_IMPORT_TENANT_SLUG || '')) || null;
const tenantName = normalizeText(getArgValue('--tenant-name', DEFAULT_TENANT_NAME)) || DEFAULT_TENANT_NAME;
const explicitShopId = normalizeText(getArgValue('--shop-id', process.env.DAPONG_IMPORT_SHOP_ID || '')) || null;
const explicitShopName = normalizeText(getArgValue('--shop-name', DEFAULT_SHOP_NAME)) || DEFAULT_SHOP_NAME;
const onDuplicate = normalizeText(getArgValue('--on-duplicate', process.env.DAPONG_IMPORT_ON_DUPLICATE || 'skip')).toLowerCase();
const sourcePath = path.resolve(process.cwd(), getArgValue('--source', DEFAULT_SOURCE));

const USAGE = `
Usage:
  node scripts/import-dapong-products.js [--parse-only] [--tenant-name <name> | --tenant-slug <slug> | --tenant-id <uuid> | --email <user-email>] [--shop-id <uuid> | --shop-name <name>] [--source <path-to-xlsx>] [--on-duplicate skip|update] [--execute --confirm-import]

Examples:
  node scripts/import-dapong-products.js --parse-only --source "/Users/us/Desktop/Dapong stocks for Sulas.xlsx"

  node scripts/import-dapong-products.js --tenant-name "Sulas Enterprise" --shop-name "Dapong-spintex"

  node scripts/import-dapong-products.js --tenant-name "Sulas Enterprise" --shop-name "Dapong-spintex" --execute --confirm-import
`;

function validateArgs() {
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (VALUE_FLAGS.has(value)) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) fail(`Missing value for ${value}`);
      i += 1;
      continue;
    }
    if (BOOLEAN_FLAGS.has(value)) continue;
    fail(`Unknown argument: ${value}`);
  }

  if (!['skip', 'update'].includes(onDuplicate)) {
    fail('--on-duplicate must be "skip" or "update"');
  }
}

function fail(message) {
  console.error(`\nERROR: ${message}`);
  console.error(USAGE);
  process.exit(1);
}

function printSummary(label, value) {
  console.log(`${String(label).padEnd(34)} ${value}`);
}

function printRows(label, rows, formatter, limit = SAMPLE_LIMIT) {
  if (!rows.length) return;
  console.log(`\n${label}:`);
  rows.slice(0, limit).forEach((row) => console.log(`- ${formatter(row)}`));
  if (rows.length > limit) console.log(`... ${rows.length - limit} more`);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizedKey(value) {
  return normalizeText(value).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isOnlyNumber(value) {
  return /^\d+(\.\d+)?$/.test(normalizeText(value));
}

function formatTenant(tenant) {
  return `${tenant.name} (${tenant.id})`;
}

/**
 * Parse one Excel row from the Dapong stock sheet.
 * @param {number} rowNumber
 * @param {import('exceljs').Row} row
 * @returns {{ row: number, sku: string|null, barcode: string|null, name: string, quantityOnHand: number }|null}
 */
function parseDapongRow(rowNumber, row) {
  const sku = normalizeText(row.getCell(1).value) || null;
  const name = normalizeText(row.getCell(2).value);
  const quantityOnHand = toNumber(row.getCell(3).value, null);

  if (!name || quantityOnHand === null || isOnlyNumber(name)) return null;

  return {
    row: rowNumber,
    sku,
    barcode: sku,
    name,
    quantityOnHand,
  };
}

/**
 * Load and parse the Dapong Excel workbook.
 * @param {string} filePath
 */
async function loadDapongRows(filePath) {
  if (!fs.existsSync(filePath)) fail(`Source file not found: ${filePath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) fail('Workbook has no worksheets');

  const rows = [];
  const skipped = [];

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const parsed = parseDapongRow(rowNumber, worksheet.getRow(rowNumber));
    if (parsed) {
      rows.push(parsed);
      continue;
    }

    const hasAnyValue = [1, 2, 3].some((col) => {
      const value = worksheet.getRow(rowNumber).getCell(col).value;
      return value != null && normalizeText(value) !== '';
    });
    if (hasAnyValue) {
      skipped.push({
        row: rowNumber,
        colA: worksheet.getRow(rowNumber).getCell(1).value,
        colB: worksheet.getRow(rowNumber).getCell(2).value,
        colC: worksheet.getRow(rowNumber).getCell(3).value,
      });
    }
  }

  return {
    sheetName: worksheet.name,
    rowCount: worksheet.rowCount,
    rows,
    skipped,
  };
}

function mergeInputRows(rows) {
  const byCode = new Map();
  const byName = new Map();
  const duplicateInput = [];

  for (const row of rows) {
    if (row.sku) {
      if (byCode.has(row.sku)) {
        const prev = byCode.get(row.sku);
        duplicateInput.push({ code: row.sku, previousRow: prev.row, row: row.row });
        byCode.set(row.sku, {
          ...prev,
          name: prev.name || row.name,
          quantityOnHand: Number(prev.quantityOnHand || 0) + Number(row.quantityOnHand || 0),
        });
      } else {
        byCode.set(row.sku, { ...row });
      }
      continue;
    }

    const nameKey = normalizedKey(row.name);
    if (byName.has(nameKey)) {
      const prev = byName.get(nameKey);
      duplicateInput.push({ name: row.name, previousRow: prev.row, row: row.row });
      byName.set(nameKey, {
        ...prev,
        quantityOnHand: Number(prev.quantityOnHand || 0) + Number(row.quantityOnHand || 0),
      });
    } else {
      byName.set(nameKey, { ...row });
    }
  }

  return {
    merged: [...byCode.values(), ...byName.values()].sort((a, b) => a.row - b.row),
    duplicateInput,
  };
}

async function resolveTenantById(tenantId) {
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['id', 'name', 'slug', 'status', 'businessType'],
  });
  if (!tenant) fail(`No tenant found for tenantId: ${tenantId}`);
  return { user: null, tenant, tenantId: tenant.id, membershipRole: null };
}

async function resolveTenantDirectly() {
  if (explicitTenantId) return resolveTenantById(explicitTenantId);

  const where = {};
  if (tenantSlug) {
    where.slug = { [Op.iLike]: tenantSlug };
  } else if (tenantName) {
    where.name = { [Op.iLike]: tenantName };
  }

  if (!Object.keys(where).length) {
    fail('Provide --tenant-id, --tenant-slug, --tenant-name, or --email.');
  }

  const tenants = await Tenant.findAll({
    where,
    attributes: ['id', 'name', 'slug', 'status', 'businessType'],
    order: [['createdAt', 'ASC']],
  });

  if (!tenants.length) {
    fail(`No tenant found for ${tenantSlug ? `slug "${tenantSlug}"` : `name "${tenantName}"`}`);
  }

  if (tenants.length > 1) {
    console.error('\nMultiple tenants matched. Re-run with --tenant-id:');
    tenants.forEach((tenant) => {
      console.error(`- ${formatTenant(tenant)} slug=${tenant.slug || 'none'} status=${tenant.status || 'unknown'}`);
    });
    process.exit(1);
  }

  return { user: null, tenant: tenants[0], tenantId: tenants[0].id, membershipRole: null };
}

async function resolveTenantByEmail() {
  const user = await User.findOne({
    where: { email },
    attributes: ['id', 'email', 'name'],
  });
  if (!user) fail(`No user found for email: ${email}`);

  const memberships = await UserTenant.findAll({
    where: {
      userId: user.id,
      status: { [Op.in]: ['active', 'invited'] },
      ...(explicitTenantId ? { tenantId: explicitTenantId } : {}),
    },
    include: [{
      model: Tenant,
      as: 'tenant',
      attributes: ['id', 'name', 'slug', 'status', 'businessType'],
    }],
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });

  let matches = memberships.filter((membership) => membership.tenant);

  if (tenantSlug) {
    matches = matches.filter((membership) => normalizedKey(membership.tenant.slug) === normalizedKey(tenantSlug));
  } else if (tenantName) {
    matches = matches.filter((membership) => normalizedKey(membership.tenant.name) === normalizedKey(tenantName));
  }

  if (!matches.length) {
    fail(`No tenant membership found for ${email} with the provided tenant filters.`);
  }

  if (matches.length > 1 && !explicitTenantId) {
    console.error('\nUser belongs to multiple matching tenants. Re-run with --tenant-id:');
    matches.forEach((membership) => {
      console.error(`- ${formatTenant(membership.tenant)} slug=${membership.tenant.slug || 'none'} role=${membership.role}`);
    });
    process.exit(1);
  }

  const selected = matches[0];
  return {
    user,
    tenant: selected.tenant,
    tenantId: selected.tenantId,
    membershipRole: selected.role,
  };
}

async function resolveTenantTarget() {
  if (email) return resolveTenantByEmail();
  return resolveTenantDirectly();
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

  if (!explicitShopName) {
    fail('Provide --shop-name or --shop-id (or DAPONG_IMPORT_SHOP_NAME / DAPONG_IMPORT_SHOP_ID).');
  }

  const shops = await Shop.findAll({
    where: { tenantId },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });

  if (!shops.length) {
    fail(`No shops found for tenant ${tenantId}`);
  }

  const searchName = normalizedKey(explicitShopName);
  const exactMatches = shops.filter((shop) => normalizedKey(shop.name) === searchName);
  const partialMatches = shops.filter((shop) => normalizedKey(shop.name).includes(searchName));
  const matches = exactMatches.length ? exactMatches : partialMatches;

  if (!matches.length) {
    console.error(`\nNo shop matching "${explicitShopName}" found. Available shops:`);
    shops.forEach((shop) => {
      console.error(`- ${shop.id} (${shop.name})${shop.isDefault ? ' default' : ''}`);
    });
    process.exit(1);
  }

  if (matches.length > 1) {
    console.error(`\nMultiple shops matched "${explicitShopName}". Re-run with --shop-id:`);
    matches.forEach((shop) => {
      console.error(`- ${shop.id} (${shop.name})${shop.isDefault ? ' default' : ''}`);
    });
    process.exit(1);
  }

  return matches[0];
}

async function findExistingProducts(tenantId, shopId, rows) {
  const codes = [...new Set(rows.map((row) => row.sku).filter(Boolean))];
  const noCodeNames = [...new Set(rows.filter((row) => !row.sku).map((row) => row.name).filter(Boolean))];

  const existingByCode = new Map();
  if (codes.length) {
    const products = await Product.findAll({
      where: {
        tenantId,
        shopId,
        [Op.or]: [
          { sku: { [Op.in]: codes } },
          { barcode: { [Op.in]: codes } },
        ],
      },
      attributes: ['id', 'name', 'sku', 'barcode', 'quantityOnHand', 'shopId'],
      raw: true,
    });

    for (const product of products) {
      if (product.sku) existingByCode.set(product.sku, product);
      if (product.barcode) existingByCode.set(product.barcode, product);
    }

    const aliases = await Barcode.findAll({
      where: {
        tenantId,
        barcode: { [Op.in]: codes },
      },
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'sku', 'barcode', 'quantityOnHand', 'shopId'],
        where: { shopId },
        required: true,
      }],
      attributes: ['barcode', 'productId'],
    });

    for (const alias of aliases) {
      const product = alias.product?.toJSON ? alias.product.toJSON() : alias.product;
      if (product && alias.barcode) existingByCode.set(alias.barcode, product);
    }
  }

  const existingByName = new Map();
  if (noCodeNames.length) {
    const products = await Product.findAll({
      where: {
        tenantId,
        shopId,
        sku: null,
        barcode: null,
        name: { [Op.in]: noCodeNames },
      },
      attributes: ['id', 'name', 'sku', 'barcode', 'quantityOnHand', 'shopId'],
      raw: true,
    });
    for (const product of products) {
      existingByName.set(normalizedKey(product.name), product);
    }
  }

  return { existingByCode, existingByName };
}

/**
 * Ensure SKU/product code exists as an alternate barcode alias for invoice display.
 * @param {{ tenantId: string, productId: string, productCode: string, transaction: import('sequelize').Transaction }} params
 * @returns {Promise<boolean>} true when an alias row was created or updated
 */
async function ensureProductCodeAlias({ tenantId, productId, productCode, transaction }) {
  const code = normalizeText(productCode);
  if (!code) return false;

  const [record, created] = await Barcode.findOrCreate({
    where: { tenantId, barcode: code },
    defaults: {
      tenantId,
      productId,
      productVariantId: null,
      barcode: code,
      barcodeType: 'other',
      isActive: true,
      metadata: {
        source: 'dapong-stocks-xlsx',
        role: 'alternate',
        importedByScript: 'scripts/import-dapong-products.js',
      },
    },
    transaction,
  });

  if (!created) {
    await record.update({
      productId,
      productVariantId: null,
      isActive: true,
      metadata: {
        ...(record.metadata || {}),
        source: 'dapong-stocks-xlsx',
        role: 'alternate',
        importedByScript: 'scripts/import-dapong-products.js',
      },
    }, { transaction });
  }

  return true;
}

function classifyRows({ rows, existingByCode, existingByName, tenantId, shopId }) {
  const toCreate = [];
  const toUpdate = [];
  const skippedExisting = [];

  for (const row of rows) {
    const existing = row.sku
      ? existingByCode.get(row.sku)
      : existingByName.get(normalizedKey(row.name));

    if (!existing) {
      toCreate.push({
        row: row.row,
        data: {
          tenantId,
          shopId,
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          description: row.sku ? `Product code: ${row.sku}` : row.name,
          categoryId: null,
          costPrice: 0,
          sellingPrice: 0,
          quantityOnHand: row.quantityOnHand,
          reorderLevel: 0,
          reorderQuantity: 0,
          unit: 'pcs',
          isActive: true,
          trackStock: true,
          hasVariants: false,
          metadata: {
            importSource: 'dapong-stocks-xlsx',
            importedByScript: 'scripts/import-dapong-products.js',
            sourceRow: row.row,
            productCode: row.sku || null,
          },
        },
      });
      continue;
    }

    if (onDuplicate === 'update') {
      toUpdate.push({
        row: row.row,
        productId: existing.id,
        previousQuantity: toNumber(existing.quantityOnHand, 0),
        nextQuantity: row.quantityOnHand,
        name: row.name,
        code: row.sku || existing.sku || existing.barcode || null,
        sku: row.sku || null,
      });
      continue;
    }

    skippedExisting.push({
      row: row.row,
      name: row.name,
      code: row.sku || null,
      productId: existing.id,
    });
  }

  return { toCreate, toUpdate, skippedExisting };
}

async function main() {
  validateArgs();

  if (isExecute && !shouldConfirm) fail('Execute mode requires --confirm-import');
  if (isParseOnly && isExecute) fail('--parse-only cannot be combined with --execute');

  console.log('\n=== Dapong Product Import ===');
  printSummary('Mode', isParseOnly ? 'PARSE ONLY' : (isDryRun ? 'DRY RUN' : 'EXECUTE'));
  printSummary('Source', sourcePath);
  printSummary('Duplicate handling', onDuplicate);
  if (!isParseOnly) {
    if (email) printSummary('Email', email);
    if (tenantName) printSummary('Tenant name', tenantName);
    if (tenantSlug) printSummary('Tenant slug', tenantSlug);
    if (explicitTenantId) printSummary('Tenant override', explicitTenantId);
    if (explicitShopName) printSummary('Shop name', explicitShopName);
    if (explicitShopId) printSummary('Shop override', explicitShopId);
  }

  const { sheetName, rowCount, rows, skipped } = await loadDapongRows(sourcePath);
  const { merged, duplicateInput } = mergeInputRows(rows);

  console.log('\nExcel structure:');
  printSummary('Sheet', sheetName);
  printSummary('Worksheet rows', rowCount);
  printSummary('Parsed product rows', rows.length);
  printSummary('Skipped non-product rows', skipped.length);
  printSummary('Rows after merge', merged.length);
  printSummary('Duplicate input rows merged', duplicateInput.length);
  printSummary('Rows with product code', merged.filter((row) => row.sku).length);
  printSummary('Rows without product code', merged.filter((row) => !row.sku).length);
  printSummary('Total stock quantity', merged.reduce((sum, row) => sum + Number(row.quantityOnHand || 0), 0));

  console.log('\nColumn mapping:');
  printSummary('Column A', 'Product code / SKU -> products.sku, products.barcode, barcodes (alias)');
  printSummary('Column B', 'Product name -> products.name');
  printSummary('Column C', 'Stock quantity -> products.quantityOnHand');
  printSummary('Defaults', 'costPrice=0, sellingPrice=0, unit=pcs, trackStock=true');

  printRows('Mapped preview', merged, (row) => {
    const code = row.sku ? ` [${row.sku}]` : '';
    return `row ${row.row}: ${row.name}${code} (qty ${row.quantityOnHand})`;
  });

  if (skipped.length) {
    printRows('Skipped row examples', skipped, (row) => (
      `row ${row.row}: A=${JSON.stringify(row.colA)} B=${JSON.stringify(row.colB)} C=${JSON.stringify(row.colC)}`
    ), 5);
  }

  if (isParseOnly) {
    console.log('\nParse-only complete. No database connection attempted.');
    return;
  }

  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required');
  if (!email && !explicitTenantId && !tenantName && !tenantSlug) {
    fail('Missing --tenant-name, --tenant-slug, --tenant-id, or --email');
  }

  await testConnection();

  const { user, tenant, tenantId, membershipRole } = await resolveTenantTarget();
  const shop = await resolveShop(tenantId);

  console.log('\nTarget:');
  if (user) printSummary('User', `${user.name || 'Unknown'} <${user.email}>`);
  printSummary('Tenant', `${tenant?.name || 'Unknown'} (${tenantId})`);
  printSummary('Tenant status', tenant?.status || 'unknown');
  if (membershipRole) printSummary('Membership role', membershipRole);
  printSummary('Shop', `${shop.name} (${shop.id})`);

  const { existingByCode, existingByName } = await findExistingProducts(tenantId, shop.id, merged);
  const { toCreate, toUpdate, skippedExisting } = classifyRows({
    rows: merged,
    existingByCode,
    existingByName,
    tenantId,
    shopId: shop.id,
  });

  const aliasCreates = toCreate.filter((entry) => entry.data.sku).length;
  const aliasUpdates = toUpdate.filter((entry) => entry.sku).length;

  console.log('\nPlan:');
  printSummary('Products to create', toCreate.length);
  printSummary('Product code aliases to create', aliasCreates);
  printSummary('Products to update', toUpdate.length);
  printSummary('Product code aliases to upsert on update', aliasUpdates);
  printSummary('Existing products skipped', skippedExisting.length);

  printRows('Create preview', toCreate, (entry) => {
    const code = entry.data.sku ? ` [${entry.data.sku}]` : '';
    return `row ${entry.row}: ${entry.data.name}${code} (qty ${entry.data.quantityOnHand})`;
  });

  if (toUpdate.length) {
    printRows('Update preview', toUpdate, (entry) => (
      `row ${entry.row}: ${entry.name}${entry.code ? ` (${entry.code})` : ''} qty ${entry.previousQuantity} -> ${entry.nextQuantity}`
    ));
  }

  if (skippedExisting.length) {
    printRows('Skip-existing preview', skippedExisting, (entry) => (
      `row ${entry.row}: ${entry.name}${entry.code ? ` (${entry.code})` : ''} -> existing ${entry.productId}`
    ));
  }

  if (isDryRun) {
    console.log('\nDry run complete. No database changes made.');
    console.log('To import for real, re-run with --execute --confirm-import');
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    let createdProducts = 0;
    let createdAliases = 0;

    for (const entry of toCreate) {
      const product = await Product.create(entry.data, { transaction, validate: true });
      createdProducts += 1;

      if (entry.data.sku) {
        const aliased = await ensureProductCodeAlias({
          tenantId,
          productId: product.id,
          productCode: entry.data.sku,
          transaction,
        });
        if (aliased) createdAliases += 1;
      }
    }

    let updatedProducts = 0;
    let updatedAliases = 0;

    for (const entry of toUpdate) {
      const updates = { quantityOnHand: entry.nextQuantity };
      if (entry.sku) {
        updates.sku = entry.sku;
        updates.barcode = entry.sku;
      }

      await Product.update(
        updates,
        { where: { id: entry.productId, tenantId, shopId: shop.id }, transaction }
      );
      updatedProducts += 1;

      if (entry.sku) {
        const aliased = await ensureProductCodeAlias({
          tenantId,
          productId: entry.productId,
          productCode: entry.sku,
          transaction,
        });
        if (aliased) updatedAliases += 1;
      }
    }

    await transaction.commit();
    console.log(
      `\nImport completed. Created ${createdProducts} products (${createdAliases} product code aliases), `
      + `updated ${updatedProducts} products (${updatedAliases} product code aliases upserted).`
    );
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('\nImport failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!isParseOnly) {
      try {
        await sequelize.close();
      } catch (_error) {
        // Ignore close errors during CLI shutdown.
      }
    }
  });
