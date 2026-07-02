#!/usr/bin/env node
/**
 * Import Bravo Thrybe catalog using parent + variant products.
 *
 * Confirmed decisions:
 * - Tenant resolved by --email
 * - Main/default shop target (or the only shop)
 * - Parent + variant structure for t-shirts
 * - Price defaults to 100 (cost + selling)
 * - Quantity defaults to 1
 * - Caps is a simple product (no variants)
 * - Heatpress Machine excluded
 *
 * Usage (from Backend/):
 *   # Parse-only (default behavior)
 *   node scripts/import-bravo-thrybe-products.js --email gilbertceyram@gmail.com
 *
 *   # Parse-only with explicit tenant/shop filters
 *   node scripts/import-bravo-thrybe-products.js --email gilbertceyram@gmail.com --tenant-name "Bravo Thrybe" --shop-name "Main Shop"
 *
 *   # Execute write import (requires explicit confirmation)
 *   node scripts/import-bravo-thrybe-products.js --email gilbertceyram@gmail.com --execute --confirm-import
 */
require('dotenv').config();

const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const {
  User,
  UserTenant,
  Tenant,
  Shop,
  Product,
  ProductVariant,
} = require('../models');
const { syncParentQuantityFromVariants } = require('../utils/productStockUtils');

const SCRIPT_NAME = 'scripts/import-bravo-thrybe-products.js';
const DEFAULT_PRICE = 100;
const DEFAULT_QUANTITY = 1;
const SAMPLE_LIMIT = 12;

const argv = process.argv.slice(2);
const hasFlag = (flag) => argv.includes(flag);
const getArgValue = (flag, fallback = null) => {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
};

const VALUE_FLAGS = new Set(['--email', '--tenant-name', '--shop-name']);
const BOOLEAN_FLAGS = new Set(['--parse-only', '--execute', '--confirm-import', '--help', '-h']);

const email = normalizeEmail(getArgValue('--email', ''));
const tenantNameFilter = normalizeText(getArgValue('--tenant-name', '')) || null;
const shopNameFilter = normalizeText(getArgValue('--shop-name', '')) || null;
const isExecute = hasFlag('--execute');
const isParseOnly = hasFlag('--parse-only') || !isExecute;
const shouldConfirm = hasFlag('--confirm-import');

const USAGE = `
Usage:
  node scripts/import-bravo-thrybe-products.js --email <user-email> [--tenant-name <name>] [--shop-name <name>] [--parse-only] [--execute --confirm-import]

Examples:
  node scripts/import-bravo-thrybe-products.js --email gilbertceyram@gmail.com
  node scripts/import-bravo-thrybe-products.js --email gilbertceyram@gmail.com --tenant-name "Bravo Thrybe" --shop-name "Main Shop"
  node scripts/import-bravo-thrybe-products.js --email gilbertceyram@gmail.com --execute --confirm-import
`;

/**
 * Variant matrix for t-shirt parents (from BRAVO THRYBE daily sales sheet).
 * Each parent defines its own sizes and colors.
 */
const T_SHIRT_MATRIX = {
  parents: [
    {
      name: 'Bravo Thrybe T-Shirt — 350 GSM',
      skuPrefix: 'BT-TS-350',
      sizes: ['Medium', 'Large', 'Extra Large', '2X Large', '3X Large', '4X Large'],
      colors: [
        'Black',
        'White',
        'Cream',
        'Dark Brown',
        'Khaki Brown',
        'Pink',
        'Light Blue',
        'Red',
        'Violet (Purple)',
        'Ash (Grey)',
        'Light Green',
        'Green',
      ],
    },
    {
      name: 'Bravo Thrybe T-Shirt — 320 GSM',
      skuPrefix: 'BT-TS-320',
      sizes: ['Medium', 'Large', 'Extra Large', '2X Large'],
      colors: ['Black', 'White', 'Cream', 'Brown', 'Grey', 'Pink'],
    },
    {
      name: 'Bravo Thrybe T-Shirt — 230 GSM',
      skuPrefix: 'BT-TS-230',
      sizes: ['Large', 'Extra Large', '2X Large', '3X Large', '4X Large'],
      colors: ['Black', 'White', 'Cream', 'Blue', 'Green', 'Khaki', 'Pink', 'Wine'],
    },
    {
      name: 'Bravo Thrybe Acid Wash T-Shirt',
      skuPrefix: 'BT-TS-AW',
      sizes: ['Medium', 'Large', 'Extra Large', '2X Large'],
      colors: ['Pink', 'Blue', 'Black', 'Grey', 'Brown', 'Army Green'],
    },
  ],
};

