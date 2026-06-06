#!/usr/bin/env node
/**
 * Copy products from one tenant shop to another tenant shop.
 *
 * Safety model:
 * - Dry run by default
 * - Requires --execute and --confirm-copy for real writes
 * - Resolves tenants through UserTenant membership by email
 * - Resolves source/target shops under their own tenantId
 * - Skips target duplicates by SKU/barcode/product name unless --update-existing is passed
 * - Does not copy sales, stock movements, invoices, or other transaction history
 *
 * Usage (from Backend/):
 *   npm run copy:products-between-shops -- \
 *     --source-email raphine19@gmail.com \
 *     --source-shop-name warehouse \
 *     --target-email lucvanentgh@gmail.com
 *
 *   npm run copy:products-between-shops -- \
 *     --source-email raphine19@gmail.com \
 *     --source-shop-name warehouse \
 *     --target-email lucvanentgh@gmail.com \
 *     --execute --confirm-copy
 */
require('dotenv').config();

const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { ensureDefaultShop } = require('../utils/shopUtils');
const {
  User,
  UserTenant,
  Tenant,
  Product,
  ProductVariant,
  ProductCategory,
  Shop,
  Barcode,
} = require('../models');

const argv = process.argv.slice(2);

const hasFlag = (flag) => argv.includes(flag);
const getArgValue = (flag, fallback = null) => {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
};

const isExecute = hasFlag('--execute');
const isDryRun = !isExecute;
const shouldConfirm = hasFlag('--confirm-copy');
const updateExisting = hasFlag('--update-existing');
const copyVariants = !hasFlag('--skip-variants');

const sourceEmail = normalizeEmail(getArgValue('--source-email', ''));
const targetEmail = normalizeEmail(getArgValue('--target-email', ''));
const sourceTenantId = normalizeText(getArgValue('--source-tenant-id', '')) || null;
const targetTenantId = normalizeText(getArgValue('--target-tenant-id', '')) || null;
const sourceShopId = normalizeText(getArgValue('--source-shop-id', '')) || null;
const sourceShopName = normalizeText(getArgValue('--source-shop-name', '')) || null;
const targetShopId = normalizeText(getArgValue('--target-shop-id', '')) || null;
const targetShopName = normalizeText(getArgValue('--target-shop-name', '')) || null;

const USAGE = `
Usage:
  npm run copy:products-between-shops -- --source-email <email> (--source-shop-id <uuid> | --source-shop-name <name>) --target-email <email> [--target-shop-id <uuid> | --target-shop-name <name>] [--source-tenant-id <uuid>] [--target-tenant-id <uuid>] [--update-existing] [--skip-variants] [--execute --confirm-copy]

Examples:
  npm run copy:products-between-shops -- --source-email raphine19@gmail.com --source-shop-name warehouse --target-email lucvanentgh@gmail.com

  npm run copy:products-between-shops -- --source-email raphine19@gmail.com --source-shop-name warehouse --target-email lucvanentgh@gmail.com --execute --confirm-copy
`;

function fail(message) {
  console.error(`\nERROR: ${message}`);
  console.error(USAGE);
  process.exit(1);
}

function printSummary(label, value) {
  console.log(`${String(label).padEnd(34)} ${value}`);
}

