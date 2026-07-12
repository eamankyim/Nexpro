#!/usr/bin/env node
/**
 * Replace ALL products for a tenant with the Bravo Thrybe 350GSM stock catalog + Printing.
 *
 * Target shop is typically Bravo Thrybe (user: gilbertceyram@gmail.com).
 *
 * What it does:
 * 1. Optionally purges tenant commerce docs (sales/invoices/quotes/stock/etc.) when
 *    `--purge-tenant-commerce` / `--start-fresh` is set — FK-safe, THIS tenant only.
 * 2. Deletes ALL products (and variants) for the resolved tenant — FK-safe order
 *    (barcodes / online listings / variants first, then products).
 * 3. Creates one product per color named `350GSM {Color}` with SIZE variants only
 *    (3XL, 2XL, XL, L, M). Cost 100, selling 120 for all 350GSM variants.
 * 4. Creates a simple Printing product (no variants): qty 100, cost 0, sell 0.
 *
 * Safety:
 * - Dry-run is the default (connects to DB, reports plan + existing counts; no writes).
 * - `--execute` writes; requires `--confirm-delete` to wipe products.
 * - `--email` is required for execute mode (tenant-id alone is not enough to write).
 * - Protected history (sale_items, quote_items, stock counts/transfers) blocks delete
 *   unless you pass granular destructive flags OR `--purge-tenant-commerce` / `--start-fresh`.
 * - Start-fresh execute is a triple confirm: `--email` + `--execute` + `--confirm-delete`
 *   + `--purge-tenant-commerce` (or `--start-fresh`).
 * - No models use Sequelize paranoid; deletes are hard deletes scoped by tenantId.
 *
 * Usage (from Backend/):
 *   # Dry-run (default) — preview catalog + existing product / commerce counts
 *   node scripts/replace-bravo-thrybe-350gsm-stock.js --email gilbertceyram@gmail.com
 *
 *   # Dry-run start-fresh plan (shows what commerce would be purged)
 *   node scripts/replace-bravo-thrybe-350gsm-stock.js --email gilbertceyram@gmail.com --purge-tenant-commerce
 *
 *   # Execute replace only (products; history must be clear or use granular flags)
 *   node scripts/replace-bravo-thrybe-350gsm-stock.js --email gilbertceyram@gmail.com --execute --confirm-delete
 *
 *   # START FRESH (VPS): purge tenant commerce + wipe products + import 350GSM catalog
 *   node scripts/replace-bravo-thrybe-350gsm-stock.js --email gilbertceyram@gmail.com \
 *     --execute --confirm-delete --purge-tenant-commerce
 *
 *   # Alias for the same start-fresh execute:
 *   node scripts/replace-bravo-thrybe-350gsm-stock.js --email gilbertceyram@gmail.com \
 *     --execute --confirm-delete --start-fresh
 *
 *   # Granular history flags (without full commerce purge), after reviewing dry-run:
 *   node scripts/replace-bravo-thrybe-350gsm-stock.js --email gilbertceyram@gmail.com \
 *     --execute --confirm-delete --delete-sale-items --detach-quote-items --delete-stock-history
 *
 * Catalog counts: 12 color parents + 1 Printing = 13 products; 60 size variants.
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
  Barcode,
  OnlineProductListing,
  Sale,
  SaleItem,
  SaleActivity,
  Invoice,
  Payment,
  Quote,
  QuoteItem,
  QuoteActivity,
  Job,
  Prescription,
  StockCount,
  StockCountItem,
  StockTransfer,
  StorefrontReview,
  StorefrontWishlistItem,
  MarketplaceDispute,
  MarketplaceLedgerEntry,
  MarketplacePayout,
  MarketplaceOrderPayment,
  DealerLedgerEntry,
  DealerProductPrice,
} = require('../models');
const { syncParentQuantityFromVariants } = require('../utils/productStockUtils');

const SCRIPT_NAME = 'scripts/replace-bravo-thrybe-350gsm-stock.js';
const DEFAULT_HELP_EMAIL = 'gilbertceyram@gmail.com';
const COST_PRICE = 100;
const SELLING_PRICE = 120;
const SIZES = ['3XL', '2XL', 'XL', 'L', 'M'];
const SAMPLE_LIMIT = 20;

const PROTECTED_HISTORY_MESSAGE = [
  'Protected history still references these products.',
  'Default execution will not delete sales/quote/stock-transfer history.',
  'Review the dry-run counts, then either pass granular history flags or use --purge-tenant-commerce / --start-fresh.',
].join(' ');

const argv = process.argv.slice(2);
const hasFlag = (flag) => argv.includes(flag);
const getArgValue = (flag, fallback = null) => {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
};

const VALUE_FLAGS = new Set([
  '--email',
  '--tenant-id',
  '--tenant-name',
  '--shop-name',
]);
const BOOLEAN_FLAGS = new Set([
  '--dry-run',
  '--execute',
  '--confirm-delete',
  '--delete-sale-items',
  '--delete-stock-history',
  '--detach-quote-items',
  '--purge-tenant-commerce',
  '--start-fresh',
  '--help',
  '-h',
]);

const email = normalizeEmail(getArgValue('--email', ''));
const tenantIdFilter = normalizeText(getArgValue('--tenant-id', '')) || null;
const tenantNameFilter = normalizeText(getArgValue('--tenant-name', '')) || null;
const shopNameFilter = normalizeText(getArgValue('--shop-name', '')) || null;
const isExecute = hasFlag('--execute');
const isDryRun = !isExecute;
const confirmDelete = hasFlag('--confirm-delete');
const purgeTenantCommerce = hasFlag('--purge-tenant-commerce') || hasFlag('--start-fresh');
const deleteSaleItems = hasFlag('--delete-sale-items') || purgeTenantCommerce;
const deleteStockHistory = hasFlag('--delete-stock-history') || purgeTenantCommerce;
const detachQuoteItems = hasFlag('--detach-quote-items') || purgeTenantCommerce;

/**
 * Color catalog: quantities ordered as [3XL, 2XL, XL, L, M].
 */
