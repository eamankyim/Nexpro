#!/usr/bin/env node
/**
 * Safely import an API-shaped products CSV into one tenant.
 *
 * Safety model:
 * - Dry run by default
 * - Requires --execute and --confirm-import for real writes
 * - Resolves an existing tenant by --email or --tenant-id
 * - Parses with utils/importParse.js, matching the API importer columns
 * - Creates missing categories by name only during execute
 * - Skips existing products and duplicate SKU/barcode conflicts
 * - Optional --shop-name or --shop-id targets an existing shop instead of the default shop
 *
 * Usage (from Backend/):
 *   npm run import:products-csv -- --email raphine19@gmail.com --source scripts/data/josfaa-products-for-raphine19.csv
 *   npm run import:products-csv -- --email raphine19@gmail.com --source scripts/data/josfaa-products-for-raphine19.csv --shop-name warehouse
 *
 *   npm run import:products-csv -- \
 *     --email raphine19@gmail.com \
 *     --source scripts/data/josfaa-products-for-raphine19.csv \
 *     --shop-name warehouse \
 *     --execute --confirm-import
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { parseImportFile } = require('../utils/importParse');
const { ensureDefaultShop } = require('../utils/shopUtils');
const { User, UserTenant, Tenant, Product, ProductCategory, Shop, Barcode } = require('../models');

const DEFAULT_SOURCE = path.resolve(__dirname, 'data', 'josfaa-products-for-raphine19.csv');
const argv = process.argv.slice(2);

const hasFlag = (flag) => argv.includes(flag);
const getArgValue = (flag, fallback = null) => {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
};

const isExecute = hasFlag('--execute');
const isDryRun = !isExecute;
const shouldConfirm = hasFlag('--confirm-import');
const email = (getArgValue('--email', '') || '').trim().toLowerCase();
const explicitTenantId = (getArgValue('--tenant-id', '') || '').trim() || null;
const explicitShopId = (getArgValue('--shop-id', '') || '').trim() || null;
const explicitShopName = normalizeText(getArgValue('--shop-name', '') || '') || null;
const sourcePath = path.resolve(process.cwd(), getArgValue('--source', DEFAULT_SOURCE));

const USAGE = `
Usage:
  npm run import:products-csv -- --email <user-email> --source <path-to-csv> [--tenant-id <uuid>] [--shop-id <uuid> | --shop-name <name>] [--execute --confirm-import]
  npm run import:products-csv -- --tenant-id <uuid> --source <path-to-csv> [--shop-id <uuid> | --shop-name <name>] [--execute --confirm-import]

Examples:
  npm run import:products-csv -- --email raphine19@gmail.com --source scripts/data/josfaa-products-for-raphine19.csv

  npm run import:products-csv -- --email raphine19@gmail.com --source scripts/data/josfaa-products-for-raphine19.csv --shop-name warehouse

  npm run import:products-csv -- --email raphine19@gmail.com --source scripts/data/josfaa-products-for-raphine19.csv --shop-name warehouse --execute --confirm-import
`;

function fail(message) {
  console.error(`\nERROR: ${message}`);
  console.error(USAGE);
  process.exit(1);
}

function printSummary(label, value) {
  console.log(`${String(label).padEnd(30)} ${value}`);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizedKey(value) {
  return normalizeText(value).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
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
    return { shop, wouldCreateDefaultShop: false };
  }

  if (explicitShopName) {
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

    return { shop: matches[0], wouldCreateDefaultShop: false };
  }

  if (!isDryRun) {
    return { shop: await ensureDefaultShop(tenantId), wouldCreateDefaultShop: false };
  }

  const defaultShop = await Shop.findOne({
    where: { tenantId, isDefault: true },
    order: [['createdAt', 'ASC']],
  });
  if (defaultShop) return { shop: defaultShop, wouldCreateDefaultShop: false };

  const firstShop = await Shop.findOne({
    where: { tenantId },
    order: [['createdAt', 'ASC']],
  });
  if (firstShop) return { shop: firstShop, wouldCreateDefaultShop: false };

  return { shop: null, wouldCreateDefaultShop: true };
}

async function loadMappedRows(filePath) {
  if (!fs.existsSync(filePath)) fail(`Source CSV not found: ${filePath}`);
  const buffer = fs.readFileSync(filePath);
  return parseImportFile(buffer, '.csv', 'products');
}

async function loadCategories(tenantId, names) {
  if (!names.length) return { byName: new Map(), missingNames: [] };

  const categories = await ProductCategory.findAll({
    where: {
      tenantId,
      [Op.or]: names.map((name) => ({ name: { [Op.iLike]: name } })),
    },
    attributes: ['id', 'name'],
    raw: true,
  });
  const byName = new Map(categories.map((category) => [normalizedKey(category.name), category]));
  const missingNames = names.filter((name) => !byName.has(normalizedKey(name)));
  return { byName, missingNames };
}

async function createMissingCategories(tenantId, names, transaction) {
  const categoryMap = new Map();
  for (const name of names) {
    const [category] = await ProductCategory.findOrCreate({
      where: { tenantId, name },
      defaults: {
        tenantId,
        name,
        description: `Imported product category: ${name}`,
        isActive: true,
        metadata: {
          importSource: 'products-csv',
          importedByScript: 'scripts/import-products-csv-for-tenant.js',
        },
      },
      transaction,
    });
    categoryMap.set(normalizedKey(category.name), category);
  }
  return categoryMap;
}

async function findExistingByCodes(tenantId, codes) {
  if (!codes.length) return new Map();

  const products = await Product.findAll({
    where: {
      tenantId,
      [Op.or]: [
        { sku: { [Op.in]: codes } },
        { barcode: { [Op.in]: codes } },
      ],
    },
    attributes: ['id', 'name', 'sku', 'barcode', 'shopId'],
    raw: true,
  });

  const aliases = await Barcode.findAll({
    where: {
      tenantId,
      barcode: { [Op.in]: codes },
    },
    attributes: ['barcode', 'productId', 'productVariantId'],
    raw: true,
  });

  const existingByCode = new Map();
  for (const product of products) {
    if (product.sku) existingByCode.set(product.sku, { type: 'product', product });
    if (product.barcode) existingByCode.set(product.barcode, { type: 'product', product });
  }
  for (const alias of aliases) {
    existingByCode.set(alias.barcode, { type: 'barcode', alias });
  }
  return existingByCode;
}

async function findExistingNoCodeProducts(tenantId, shopId, names) {
  if (!names.length) return new Map();

  const products = await Product.findAll({
    where: {
      tenantId,
      ...(shopId ? { shopId } : {}),
      sku: null,
      barcode: null,
      name: { [Op.in]: names },
    },
    attributes: ['id', 'name', 'shopId'],
    raw: true,
  });

  return new Map(products.map((product) => [product.name, product]));
}

function classifyRows({ mapped, existingByCode, existingNoCodeByName, tenantId, shopId, categoryByName }) {
  const seenCodes = new Map();
  const toCreate = [];
  const skippedExisting = [];
  const skippedDuplicateInput = [];

  mapped.forEach((row, index) => {
    const rowNumber = index + 2;
    const sku = normalizeText(row.sku) || null;
    const barcode = normalizeText(row.barcode) || null;
    const name = normalizeText(row.name);
    const categoryName = normalizeText(row.categoryName);
    const rowCodes = uniqueValues([sku, barcode]);

    const duplicateCode = rowCodes.find((code) => seenCodes.has(code));
    if (duplicateCode) {
      skippedDuplicateInput.push({
        row: rowNumber,
        code: duplicateCode,
        firstRow: seenCodes.get(duplicateCode),
        name,
      });
      return;
    }
    rowCodes.forEach((code) => seenCodes.set(code, rowNumber));

    const existingHit = rowCodes.map((code) => existingByCode.get(code)).find(Boolean);
    const existingNoCode = rowCodes.length === 0 ? existingNoCodeByName.get(name) : null;
    if (existingHit || existingNoCode) {
      skippedExisting.push({
        row: rowNumber,
        name,
        code: rowCodes[0] || null,
        reason: existingHit ? existingHit.type : 'same name without code',
      });
      return;
    }

    const category = categoryName ? categoryByName.get(normalizedKey(categoryName)) : null;
    const reorderLevel = toNumber(row.reorderLevel, 0);
    toCreate.push({
      row: rowNumber,
      data: {
        tenantId,
        shopId: shopId || null,
        name,
        sku,
        barcode,
        description: normalizeText(row.description) || name,
        categoryId: category?.id || null,
        costPrice: toNumber(row.costPrice, 0),
        sellingPrice: toNumber(row.sellingPrice, 0),
        quantityOnHand: toNumber(row.quantityOnHand, 0),
        reorderLevel,
        reorderQuantity: reorderLevel,
        unit: normalizeText(row.unit) || 'pcs',
        brand: categoryName || null,
        isActive: row.isActive !== false,
        trackStock: true,
        hasVariants: false,
        metadata: {
          importSource: 'products-csv',
          importedByScript: 'scripts/import-products-csv-for-tenant.js',
          sourceRow: rowNumber,
          sourceCategory: categoryName || null,
        },
      },
    });
  });

  return { toCreate, skippedExisting, skippedDuplicateInput };
}

async function main() {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required');
  if (!email && !explicitTenantId) fail('Missing --email or --tenant-id');
  if (isExecute && !shouldConfirm) fail('Execute mode requires --confirm-import');

  console.log('\n=== Products CSV Tenant Import ===');
  printSummary('Mode', isDryRun ? 'DRY RUN' : 'EXECUTE');
  printSummary('Source', sourcePath);
  if (email) printSummary('Email', email);
  if (explicitTenantId) printSummary('Tenant override', explicitTenantId);
  if (explicitShopId) printSummary('Shop override', explicitShopId);
  if (explicitShopName) printSummary('Shop name override', explicitShopName);

  await testConnection();

  const { mapped, errors: parseErrors } = await loadMappedRows(sourcePath);
  const { user, tenant, tenantId, membershipRole } = await resolveTenantTarget();
  const { shop, wouldCreateDefaultShop } = await resolveShop(tenantId);
  const shopId = shop?.id || null;

  console.log('\nTarget:');
  if (user) printSummary('User', `${user.name || 'Unknown'} <${user.email}>`);
  printSummary('Tenant', `${tenant?.name || 'Unknown'} (${tenantId})`);
  printSummary('Tenant status', tenant?.status || 'unknown');
  if (membershipRole) printSummary('Membership role', membershipRole);
  printSummary('Shop', shop ? `${shop.name} (${shop.id})` : 'none resolved');
  if (wouldCreateDefaultShop) printSummary('Execute shop action', 'would create default shop');

  if (parseErrors.length) {
    console.log('\nParse errors:');
    parseErrors.slice(0, 20).forEach((error) => {
      console.log(`- row ${error.row}: ${error.message}`);
    });
    if (parseErrors.length > 20) console.log(`... ${parseErrors.length - 20} more parse errors`);
  }

  const categoryNames = uniqueValues(mapped.map((row) => row.categoryName));
  const { byName: existingCategoryByName, missingNames: missingCategoryNames } = await loadCategories(tenantId, categoryNames);
  const inputCodes = uniqueValues(mapped.flatMap((row) => [row.sku, row.barcode]));
  const existingByCode = await findExistingByCodes(tenantId, inputCodes);
  const noCodeNames = uniqueValues(mapped.filter((row) => !normalizeText(row.sku) && !normalizeText(row.barcode)).map((row) => row.name));
  const existingNoCodeByName = await findExistingNoCodeProducts(tenantId, shopId, noCodeNames);

  const { toCreate, skippedExisting, skippedDuplicateInput } = classifyRows({
    mapped,
    existingByCode,
    existingNoCodeByName,
    tenantId,
    shopId,
    categoryByName: existingCategoryByName,
  });

  console.log('\nPlan:');
  printSummary('Parsed valid rows', mapped.length);
  printSummary('Parse error rows', parseErrors.length);
  printSummary('Category names in CSV', categoryNames.length);
  printSummary('Existing categories', existingCategoryByName.size);
  printSummary('Categories to create', missingCategoryNames.length);
  printSummary('Duplicate input rows skipped', skippedDuplicateInput.length);
  printSummary('Existing product rows skipped', skippedExisting.length);
  printSummary('Products to create', toCreate.length);

  if (missingCategoryNames.length) {
    console.log('\nCategories that would be created on execute:');
    missingCategoryNames.slice(0, 20).forEach((name) => console.log(`- ${name}`));
    if (missingCategoryNames.length > 20) console.log(`... ${missingCategoryNames.length - 20} more categories`);
  }

  if (skippedExisting.length) {
    console.log('\nExamples skipped because they already exist:');
    skippedExisting.slice(0, 10).forEach((row) => {
      console.log(`- row ${row.row}: ${row.name}${row.code ? ` (${row.code})` : ''} via ${row.reason}`);
    });
  }

  if (skippedDuplicateInput.length) {
    console.log('\nDuplicate input examples skipped:');
    skippedDuplicateInput.slice(0, 10).forEach((row) => {
      console.log(`- row ${row.row}: ${row.name} code ${row.code} first appeared on row ${row.firstRow}`);
    });
  }

  if (parseErrors.length) {
    fail('CSV has parse errors; no products were imported');
  }

  if (isDryRun) {
    console.log('\nDry run complete. No database changes made.');
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    const createdCategoryByName = await createMissingCategories(tenantId, missingCategoryNames, transaction);
    const categoryByName = new Map([...existingCategoryByName, ...createdCategoryByName]);

    const products = toCreate.map((entry) => {
      const categoryName = normalizedKey(entry.data.brand);
      return {
        ...entry.data,
        categoryId: categoryByName.get(categoryName)?.id || entry.data.categoryId || null,
      };
    });

    if (products.length) {
      await Product.bulkCreate(products, { transaction, validate: true });
    }

    await transaction.commit();
    console.log(`\nImport completed. Created ${products.length} products and ${createdCategoryByName.size} categories.`);
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
    try {
      await sequelize.close();
    } catch (_error) {
      // Ignore close errors during CLI shutdown.
    }
  });