function printRows(label, rows, formatter, limit = 12) {
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

function uniqueValues(values) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function getPlain(model) {
  return model?.get ? model.get({ plain: true }) : model;
}

function codeList(product) {
  return uniqueValues([product?.sku, product?.barcode]);
}

function productLabel(product) {
  const code = product.sku || product.barcode;
  return `${product.name}${code ? ` (${code})` : ''}`;
}

function sameShopOrLegacy(product, shopId) {
  return product.shopId === shopId || product.shopId == null;
}

async function resolveTenantByEmail(email, tenantIdOverride, label) {
  const user = await User.findOne({
    where: { email },
    attributes: ['id', 'email', 'name'],
    raw: true,
  });
  if (!user) fail(`No ${label} user found for email: ${email}`);

  const memberships = await UserTenant.findAll({
    where: {
      userId: user.id,
      status: { [Op.in]: ['active', 'invited'] },
      ...(tenantIdOverride ? { tenantId: tenantIdOverride } : {}),
    },
    include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name', 'status', 'businessType'] }],
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });

  if (!memberships.length) {
    const suffix = tenantIdOverride ? ` for tenant ${tenantIdOverride}` : '';
    fail(`${label} user ${email} has no tenant membership${suffix}`);
  }

  if (memberships.length > 1 && !tenantIdOverride) {
    console.error(`\n${label} user belongs to multiple tenants. Re-run with --${label}-tenant-id:`);
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

async function resolveNamedShop({ tenantId, shopId, shopName, label }) {
  if (shopId) {
    const shop = await Shop.findOne({ where: { id: shopId, tenantId } });
    if (!shop) fail(`No ${label} shop ${shopId} found for tenant ${tenantId}`);
    if (shopName && !normalizedKey(shop.name).includes(normalizedKey(shopName))) {
      fail(`${label} shop ${shopId} (${shop.name}) does not match --${label}-shop-name "${shopName}"`);
    }
    return { shop, action: 'existing' };
  }

  if (!shopName) fail(`Missing --${label}-shop-id or --${label}-shop-name`);

  const shops = await Shop.findAll({
    where: { tenantId },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });
  const searchName = normalizedKey(shopName);
  const exactMatches = shops.filter((shop) => normalizedKey(shop.name) === searchName);
  const partialMatches = shops.filter((shop) => normalizedKey(shop.name).includes(searchName));
  const matches = exactMatches.length ? exactMatches : partialMatches;

  if (!matches.length) fail(`No ${label} shop matching "${shopName}" found for tenant ${tenantId}`);
  if (matches.length > 1) {
    console.error(`\nMultiple ${label} shops matched "${shopName}". Re-run with --${label}-shop-id:`);
    for (const match of matches) {
      console.error(`- ${match.id} (${match.name})${match.isDefault ? ' default' : ''}`);
    }
    process.exit(1);
  }

  return { shop: matches[0], action: 'existing' };
}

async function resolveTargetShop(tenantId) {
  if (targetShopId || targetShopName) {
    return resolveNamedShop({
      tenantId,
      shopId: targetShopId,
      shopName: targetShopName,
      label: 'target',
    });
  }

  if (!isDryRun) {
    return { shop: await ensureDefaultShop(tenantId), action: 'ensure-default' };
  }

  const defaultShop = await Shop.findOne({
    where: { tenantId, isDefault: true },
    order: [['createdAt', 'ASC']],
  });
  if (defaultShop) return { shop: defaultShop, action: 'existing-default' };

  const firstShop = await Shop.findOne({
    where: { tenantId },
    order: [['createdAt', 'ASC']],
  });
  if (firstShop) return { shop: firstShop, action: 'would-promote-default' };

  return { shop: null, action: 'would-create-default' };
}

async function loadSourceProducts(tenantId, shopId) {
  return Product.findAll({
    where: { tenantId, shopId },
    include: [
      { model: ProductCategory, as: 'category', required: false },
      ...(copyVariants ? [{
        model: ProductVariant,
        as: 'variants',
        required: false,
        order: [['createdAt', 'ASC']],
      }] : []),
      {
        model: Barcode,
        as: 'barcodes',
        required: false,
        where: { isActive: true, productVariantId: null },
      },
    ],
    order: [['createdAt', 'ASC']],
  });
}

async function loadTargetCategories(tenantId, categoryNames) {
  if (!categoryNames.length) return { existingByName: new Map(), missingNames: [] };

  const categories = await ProductCategory.findAll({
    where: {
      tenantId,
      [Op.or]: categoryNames.map((name) => ({ name: { [Op.iLike]: name } })),
    },
  });
  const existingByName = new Map(categories.map((category) => [normalizedKey(category.name), category]));
  const missingNames = categoryNames.filter((name) => !existingByName.has(normalizedKey(name)));
  return { existingByName, missingNames };
}

async function createMissingCategories(tenantId, sourceCategoriesByName, missingNames, transaction) {
  const createdByName = new Map();
  for (const name of missingNames) {
    const sourceCategory = sourceCategoriesByName.get(normalizedKey(name));
    const [category] = await ProductCategory.findOrCreate({
      where: { tenantId, name },
      defaults: {
        tenantId,
        name,
        description: sourceCategory?.description || null,
        businessType: sourceCategory?.businessType || null,
        studioType: sourceCategory?.studioType || null,
        shopType: sourceCategory?.shopType || null,
        isActive: sourceCategory?.isActive !== false,
        metadata: {
          ...(sourceCategory?.metadata || {}),
          copiedByScript: 'scripts/copy-products-between-tenant-shops.js',
          sourceCategoryId: sourceCategory?.id || null,
        },
      },
      transaction,
    });
    createdByName.set(normalizedKey(category.name), category);
  }
  return createdByName;
}

function addCodeEntry(codeIndex, code, entry) {
  const key = normalizeText(code);
  if (!key) return;
  const entries = codeIndex.get(key) || [];
  entries.push(entry);
  codeIndex.set(key, entries);
}

async function loadTargetIndexes(tenantId, shopId) {
  const products = await Product.findAll({
    where: { tenantId },
    attributes: ['id', 'name', 'sku', 'barcode', 'shopId', 'costPrice', 'sellingPrice', 'createdAt'],
    order: [['createdAt', 'ASC']],
  });

  const productsById = new Map(products.map((product) => [product.id, product]));
  const codeIndex = new Map();
  const productsByNameInShop = new Map();

  for (const product of products) {
    addCodeEntry(codeIndex, product.sku, { type: 'product.sku', product });
    addCodeEntry(codeIndex, product.barcode, { type: 'product.barcode', product });

    if (sameShopOrLegacy(product, shopId)) {
      const key = normalizedKey(product.name);
      const matches = productsByNameInShop.get(key) || [];
      matches.push(product);
      productsByNameInShop.set(key, matches);
    }
  }

  const variants = products.length
    ? await ProductVariant.findAll({
      attributes: ['id', 'productId', 'name', 'sku', 'barcode'],
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'shopId'],
        where: { tenantId },
        required: true,
      }],
    })
    : [];

  for (const variant of variants) {
    addCodeEntry(codeIndex, variant.sku, { type: 'variant.sku', variant, product: variant.product });
    addCodeEntry(codeIndex, variant.barcode, { type: 'variant.barcode', variant, product: variant.product });
  }

  const aliases = await Barcode.findAll({
    where: { tenantId, isActive: true },
    attributes: ['barcode', 'productId', 'productVariantId'],
    include: [{
      model: ProductVariant,
      as: 'productVariant',
      attributes: ['id', 'productId'],
      required: false,
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'shopId'],
        required: false,
      }],
    }],
  });

  for (const alias of aliases) {
    const product = alias.productId
      ? productsById.get(alias.productId)
      : alias.productVariant?.product;
    addCodeEntry(codeIndex, alias.barcode, {
      type: alias.productId ? 'barcode.productAlias' : 'barcode.variantAlias',
      alias,
      product,
    });
  }

  return { products, codeIndex, productsByNameInShop };
}