const SIMPLE_PRODUCTS = [
  {
    name: 'Bravo Thrybe Caps',
    sku: 'BT-CAPS',
    hasVariants: false,
  },
];

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
  if (!email) fail('--email is required');
  if (isExecute && !shouldConfirm) fail('Execute mode requires --confirm-import');
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

function slugifyToken(value) {
  return normalizeText(value).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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

function buildImportPlan() {
  const parentProducts = [
    ...T_SHIRT_MATRIX.parents.map((parent) => ({
      type: 'parent',
      name: parent.name,
      sku: parent.skuPrefix,
      hasVariants: true,
      sellingPrice: DEFAULT_PRICE,
      costPrice: DEFAULT_PRICE,
      quantityOnHand: DEFAULT_QUANTITY,
      trackStock: true,
      unit: 'pcs',
      variantConfig: parent,
    })),
    ...SIMPLE_PRODUCTS.map((simple) => ({
      type: 'simple',
      name: simple.name,
      sku: simple.sku,
      hasVariants: false,
      sellingPrice: DEFAULT_PRICE,
      costPrice: DEFAULT_PRICE,
      quantityOnHand: DEFAULT_QUANTITY,
      trackStock: true,
      unit: 'pcs',
      variantConfig: null,
    })),
  ];

  const variants = [];
  for (const parent of T_SHIRT_MATRIX.parents) {
    for (const size of parent.sizes) {
      for (const color of parent.colors) {
        const sku = `${parent.skuPrefix}-${slugifyToken(size)}-${slugifyToken(color)}`;
        variants.push({
          parentName: parent.name,
          name: `${size} / ${color}`,
          sku,
          attributes: { size, color },
          sellingPrice: DEFAULT_PRICE,
          costPrice: DEFAULT_PRICE,
          quantityOnHand: DEFAULT_QUANTITY,
          trackStock: true,
          isActive: true,
        });
      }
    }
  }

  return { parentProducts, variants };
}

async function resolveTenantByEmail(targetEmail, targetTenantName) {
  const user = await User.findOne({
    where: { email: targetEmail },
    attributes: ['id', 'email', 'name'],
  });
  if (!user) fail(`No user found for email: ${targetEmail}`);

  const memberships = await UserTenant.findAll({
    where: {
      userId: user.id,
      status: { [Op.in]: ['active', 'invited'] },
    },
    include: [{
      model: Tenant,
      as: 'tenant',
      attributes: ['id', 'name', 'slug', 'status', 'businessType'],
    }],
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });

  let matches = memberships.filter((membership) => membership.tenant);
  if (targetTenantName) {
    matches = matches.filter(
      (membership) => normalizedKey(membership.tenant.name) === normalizedKey(targetTenantName)
    );
  }

  if (!matches.length) {
    fail(`No tenant membership found for ${targetEmail}${targetTenantName ? ` with tenant "${targetTenantName}"` : ''}`);
  }

  if (matches.length > 1) {
    console.error('\nUser belongs to multiple matching tenants. Re-run with --tenant-name to disambiguate:');
    matches.forEach((membership) => {
      console.error(`- ${membership.tenant.id} (${membership.tenant.name}) slug=${membership.tenant.slug || 'none'}`);
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

async function resolveShop(tenantId, targetShopName) {
  const shops = await Shop.findAll({
    where: { tenantId },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });
  if (!shops.length) fail(`No shops found for tenant ${tenantId}`);

  if (targetShopName) {
    const key = normalizedKey(targetShopName);
    const exactMatches = shops.filter((shop) => normalizedKey(shop.name) === key);
    const partialMatches = shops.filter((shop) => normalizedKey(shop.name).includes(key));
    const matches = exactMatches.length ? exactMatches : partialMatches;
    if (!matches.length) fail(`No shop matching "${targetShopName}" found for tenant ${tenantId}`);
    if (matches.length > 1) {
      console.error(`\nMultiple shops matched "${targetShopName}". Re-run with a more precise --shop-name:`);
      matches.forEach((shop) => console.error(`- ${shop.id} (${shop.name})${shop.isDefault ? ' default' : ''}`));
      process.exit(1);
    }
    return matches[0];
  }

  if (shops.length === 1) return shops[0];
  const defaultShops = shops.filter((shop) => shop.isDefault);
  if (defaultShops.length === 1) return defaultShops[0];

  console.error('\nUnable to auto-select shop. Pass --shop-name. Available shops:');
  shops.forEach((shop) => console.error(`- ${shop.id} (${shop.name})${shop.isDefault ? ' default' : ''}`));
  process.exit(1);
}

async function loadExistingProducts(tenantId, shopId, plannedParents) {
  const parentNames = plannedParents.map((entry) => entry.name);
  const products = await Product.findAll({
    where: {
      tenantId,
      shopId,
      name: { [Op.in]: parentNames },
    },
  });
  const byName = new Map();
  products.forEach((product) => byName.set(normalizedKey(product.name), product));
  return byName;
}

async function loadExistingVariantsByParent(parentProductIds) {
  if (!parentProductIds.length) return new Map();
  const variants = await ProductVariant.findAll({
    where: { productId: { [Op.in]: parentProductIds } },
  });
  const grouped = new Map();
  for (const variant of variants) {
    if (!grouped.has(variant.productId)) grouped.set(variant.productId, new Map());
    grouped.get(variant.productId).set(normalizedKey(variant.sku || ''), variant);
  }
  return grouped;
}

async function upsertParentProduct({ tenantId, shopId, parentPlan, existingProduct, transaction }) {
  const payload = {
    tenantId,
    shopId,
    name: parentPlan.name,
    sku: parentPlan.sku,
    barcode: parentPlan.sku,
    description: parentPlan.name,
    categoryId: null,
    costPrice: parentPlan.costPrice,
    sellingPrice: parentPlan.sellingPrice,
    quantityOnHand: parentPlan.quantityOnHand,
    reorderLevel: 0,
    reorderQuantity: 0,
    unit: parentPlan.unit,
    isActive: true,
    trackStock: parentPlan.trackStock,
    hasVariants: parentPlan.hasVariants,
    metadata: {
      importSource: 'bravo-thrybe-catalog',
      importedByScript: SCRIPT_NAME,
      parentType: parentPlan.type,
    },
  };

  if (!existingProduct) {
    return Product.create(payload, { transaction, validate: true });
  }

  await existingProduct.update(payload, { transaction, validate: true });
  return existingProduct;
}

async function upsertVariant({ parentProductId, variantPlan, existingVariant, transaction }) {
  const payload = {
    productId: parentProductId,
    name: variantPlan.name,
    sku: variantPlan.sku,
    barcode: variantPlan.sku,
    costPrice: variantPlan.costPrice,
    sellingPrice: variantPlan.sellingPrice,
    quantityOnHand: variantPlan.quantityOnHand,
    attributes: variantPlan.attributes,
    isActive: true,
    trackStock: true,
    metadata: {
      importSource: 'bravo-thrybe-catalog',
      importedByScript: SCRIPT_NAME,
    },
  };

  if (!existingVariant) {
    return ProductVariant.create(payload, { transaction, validate: true });
  }

  await existingVariant.update(payload, { transaction, validate: true });
  return existingVariant;
}

async function main() {
  validateArgs();

  const { parentProducts, variants } = buildImportPlan();
  const simpleProductsCount = parentProducts.filter((entry) => entry.type === 'simple').length;
  const variantParentCount = parentProducts.filter((entry) => entry.type === 'parent').length;

  console.log('\n=== Bravo Thrybe Product Import ===');
  printSummary('Mode', isParseOnly ? 'PARSE ONLY' : 'EXECUTE');
  printSummary('Email', email);
  if (tenantNameFilter) printSummary('Tenant name filter', tenantNameFilter);
  if (shopNameFilter) printSummary('Shop name filter', shopNameFilter);
  printSummary('Default price', `${DEFAULT_PRICE}`);
  printSummary('Default quantity', `${DEFAULT_QUANTITY}`);
  printSummary('Variant parents', variantParentCount);
  printSummary('Simple products', simpleProductsCount);
  printSummary('Variants', variants.length);

  printRows('Parent products preview', parentProducts, (row) => (
    `${row.name} [sku=${row.sku}] hasVariants=${row.hasVariants} price=${row.sellingPrice} qty=${row.quantityOnHand}`
  ));
  printRows('Variant preview', variants, (row) => (
    `${row.parentName} -> ${row.name} [sku=${row.sku}]`
  ));

  if (isParseOnly) {
    console.log('\nParse-only complete. No database connection attempted.');
    return;
  }

  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required for execute mode');
  await testConnection();

  const { user, tenant, tenantId, membershipRole } = await resolveTenantByEmail(email, tenantNameFilter);
  const shop = await resolveShop(tenantId, shopNameFilter);

  console.log('\nTarget:');
  printSummary('User', `${user.name || 'Unknown'} <${user.email}>`);
  printSummary('Tenant', `${tenant?.name || 'Unknown'} (${tenantId})`);
  printSummary('Tenant status', tenant?.status || 'unknown');
  if (membershipRole) printSummary('Membership role', membershipRole);
  printSummary('Shop', `${shop.name} (${shop.id})`);

  const existingByName = await loadExistingProducts(tenantId, shop.id, parentProducts);
  const parentIds = Array.from(existingByName.values()).map((product) => product.id);
  const existingVariantsByParent = await loadExistingVariantsByParent(parentIds);

  const transaction = await sequelize.transaction();
  try {
    let createdParents = 0;
    let updatedParents = 0;
    let createdVariants = 0;
    let updatedVariants = 0;

    const parentIdByName = new Map();

    for (const parentPlan of parentProducts) {
      const existingProduct = existingByName.get(normalizedKey(parentPlan.name));
      const savedParent = await upsertParentProduct({
        tenantId,
        shopId: shop.id,
        parentPlan,
        existingProduct,
        transaction,
      });
      parentIdByName.set(normalizedKey(parentPlan.name), savedParent.id);
      if (existingProduct) updatedParents += 1;
      else createdParents += 1;
    }

    for (const variantPlan of variants) {
      const parentId = parentIdByName.get(normalizedKey(variantPlan.parentName));
      if (!parentId) {
        throw new Error(`Missing parent product for variant parent "${variantPlan.parentName}"`);
      }

      const existingForParent = existingVariantsByParent.get(parentId) || new Map();
      const existingVariant = existingForParent.get(normalizedKey(variantPlan.sku));
      await upsertVariant({
        parentProductId: parentId,
        variantPlan,
        existingVariant,
        transaction,
      });

      if (existingVariant) updatedVariants += 1;
      else createdVariants += 1;
    }

    for (const parentPlan of parentProducts) {
      if (!parentPlan.hasVariants) continue;
      const parentId = parentIdByName.get(normalizedKey(parentPlan.name));
      if (parentId) {
        await syncParentQuantityFromVariants(parentId, transaction);
      }
    }

    await transaction.commit();
    console.log('\nImport completed.');
    printSummary('Created parent/simple products', createdParents);
    printSummary('Updated parent/simple products', updatedParents);
    printSummary('Created variants', createdVariants);
    printSummary('Updated variants', updatedVariants);
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