const COLOR_STOCK = [
  { color: 'Black', quantities: [7, 16, 14, 0, 0] },
  { color: 'Khaki', quantities: [14, 25, 22, 0, 0] },
  { color: 'Cream', quantities: [19, 28, 27, 10, 1] },
  { color: 'Blue', quantities: [5, 8, 0, 0, 0] },
  { color: 'Red', quantities: [2, 9, 21, 0, 0] },
  { color: 'Pink', quantities: [1, 6, 0, 0, 0] },
  { color: 'Purple', quantities: [10, 12, 12, 0, 0] },
  { color: 'Brown', quantities: [25, 18, 10, 0, 0] },
  { color: 'White', quantities: [9, 35, 17, 4, 1] },
  { color: 'Deep green', quantities: [0, 6, 0, 0, 0] },
  { color: 'Light green', quantities: [16, 16, 10, 0, 0] },
  { color: 'Ash', quantities: [0, 2, 0, 0, 1] },
];

const PRINTING_PRODUCT = {
  name: 'Printing',
  sku: 'PRINTING',
  quantityOnHand: 100,
  costPrice: 0,
  sellingPrice: 0,
};

const USAGE = `
Usage:
  node scripts/replace-bravo-thrybe-350gsm-stock.js --email <user-email> [--tenant-name <name>] [--shop-name <name>] [--dry-run]
  node scripts/replace-bravo-thrybe-350gsm-stock.js --tenant-id <uuid> [--shop-name <name>]   # dry-run only
  node scripts/replace-bravo-thrybe-350gsm-stock.js --email <user-email> --execute --confirm-delete
  node scripts/replace-bravo-thrybe-350gsm-stock.js --email <user-email> --execute --confirm-delete --purge-tenant-commerce

Examples:
  node scripts/replace-bravo-thrybe-350gsm-stock.js --email ${DEFAULT_HELP_EMAIL}
  node scripts/replace-bravo-thrybe-350gsm-stock.js --email ${DEFAULT_HELP_EMAIL} --purge-tenant-commerce
  node scripts/replace-bravo-thrybe-350gsm-stock.js --email ${DEFAULT_HELP_EMAIL} --execute --confirm-delete --purge-tenant-commerce

Creates: 12 × 350GSM color products (5 size variants each = 60 variants) + 1 Printing product.

Dangerous start-fresh flag:
  --purge-tenant-commerce | --start-fresh
    Deletes THIS tenant's sales/invoices/payments/quotes/stock history (and product-linked
    storefront/marketplace/dealer rows) in FK-safe order, then products, then imports catalog.
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

  if (hasFlag('--help') || hasFlag('-h')) {
    console.log(USAGE);
    process.exit(0);
  }

  if (!email && !tenantIdFilter && !tenantNameFilter) {
    fail('Provide --email, --tenant-id, or --tenant-name');
  }

  if (isExecute) {
    if (!email) fail('Execute mode requires --email (tenant-id alone is not enough)');
    if (!confirmDelete) fail('Execute mode requires --confirm-delete to wipe existing products');
    if (purgeTenantCommerce && (!email || !confirmDelete)) {
      fail('Start-fresh execute requires --email + --execute + --confirm-delete + --purge-tenant-commerce');
    }
  }
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

function getIds(rows) {
  return rows.map((row) => row.id);
}

function buildCatalog() {
  const parents = COLOR_STOCK.map((entry) => {
    const skuPrefix = `350GSM-${slugifyToken(entry.color)}`;
    const variantQtySum = entry.quantities.reduce((sum, qty) => sum + qty, 0);
    return {
      type: 'parent',
      name: `350GSM ${entry.color}`,
      sku: skuPrefix,
      hasVariants: true,
      costPrice: COST_PRICE,
      sellingPrice: SELLING_PRICE,
      quantityOnHand: variantQtySum,
      trackStock: true,
      unit: 'pcs',
      color: entry.color,
      quantities: entry.quantities,
    };
  });

  const variants = [];
  for (const parent of parents) {
    SIZES.forEach((size, index) => {
      const qty = parent.quantities[index] ?? 0;
      const sku = `${parent.sku}-${slugifyToken(size)}`;
      variants.push({
        parentName: parent.name,
        name: size,
        sku,
        attributes: { size, color: parent.color },
        costPrice: COST_PRICE,
        sellingPrice: SELLING_PRICE,
        quantityOnHand: qty,
        trackStock: true,
        isActive: true,
      });
    });
  }

  const simple = {
    type: 'simple',
    name: PRINTING_PRODUCT.name,
    sku: PRINTING_PRODUCT.sku,
    hasVariants: false,
    costPrice: PRINTING_PRODUCT.costPrice,
    sellingPrice: PRINTING_PRODUCT.sellingPrice,
    quantityOnHand: PRINTING_PRODUCT.quantityOnHand,
    trackStock: true,
    unit: 'pcs',
  };

  return {
    parents,
    variants,
    simple,
    productCount: parents.length + 1,
    variantCount: variants.length,
  };
}

async function resolveTenantByEmail(targetEmail, targetTenantId, targetTenantName) {
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
  if (targetTenantId) {
    matches = matches.filter((membership) => membership.tenant.id === targetTenantId);
  }
  if (targetTenantName) {
    matches = matches.filter(
      (membership) => normalizedKey(membership.tenant.name) === normalizedKey(targetTenantName)
    );
  }

  if (!matches.length) {
    fail(`No tenant membership found for ${targetEmail}${targetTenantName ? ` with tenant "${targetTenantName}"` : ''}${targetTenantId ? ` / tenant-id ${targetTenantId}` : ''}`);
  }

  if (matches.length > 1) {
    const defaultMatches = matches.filter((membership) => membership.isDefault);
    if (!targetTenantId && !targetTenantName && defaultMatches.length === 1) {
      const selected = defaultMatches[0];
      return {
        user,
        tenant: selected.tenant,
        tenantId: selected.tenantId,
        membershipRole: selected.role,
      };
    }

    console.error('\nUser belongs to multiple matching tenants. Re-run with --tenant-id or --tenant-name:');
    matches.forEach((membership) => {
      console.error(`- ${membership.tenant.id} (${membership.tenant.name}) slug=${membership.tenant.slug || 'none'} default=${membership.isDefault}`);
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

async function resolveTenantDirectly(targetTenantId, targetTenantName) {
  const where = {};
  if (targetTenantId) where.id = targetTenantId;
  if (targetTenantName) where.name = { [Op.iLike]: targetTenantName };

  const tenants = await Tenant.findAll({
    where,
    attributes: ['id', 'name', 'slug', 'status', 'businessType'],
    order: [['createdAt', 'ASC']],
  });

  if (!tenants.length) fail('No tenant found with the provided tenant filter.');
  if (tenants.length > 1) {
    console.error('\nMultiple tenants matched. Re-run with --tenant-id:');
    tenants.forEach((tenant) => console.error(`- ${tenant.id} (${tenant.name})`));
    process.exit(1);
  }

  return {
    user: null,
    tenant: tenants[0],
    tenantId: tenants[0].id,
    membershipRole: null,
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

async function countWhere(Model, where, options = {}) {
  if (!Model) return 0;
  return Model.count({ where, ...options });
}

async function findIds(Model, where, options = {}) {
  if (!Model) return [];
  const rows = await Model.findAll({ where, attributes: ['id'], ...options });
  return getIds(rows);
}

async function collectTenantProductState(tenantId, options = {}) {
  const products = await Product.findAll({
    where: { tenantId },
    attributes: ['id', 'name', 'sku', 'hasVariants', 'quantityOnHand'],
    ...options,
  });

  const productIds = getIds(products);
  const productWhere = productIds.length ? { productId: productIds } : { productId: '__none__' };
  const variantRows = productIds.length
    ? await ProductVariant.findAll({ where: productWhere, attributes: ['id'], ...options })
    : [];
  const variantIds = getIds(variantRows);

  const linkedProductsOrVariants = productIds.length
    ? {
      [Op.or]: [
        { productId: productIds },
        ...(variantIds.length ? [{ productVariantId: variantIds }] : []),
      ],
    }
    : null;

  const stockTransferWhere = productIds.length
    ? {
      tenantId,
      [Op.or]: [
        { sourceProductId: productIds },
        { destinationProductId: productIds },
        ...(variantIds.length
          ? [
            { sourceVariantId: variantIds },
            { destinationVariantId: variantIds },
          ]
          : []),
      ],
    }
    : null;

  const counts = {
    products: productIds.length,
    variants: variantIds.length,
    onlineListings: productIds.length
      ? await countWhere(OnlineProductListing, { tenantId, productId: productIds }, options)
      : 0,
    barcodes: productIds.length
      ? await countWhere(Barcode, {
        tenantId,
        ...linkedProductsOrVariants,
      }, options)
      : 0,
    saleItems: linkedProductsOrVariants
      ? await countWhere(SaleItem, linkedProductsOrVariants, options)
      : 0,
    quoteItems: productIds.length
      ? await countWhere(QuoteItem, { tenantId, productId: productIds }, options)
      : 0,
    stockCountItems: linkedProductsOrVariants
      ? await countWhere(StockCountItem, { tenantId, ...linkedProductsOrVariants }, options)
      : 0,
    stockTransfers: stockTransferWhere
      ? await countWhere(StockTransfer, stockTransferWhere, options)
      : 0,
    dealerProductPrices: linkedProductsOrVariants
      ? await countWhere(DealerProductPrice, { tenantId, ...linkedProductsOrVariants }, options)
      : 0,
    storefrontWishlistItems: linkedProductsOrVariants
      ? await countWhere(StorefrontWishlistItem, { tenantId, ...linkedProductsOrVariants }, options)
      : 0,
    storefrontReviews: linkedProductsOrVariants
      ? await countWhere(StorefrontReview, { tenantId, ...linkedProductsOrVariants }, options)
      : 0,
  };

  return { products, productIds, variantIds, counts };
}

async function collectTenantCommerceState(tenantId, productState, options = {}) {
  const saleIds = await findIds(Sale, { tenantId }, options);
  const quoteIds = await findIds(Quote, { tenantId }, options);
  const stockCountIds = await findIds(StockCount, { tenantId }, options);

  const saleItemCount = saleIds.length
    ? await countWhere(SaleItem, { saleId: saleIds }, options)
    : 0;
  const quoteItemCount = quoteIds.length
    ? await countWhere(QuoteItem, { quoteId: quoteIds }, options)
    : productState.counts.quoteItems;

  return {
    saleIds,
    quoteIds,
    stockCountIds,
    counts: {
      sales: saleIds.length,
      saleItems: Math.max(saleItemCount, productState.counts.saleItems),
      saleActivities: await countWhere(SaleActivity, { tenantId }, options),
      invoices: await countWhere(Invoice, { tenantId }, options),
      payments: await countWhere(Payment, { tenantId }, options),
      quotes: quoteIds.length,
      quoteItems: quoteItemCount,
      quoteActivities: await countWhere(QuoteActivity, { tenantId }, options),
      stockCounts: stockCountIds.length,
      stockCountItems: await countWhere(StockCountItem, { tenantId }, options),
      stockTransfers: await countWhere(StockTransfer, { tenantId }, options),
      marketplaceDisputes: await countWhere(MarketplaceDispute, { tenantId }, options),
      marketplaceLedgerEntries: await countWhere(MarketplaceLedgerEntry, { tenantId }, options),
      marketplacePayouts: await countWhere(MarketplacePayout, { tenantId }, options),
      marketplaceOrderPayments: await countWhere(MarketplaceOrderPayment, { tenantId }, options),
      dealerLedgerEntries: await countWhere(DealerLedgerEntry, { tenantId }, options),
      dealerProductPrices: productState.counts.dealerProductPrices,
      storefrontReviews: await countWhere(StorefrontReview, { tenantId }, options),
      storefrontWishlistItems: productState.counts.storefrontWishlistItems,
      prescriptionsWithInvoice: await countWhere(Prescription, {
        tenantId,
        invoiceId: { [Op.ne]: null },
      }, options),
      jobsWithQuote: await countWhere(Job, {
        tenantId,
        quoteId: { [Op.ne]: null },
      }, options),
      salesWithInvoice: await countWhere(Sale, {
        tenantId,
        invoiceId: { [Op.ne]: null },
      }, options),
      products: productState.counts.products,
      variants: productState.counts.variants,
      barcodes: productState.counts.barcodes,
      onlineListings: productState.counts.onlineListings,
    },
  };
}

function printCounts(counts) {
  console.log('\nExisting catalog counts:');
  printSummary('Products', counts.products);
  printSummary('Product variants', counts.variants);
  printSummary('Online listings', counts.onlineListings);
  printSummary('Barcodes', counts.barcodes);
  console.log('\nProtected/history references:');
  printSummary('Sale items', counts.saleItems);
  printSummary('Quote items', counts.quoteItems);
  printSummary('Stock count items', counts.stockCountItems);
  printSummary('Stock transfers', counts.stockTransfers);
}

function printCommercePurgePlan(counts, flagged) {
  const title = flagged
    ? '\nStart-fresh purge plan (THIS tenant only):'
    : '\nCommerce docs present (use --purge-tenant-commerce / --start-fresh to wipe):';
  console.log(title);
  printSummary('Sales', counts.sales);
  printSummary('Sale items', counts.saleItems);
  printSummary('Sale activities', counts.saleActivities);
  printSummary('Invoices', counts.invoices);
  printSummary('Payments', counts.payments);
  printSummary('Quotes', counts.quotes);
  printSummary('Quote items', counts.quoteItems);
  printSummary('Quote activities', counts.quoteActivities);
  printSummary('Stock counts', counts.stockCounts);
  printSummary('Stock count items', counts.stockCountItems);
  printSummary('Stock transfers', counts.stockTransfers);
  printSummary('Marketplace disputes', counts.marketplaceDisputes);
  printSummary('Marketplace ledger entries', counts.marketplaceLedgerEntries);
  printSummary('Marketplace payouts', counts.marketplacePayouts);
  printSummary('Marketplace order payments', counts.marketplaceOrderPayments);
  printSummary('Dealer ledger entries', counts.dealerLedgerEntries);
  printSummary('Dealer product prices', counts.dealerProductPrices);
  printSummary('Storefront reviews', counts.storefrontReviews);
  printSummary('Storefront wishlist items', counts.storefrontWishlistItems);
  printSummary('Sales linked to invoices', counts.salesWithInvoice);
  printSummary('Jobs linked to quotes', counts.jobsWithQuote);
  printSummary('Prescriptions linked to invoices', counts.prescriptionsWithInvoice);
  printSummary('Products (after commerce)', counts.products);
  printSummary('Variants (after commerce)', counts.variants);
}

function assertDeleteAllowed(counts) {
  if (purgeTenantCommerce) return;

  const blockers = [];
  if (counts.saleItems > 0 && !deleteSaleItems) blockers.push(`${counts.saleItems} sale_items`);
  if (counts.quoteItems > 0 && !detachQuoteItems) blockers.push(`${counts.quoteItems} quote_items`);
  if (counts.stockCountItems > 0 && !deleteStockHistory) blockers.push(`${counts.stockCountItems} stock_count_items`);
  if (counts.stockTransfers > 0 && !deleteStockHistory) blockers.push(`${counts.stockTransfers} stock_transfers`);

  if (blockers.length > 0) {
    throw new Error(
      `${PROTECTED_HISTORY_MESSAGE}\nBlocking references: ${blockers.join(', ')}\n`
      + `Start-fresh CLI:\n  node ${SCRIPT_NAME} --email ${email || DEFAULT_HELP_EMAIL} `
      + '--execute --confirm-delete --purge-tenant-commerce'
    );
  }
}

async function destroyWhere(Model, where, options, label) {
  const count = await Model.destroy({ where, ...options });
  console.log(`  Deleted ${count} ${label}`);
  return count;
}

async function updateWhere(Model, values, where, options, label) {
  const [affectedRows] = await Model.update(values, { where, ...options });
  console.log(`  Cleared ${affectedRows} ${label}`);
  return affectedRows;
}

/**
 * Purge tenant commerce documents in FK-safe order (hard delete; no paranoid models).
 * Scoped strictly by tenantId / ids collected for this tenant.
 */
async function purgeTenantCommerceDocs(tenantId, commerce, productIds, variantIds, transaction) {
  const options = { transaction };
  const { saleIds, quoteIds, stockCountIds } = commerce;

  console.log('\nPurging tenant commerce (start-fresh)...');

  await destroyWhere(MarketplaceDispute, { tenantId }, options, 'marketplace_disputes');
  await destroyWhere(MarketplaceLedgerEntry, { tenantId }, options, 'marketplace_ledger_entries');
  await destroyWhere(MarketplacePayout, { tenantId }, options, 'marketplace_payouts');
  await destroyWhere(MarketplaceOrderPayment, { tenantId }, options, 'marketplace_order_payments');
  await destroyWhere(StorefrontReview, { tenantId }, options, 'storefront_reviews');
  await destroyWhere(DealerLedgerEntry, { tenantId }, options, 'dealer_ledger_entries');
  await destroyWhere(Payment, { tenantId }, options, 'payments');
  await destroyWhere(SaleActivity, { tenantId }, options, 'sale_activities');

  if (saleIds.length) {
    await destroyWhere(SaleItem, { saleId: saleIds }, options, 'sale_items');
  }

  // Break Sale <-> Invoice circular FKs before deleting either side.
  await updateWhere(Sale, { invoiceId: null }, { tenantId, invoiceId: { [Op.ne]: null } }, options, 'sales.invoiceId');
  await updateWhere(
    Prescription,
    { invoiceId: null },
    { tenantId, invoiceId: { [Op.ne]: null } },
    options,
    'prescriptions.invoiceId'
  );
  await updateWhere(
    Invoice,
    { saleId: null, quoteId: null, jobId: null },
    { tenantId },
    options,
    'invoice FK refs'
  );

  await destroyWhere(Invoice, { tenantId }, options, 'invoices');
  await destroyWhere(Sale, { tenantId }, options, 'sales');

  await updateWhere(Job, { quoteId: null }, { tenantId, quoteId: { [Op.ne]: null } }, options, 'jobs.quoteId');
  await destroyWhere(QuoteActivity, { tenantId }, options, 'quote_activities');
  if (quoteIds.length) {
    await destroyWhere(QuoteItem, { quoteId: quoteIds }, options, 'quote_items');
  } else {
    await destroyWhere(QuoteItem, { tenantId }, options, 'quote_items');
  }
  await destroyWhere(Quote, { tenantId }, options, 'quotes');

  await destroyWhere(StockTransfer, { tenantId }, options, 'stock_transfers');
  if (stockCountIds.length) {
    await destroyWhere(StockCountItem, { stockCountId: stockCountIds }, options, 'stock_count_items');
  } else {
    await destroyWhere(StockCountItem, { tenantId }, options, 'stock_count_items');
  }
  await destroyWhere(StockCount, { tenantId }, options, 'stock_counts');

  if (productIds.length) {
    const linkedProductsOrVariants = {
      [Op.or]: [
        { productId: productIds },
        ...(variantIds.length ? [{ productVariantId: variantIds }] : []),
      ],
    };
    await destroyWhere(
      StorefrontWishlistItem,
      { tenantId, ...linkedProductsOrVariants },
      options,
      'storefront_wishlist_items'
    );
    await destroyWhere(
      DealerProductPrice,
      { tenantId, ...linkedProductsOrVariants },
      options,
      'dealer_product_prices'
    );
  }
}

async function deleteAllTenantProducts(tenantId, counts, productIds, variantIds, transaction) {
  if (!productIds.length) {
    console.log('\nNo existing products to delete.');
    return;
  }

  const options = { transaction };
  const linkedProducts = { productId: productIds };
  const linkedProductsOrVariants = {
    [Op.or]: [
      { productId: productIds },
      ...(variantIds.length ? [{ productVariantId: variantIds }] : []),
    ],
  };

  console.log('\nDeleting existing tenant product catalog...');

  // When start-fresh already purged sales/quotes/stock, these branches are no-ops.
  if (!purgeTenantCommerce && deleteSaleItems && counts.saleItems > 0) {
    await destroyWhere(SaleItem, linkedProductsOrVariants, options, 'sale_items');
  }

  if (!purgeTenantCommerce && detachQuoteItems && counts.quoteItems > 0) {
    const [affectedRows] = await QuoteItem.update(
      { productId: null },
      { where: { tenantId, ...linkedProducts }, ...options },
    );
    console.log(`  Detached ${affectedRows} quote_items`);
  }

  if (!purgeTenantCommerce && deleteStockHistory) {
    if (counts.stockTransfers > 0) {
      await destroyWhere(StockTransfer, {
        tenantId,
        [Op.or]: [
          { sourceProductId: productIds },
          { destinationProductId: productIds },
          ...(variantIds.length
            ? [
              { sourceVariantId: variantIds },
              { destinationVariantId: variantIds },
            ]
            : []),
        ],
      }, options, 'stock_transfers');
    }

    if (counts.stockCountItems > 0) {
      await destroyWhere(StockCountItem, {
        tenantId,
        ...linkedProductsOrVariants,
      }, options, 'stock_count_items');
    }
  }

  if (counts.dealerProductPrices > 0) {
    await destroyWhere(
      DealerProductPrice,
      { tenantId, ...linkedProductsOrVariants },
      options,
      'dealer_product_prices'
    );
  }
  if (counts.storefrontWishlistItems > 0) {
    await destroyWhere(
      StorefrontWishlistItem,
      { tenantId, ...linkedProductsOrVariants },
      options,
      'storefront_wishlist_items'
    );
  }
  if (counts.storefrontReviews > 0) {
    await destroyWhere(
      StorefrontReview,
      { tenantId, ...linkedProductsOrVariants },
      options,
      'storefront_reviews'
    );
  }

  await destroyWhere(Barcode, { tenantId, ...linkedProductsOrVariants }, options, 'barcodes');
  await destroyWhere(OnlineProductListing, { tenantId, ...linkedProducts }, options, 'online_product_listings');
  await destroyWhere(ProductVariant, linkedProducts, options, 'product_variants');
  await destroyWhere(Product, { tenantId, id: productIds }, options, 'products');
}

async function createParentProduct({ tenantId, shopId, parentPlan, transaction }) {
  return Product.create({
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
      importSource: 'bravo-thrybe-350gsm-replace',
      importedByScript: SCRIPT_NAME,
      parentType: parentPlan.type,
      color: parentPlan.color || null,
    },
  }, { transaction, validate: true });
}

async function createVariant({ parentProductId, variantPlan, transaction }) {
  return ProductVariant.create({
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
      importSource: 'bravo-thrybe-350gsm-replace',
      importedByScript: SCRIPT_NAME,
    },
  }, { transaction, validate: true });
}

async function main() {
  validateArgs();

  const catalog = buildCatalog();

  console.log('\n=== Bravo Thrybe 350GSM Stock Replace ===');
  printSummary('Mode', isDryRun ? 'DRY RUN' : 'EXECUTE');
  printSummary('Purge tenant commerce', purgeTenantCommerce ? 'YES (--purge-tenant-commerce/--start-fresh)' : 'no');
  if (email) printSummary('Email', email);
  if (tenantIdFilter) printSummary('Tenant id filter', tenantIdFilter);
  if (tenantNameFilter) printSummary('Tenant name filter', tenantNameFilter);
  if (shopNameFilter) printSummary('Shop name filter', shopNameFilter);
  printSummary('350GSM cost / sell', `${COST_PRICE} / ${SELLING_PRICE}`);
  printSummary('Color products', catalog.parents.length);
  printSummary('Size variants', catalog.variantCount);
  printSummary('Simple products', 1);
  printSummary('Total products to create', catalog.productCount);

  printRows('Color products preview', catalog.parents, (row) => (
    `${row.name} [sku=${row.sku}] qtySum=${row.quantityOnHand} sizes=${SIZES.map((size, i) => `${size}:${row.quantities[i]}`).join(' ')}`
  ));
  printRows('Variant preview', catalog.variants, (row) => (
    `${row.parentName} -> ${row.name} [sku=${row.sku}] qty=${row.quantityOnHand} price=${row.sellingPrice}`
  ), 15);
  console.log(`\nSimple product:\n- ${catalog.simple.name} [sku=${catalog.simple.sku}] qty=${catalog.simple.quantityOnHand} cost=${catalog.simple.costPrice} sell=${catalog.simple.sellingPrice}`);

  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required');
  await testConnection();

  const resolved = email
    ? await resolveTenantByEmail(email, tenantIdFilter, tenantNameFilter)
    : await resolveTenantDirectly(tenantIdFilter, tenantNameFilter);

  const { user, tenant, tenantId, membershipRole } = resolved;
  const shop = await resolveShop(tenantId, shopNameFilter);
  const existing = await collectTenantProductState(tenantId);
  const commerce = await collectTenantCommerceState(tenantId, existing);

  console.log('\nTarget:');
  if (user) printSummary('User', `${user.name || 'Unknown'} <${user.email}>`);
  printSummary('Tenant', `${tenant?.name || 'Unknown'} (${tenantId})`);
  printSummary('Tenant status', tenant?.status || 'unknown');
  printSummary('Business type', tenant?.businessType || 'unknown');
  if (membershipRole) printSummary('Membership role', membershipRole);
  printSummary('Shop', `${shop.name} (${shop.id})`);

  printCounts(existing.counts);
  printCommercePurgePlan(commerce.counts, purgeTenantCommerce);
  if (existing.products.length) {
    printRows('Existing products sample', existing.products, (row) => (
      `${row.name} [sku=${row.sku || 'none'}] hasVariants=${row.hasVariants} qty=${row.quantityOnHand}`
    ), 10);
  }

  if (isDryRun) {
    console.log('\nDRY RUN ONLY. No rows were deleted or created.');
    if (purgeTenantCommerce) {
      console.log('To execute start-fresh, re-run with:');
      console.log(
        `  node ${SCRIPT_NAME} --email ${email || DEFAULT_HELP_EMAIL} `
        + '--execute --confirm-delete --purge-tenant-commerce'
      );
    } else {
      console.log('To execute product replace only: --email <user> --execute --confirm-delete');
      console.log('To wipe commerce then replace: add --purge-tenant-commerce (or --start-fresh).');
    }
    return;
  }

  assertDeleteAllowed(existing.counts);

  const transaction = await sequelize.transaction();
  try {
    if (purgeTenantCommerce) {
      await purgeTenantCommerceDocs(
        tenantId,
        commerce,
        existing.productIds,
        existing.variantIds,
        transaction,
      );
    }

    await deleteAllTenantProducts(
      tenantId,
      existing.counts,
      existing.productIds,
      existing.variantIds,
      transaction,
    );

    console.log('\nCreating 350GSM catalog + Printing...');
    let createdParents = 0;
    let createdVariants = 0;
    let createdSimple = 0;
    const parentIdByName = new Map();

    for (const parentPlan of catalog.parents) {
      const saved = await createParentProduct({
        tenantId,
        shopId: shop.id,
        parentPlan,
        transaction,
      });
      parentIdByName.set(normalizedKey(parentPlan.name), saved.id);
      createdParents += 1;
    }

    for (const variantPlan of catalog.variants) {
      const parentId = parentIdByName.get(normalizedKey(variantPlan.parentName));
      if (!parentId) {
        throw new Error(`Missing parent product for variant parent "${variantPlan.parentName}"`);
      }
      await createVariant({
        parentProductId: parentId,
        variantPlan,
        transaction,
      });
      createdVariants += 1;
    }

    for (const parentPlan of catalog.parents) {
      const parentId = parentIdByName.get(normalizedKey(parentPlan.name));
      if (parentId) {
        await syncParentQuantityFromVariants(parentId, transaction);
      }
    }

    await createParentProduct({
      tenantId,
      shopId: shop.id,
      parentPlan: catalog.simple,
      transaction,
    });
    createdSimple += 1;

    await transaction.commit();

    console.log('\nReplace completed.');
    if (purgeTenantCommerce) {
      printSummary('Purged sales', commerce.counts.sales);
      printSummary('Purged invoices', commerce.counts.invoices);
      printSummary('Purged payments', commerce.counts.payments);
      printSummary('Purged quotes', commerce.counts.quotes);
    }
    printSummary('Deleted products', existing.counts.products);
    printSummary('Deleted variants', existing.counts.variants);
    printSummary('Created color products', createdParents);
    printSummary('Created variants', createdVariants);
    printSummary('Created simple products', createdSimple);
    printSummary('Total products now', createdParents + createdSimple);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('\nReplace failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (_error) {
      // Ignore close errors during CLI shutdown.
    }
  });