function uniqueProductsFromEntries(entries) {
  const seen = new Set();
  const products = [];
  for (const entry of entries || []) {
    const product = entry.product;
    if (!product?.id || seen.has(product.id)) continue;
    seen.add(product.id);
    products.push(product);
  }
  return products;
}

function findExistingProduct(sourceProduct, indexes, targetShopId) {
  const codes = codeList(sourceProduct);
  const codeEntries = codes.flatMap((code) => indexes.codeIndex.get(code) || []);
  const productCodeEntries = codeEntries.filter((entry) => entry.type.startsWith('product.'));
  const codeProducts = uniqueProductsFromEntries(productCodeEntries);

  if (codeProducts.length === 1) {
    const product = codeProducts[0];
    if (!sameShopOrLegacy(product, targetShopId)) {
      return { status: 'code-other-shop', product, matchedBy: 'sku/barcode' };
    }
    return { status: 'matched', product, matchedBy: 'sku/barcode' };
  }

  if (codeProducts.length > 1) {
    return { status: 'ambiguous', reason: 'SKU/barcode matched multiple target products' };
  }

  if (codeEntries.length) {
    return { status: 'code-conflict', reason: 'SKU/barcode is already used by a target variant or alias' };
  }

  const nameMatches = indexes.productsByNameInShop.get(normalizedKey(sourceProduct.name)) || [];
  if (nameMatches.length === 1) {
    return { status: 'matched', product: nameMatches[0], matchedBy: 'product.name' };
  }
  if (nameMatches.length > 1) {
    return { status: 'ambiguous', reason: 'multiple target products share this name in the target shop' };
  }

  return { status: 'new' };
}

function buildSourceCategoryMaps(sourceProducts) {
  const categoriesByName = new Map();
  const names = [];
  for (const productModel of sourceProducts) {
    const product = getPlain(productModel);
    if (!product.category?.name) continue;
    const name = normalizeText(product.category.name);
    names.push(name);
    if (!categoriesByName.has(normalizedKey(name))) {
      categoriesByName.set(normalizedKey(name), product.category);
    }
  }
  return { categoriesByName, categoryNames: uniqueValues(names) };
}

function categoryIdForProduct(product, categoryByName) {
  const name = product.category?.name;
  if (!name) return null;
  return categoryByName.get(normalizedKey(name))?.id || null;
}

function sourceMetadata(product, sourceTenant, sourceShop) {
  return {
    ...(product.metadata || {}),
    copiedByScript: 'scripts/copy-products-between-tenant-shops.js',
    sourceTenantId: sourceTenant.tenantId,
    sourceShopId: sourceShop.id,
    sourceProductId: product.id,
  };
}

function buildCreatePayload(product, targetTenantIdValue, targetShopIdValue, categoryId, sourceTenant, sourceShop) {
  return {
    tenantId: targetTenantIdValue,
    shopId: targetShopIdValue,
    name: product.name,
    sku: product.sku || null,
    barcode: product.barcode || null,
    description: product.description || null,
    categoryId,
    costPrice: product.costPrice || 0,
    sellingPrice: product.sellingPrice || 0,
    quantityOnHand: product.quantityOnHand || 0,
    reorderLevel: product.reorderLevel || 0,
    reorderQuantity: product.reorderQuantity || 0,
    unit: product.unit || 'pcs',
    brand: product.brand || null,
    supplier: product.supplier || null,
    hasVariants: copyVariants ? Boolean(product.variants?.length || product.hasVariants) : false,
    isActive: product.isActive !== false,
    trackStock: product.trackStock !== false,
    metadata: sourceMetadata(product, sourceTenant, sourceShop),
    imageUrl: product.imageUrl || null,
  };
}

function buildUpdatePayload(product, categoryId, sourceTenant, sourceShop) {
  return {
    name: product.name,
    description: product.description || null,
    categoryId,
    costPrice: product.costPrice || 0,
    sellingPrice: product.sellingPrice || 0,
    quantityOnHand: product.quantityOnHand || 0,
    reorderLevel: product.reorderLevel || 0,
    reorderQuantity: product.reorderQuantity || 0,
    unit: product.unit || 'pcs',
    brand: product.brand || null,
    supplier: product.supplier || null,
    isActive: product.isActive !== false,
    trackStock: product.trackStock !== false,
    metadata: sourceMetadata(product, sourceTenant, sourceShop),
    imageUrl: product.imageUrl || null,
  };
}

function collectAliasBarcodes(product) {
  const primaryBarcode = normalizeText(product.barcode);
  return uniqueValues((product.barcodes || [])
    .map((barcode) => barcode.barcode)
    .filter((barcode) => normalizeText(barcode) !== primaryBarcode));
}

function planCopy({
  sourceProducts,
  indexes,
  categoryByName,
  targetTenantIdValue,
  targetShopIdValue,
  sourceTenant,
  sourceShop,
}) {
  const seenCreateCodes = new Map();
  const toCreate = [];
  const toUpdate = [];
  const skippedExisting = [];
  const skippedConflicts = [];
  const ambiguous = [];
  const variantCodeOmissions = [];
  const aliasCodeOmissions = [];

  for (const productModel of sourceProducts) {
    const product = getPlain(productModel);
    const codes = codeList(product);
    const duplicatePlannedCode = codes.find((code) => seenCreateCodes.has(code));
    if (duplicatePlannedCode) {
      skippedConflicts.push({
        product,
        reason: `source code ${duplicatePlannedCode} also appears on source product ${seenCreateCodes.get(duplicatePlannedCode)}`,
      });
      continue;
    }

    const resolution = findExistingProduct(product, indexes, targetShopIdValue);
    if (resolution.status === 'ambiguous') {
      ambiguous.push({ product, reason: resolution.reason });
      continue;
    }

    if (resolution.status === 'code-conflict' || resolution.status === 'code-other-shop') {
      skippedConflicts.push({
        product,
        reason: resolution.status === 'code-other-shop'
          ? `code already belongs to target product ${resolution.product.id} outside target shop`
          : resolution.reason,
      });
      continue;
    }

    const categoryId = categoryIdForProduct(product, categoryByName);
    if (resolution.status === 'matched') {
      const entry = {
        source: product,
        target: resolution.product,
        matchedBy: resolution.matchedBy,
        payload: buildUpdatePayload(product, categoryId, sourceTenant, sourceShop),
      };
      if (updateExisting) toUpdate.push(entry);
      else skippedExisting.push(entry);
      continue;
    }

    const parentCodes = new Set(codes);
    const aliasBarcodes = collectAliasBarcodes(product);
    const safeAliasBarcodes = [];

    for (const aliasBarcode of aliasBarcodes) {
      if (indexes.codeIndex.has(aliasBarcode) || parentCodes.has(aliasBarcode) || seenCreateCodes.has(aliasBarcode)) {
        aliasCodeOmissions.push({ product, barcode: aliasBarcode, reason: 'already used in target or pending create' });
      } else {
        safeAliasBarcodes.push(aliasBarcode);
      }
    }

    const variants = copyVariants
      ? (product.variants || []).map((variant) => {
        const safeVariant = { ...variant };
        for (const field of ['sku', 'barcode']) {
          const code = normalizeText(safeVariant[field]);
          if (!code) continue;
          if (indexes.codeIndex.has(code) || parentCodes.has(code) || seenCreateCodes.has(code)) {
            variantCodeOmissions.push({
              product,
              variant,
              field,
              code,
              reason: 'already used in target or parent product',
            });
            safeVariant[field] = null;
          }
        }
        return safeVariant;
      })
      : [];

    codes.forEach((code) => seenCreateCodes.set(code, productLabel(product)));
    safeAliasBarcodes.forEach((code) => seenCreateCodes.set(code, productLabel(product)));
    variants.flatMap((variant) => codeList(variant)).forEach((code) => seenCreateCodes.set(code, productLabel(product)));

    toCreate.push({
      source: product,
      payload: buildCreatePayload(product, targetTenantIdValue, targetShopIdValue, categoryId, sourceTenant, sourceShop),
      variants,
      aliasBarcodes: safeAliasBarcodes,
    });
  }

  return {
    toCreate,
    toUpdate,
    skippedExisting,
    skippedConflicts,
    ambiguous,
    variantCodeOmissions,
    aliasCodeOmissions,
  };
}

async function writePlan(plan, transaction) {
  let createdProducts = 0;
  let createdVariants = 0;
  let createdAliases = 0;
  let updatedProducts = 0;

  for (const item of plan.toCreate) {
    const product = await Product.create(item.payload, { transaction });
    createdProducts += 1;

    if (item.variants.length) {
      const variantRows = item.variants.map((variant) => ({
        productId: product.id,
        name: variant.name,
        sku: variant.sku || null,
        barcode: variant.barcode || null,
        costPrice: variant.costPrice,
        sellingPrice: variant.sellingPrice,
        quantityOnHand: variant.quantityOnHand || 0,
        attributes: variant.attributes || {},
        isActive: variant.isActive !== false,
        trackStock: variant.trackStock,
        metadata: {
          ...(variant.metadata || {}),
          copiedByScript: 'scripts/copy-products-between-tenant-shops.js',
          sourceVariantId: variant.id,
        },
      }));
      await ProductVariant.bulkCreate(variantRows, { transaction, validate: true });
      createdVariants += variantRows.length;
    }

    if (item.aliasBarcodes.length) {
      await Barcode.bulkCreate(item.aliasBarcodes.map((barcode) => ({
        tenantId: product.tenantId,
        productId: product.id,
        productVariantId: null,
        barcode,
        barcodeType: 'other',
        isActive: true,
        metadata: {
          copiedByScript: 'scripts/copy-products-between-tenant-shops.js',
          sourceProductId: item.source.id,
        },
      })), { transaction, validate: true });
      createdAliases += item.aliasBarcodes.length;
    }
  }

  for (const item of plan.toUpdate) {
    await item.target.update(item.payload, { transaction });
    updatedProducts += 1;
  }

  return { createdProducts, createdVariants, createdAliases, updatedProducts };
}

async function main() {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required');
  if (!sourceEmail) fail('Missing --source-email');
  if (!targetEmail) fail('Missing --target-email');
  if (!sourceShopId && !sourceShopName) fail('Missing --source-shop-id or --source-shop-name');
  if (isExecute && !shouldConfirm) fail('Execute mode requires --confirm-copy');

  console.log('\n=== Tenant Shop Product Copy ===');
  printSummary('Mode', isDryRun ? 'DRY RUN' : 'EXECUTE');
  printSummary('Update existing', updateExisting ? 'yes' : 'no, skip existing');
  printSummary('Copy variants', copyVariants ? 'yes, for newly created products' : 'no');
  printSummary('Source email', sourceEmail);
  printSummary('Source shop selector', sourceShopId || sourceShopName);
  printSummary('Target email', targetEmail);
  printSummary('Target shop selector', targetShopId || targetShopName || 'default/main shop');
  if (sourceTenantId) printSummary('Source tenant override', sourceTenantId);
  if (targetTenantId) printSummary('Target tenant override', targetTenantId);

  await testConnection();

  const sourceTenant = await resolveTenantByEmail(sourceEmail, sourceTenantId, 'source');
  const targetTenant = await resolveTenantByEmail(targetEmail, targetTenantId, 'target');
  const { shop: sourceShop } = await resolveNamedShop({
    tenantId: sourceTenant.tenantId,
    shopId: sourceShopId,
    shopName: sourceShopName,
    label: 'source',
  });
  const { shop: targetShop, action: targetShopAction } = await resolveTargetShop(targetTenant.tenantId);

  console.log('\nSource:');
  printSummary('User', `${sourceTenant.user.name || 'Unknown'} <${sourceTenant.user.email}>`);
  printSummary('Tenant', `${sourceTenant.tenant?.name || 'Unknown'} (${sourceTenant.tenantId})`);
  printSummary('Tenant status', sourceTenant.tenant?.status || 'unknown');
  printSummary('Membership role', sourceTenant.membershipRole || 'unknown');
  printSummary('Shop', `${sourceShop.name} (${sourceShop.id})`);

  console.log('\nTarget:');
  printSummary('User', `${targetTenant.user.name || 'Unknown'} <${targetTenant.user.email}>`);
  printSummary('Tenant', `${targetTenant.tenant?.name || 'Unknown'} (${targetTenant.tenantId})`);
  printSummary('Tenant status', targetTenant.tenant?.status || 'unknown');
  printSummary('Membership role', targetTenant.membershipRole || 'unknown');
  printSummary('Shop', targetShop ? `${targetShop.name} (${targetShop.id})` : 'none resolved');
  printSummary('Default shop action', targetShopAction);

  if (!targetShop) {
    if (isDryRun) {
      console.log('\nDry run note: execute mode would create the target tenant default shop before copying.');
      return;
    }
    fail('Unable to resolve target shop');
  }

  const sourceProducts = await loadSourceProducts(sourceTenant.tenantId, sourceShop.id);
  const { categoriesByName: sourceCategoriesByName, categoryNames } = buildSourceCategoryMaps(sourceProducts);
  const { existingByName: existingTargetCategories, missingNames: missingCategoryNames } =
    await loadTargetCategories(targetTenant.tenantId, categoryNames);
  const targetIndexes = await loadTargetIndexes(targetTenant.tenantId, targetShop.id);

  const plan = planCopy({
    sourceProducts,
    indexes: targetIndexes,
    categoryByName: existingTargetCategories,
    targetTenantIdValue: targetTenant.tenantId,
    targetShopIdValue: targetShop.id,
    sourceTenant,
    sourceShop: getPlain(sourceShop),
  });
  const actionCategoryKeys = new Set(uniqueValues([
    ...plan.toCreate.map((item) => item.source.category?.name),
    ...plan.toUpdate.map((item) => item.source.category?.name),
  ]).map((name) => normalizedKey(name)));
  const missingActionCategoryNames = missingCategoryNames
    .filter((name) => actionCategoryKeys.has(normalizedKey(name)));

  console.log('\nPlan:');
  printSummary('Source products', sourceProducts.length);
  printSummary('Target tenant products', targetIndexes.products.length);
  printSummary('Source categories', categoryNames.length);
  printSummary('Existing target categories', existingTargetCategories.size);
  printSummary('Categories to create', missingActionCategoryNames.length);
  printSummary('Products to create', plan.toCreate.length);
  printSummary('Products to update', plan.toUpdate.length);
  printSummary('Existing products skipped', plan.skippedExisting.length);
  printSummary('Conflict products skipped', plan.skippedConflicts.length);
  printSummary('Ambiguous products skipped', plan.ambiguous.length);
  printSummary('Variants to create', plan.toCreate.reduce((sum, item) => sum + item.variants.length, 0));
  printSummary('Alias barcodes to create', plan.toCreate.reduce((sum, item) => sum + item.aliasBarcodes.length, 0));
  printSummary('Variant codes omitted', plan.variantCodeOmissions.length);
  printSummary('Alias codes omitted', plan.aliasCodeOmissions.length);

  printRows('Categories that would be created', missingActionCategoryNames, (name) => name);
  printRows('Create examples', plan.toCreate, (item) =>
    `${productLabel(item.source)} qty=${item.payload.quantityOnHand} cost=${item.payload.costPrice} sell=${item.payload.sellingPrice}`
  );
  printRows('Update examples', plan.toUpdate, (item) =>
    `${productLabel(item.source)} -> target ${item.target.id} via ${item.matchedBy}`
  );
  printRows('Existing skip examples', plan.skippedExisting, (item) =>
    `${productLabel(item.source)} matched target ${item.target.id} via ${item.matchedBy}`
  );
  printRows('Conflict skip examples', plan.skippedConflicts, (item) =>
    `${productLabel(item.product)} - ${item.reason}`
  );
  printRows('Ambiguous skip examples', plan.ambiguous, (item) =>
    `${productLabel(item.product)} - ${item.reason}`
  );
  printRows('Variant code omission examples', plan.variantCodeOmissions, (item) =>
    `${productLabel(item.product)} / ${item.variant.name}: ${item.field} ${item.code} omitted (${item.reason})`
  );
  printRows('Alias barcode omission examples', plan.aliasCodeOmissions, (item) =>
    `${productLabel(item.product)}: alias ${item.barcode} omitted (${item.reason})`
  );

  if (isDryRun) {
    console.log('\nDry run complete. No database changes made.');
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    const createdCategories = await createMissingCategories(
      targetTenant.tenantId,
      sourceCategoriesByName,
      missingActionCategoryNames,
      transaction
    );
    const categoryByName = new Map([...existingTargetCategories, ...createdCategories]);
    const executionPlan = planCopy({
      sourceProducts,
      indexes: targetIndexes,
      categoryByName,
      targetTenantIdValue: targetTenant.tenantId,
      targetShopIdValue: targetShop.id,
      sourceTenant,
      sourceShop: getPlain(sourceShop),
    });
    const result = await writePlan(executionPlan, transaction);
    await transaction.commit();
    console.log('\nCopy completed.');
    printSummary('Products created', result.createdProducts);
    printSummary('Products updated', result.updatedProducts);
    printSummary('Variants created', result.createdVariants);
    printSummary('Alias barcodes created', result.createdAliases);
    printSummary('Categories created', createdCategories.size);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('\nProduct copy failed:', error?.message || error);
      process.exitCode = 1;
    })
    .finally(async () => {
      try {
        await sequelize.close();
      } catch (_error) {
        // Ignore close errors during CLI shutdown.
      }
    });
}
