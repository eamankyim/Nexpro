/**
 * Safely delete product catalog rows for one tenant.
 *
 * Dry-run is the default. Actual deletion requires both:
 *   --execute --confirm-delete
 *
 * Usage (from Backend directory):
 *   npm run delete:tenant-products -- --email eamankyim@gmail.com
 *   npm run delete:tenant-products -- --email eamankyim@gmail.com --execute --confirm-delete
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const {
  User,
  Tenant,
  UserTenant,
  Product,
  ProductVariant,
  Barcode,
  OnlineProductListing,
  SaleItem,
  QuoteItem,
  StockCountItem,
  StockTransfer,
} = require('../models');

const PROTECTED_HISTORY_MESSAGE = [
  'Protected history still references these products.',
  'Default execution will not delete sales/quote/stock-transfer history.',
  'Review the dry-run counts before using any history deletion flags.',
].join(' ');

function parseArgs(argv) {
  const args = {
    execute: false,
    confirmDelete: false,
    deleteSaleItems: false,
    deleteStockHistory: false,
    detachQuoteItems: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    const next = argv[i + 1];

    if (value === '--email') {
      args.email = next;
      i += 1;
    } else if (value === '--tenant-id') {
      args.tenantId = next;
      i += 1;
    } else if (value === '--tenant-name') {
      args.tenantName = next;
      i += 1;
    } else if (value === '--execute') {
      args.execute = true;
    } else if (value === '--confirm-delete') {
      args.confirmDelete = true;
    } else if (value === '--delete-sale-items') {
      args.deleteSaleItems = true;
    } else if (value === '--delete-stock-history') {
      args.deleteStockHistory = true;
    } else if (value === '--detach-quote-items') {
      args.detachQuoteItems = true;
    } else if (value === '--help' || value === '-h') {
      args.help = true;
    } else if (!value.startsWith('--') && !args.email) {
      args.email = value;
    } else {
      throw new Error(`Unknown or incomplete argument: ${value}`);
    }
  }

  if (args.email) args.email = String(args.email).trim().toLowerCase();
  if (args.tenantId) args.tenantId = String(args.tenantId).trim();
  if (args.tenantName) args.tenantName = String(args.tenantName).trim();

  return args;
}

function printUsage() {
  console.log(`
Delete tenant product catalog rows.

Dry-run examples:
  npm run delete:tenant-products -- --email eamankyim@gmail.com
  npm run delete:tenant-products -- --tenant-id <tenant-id>
  npm run delete:tenant-products -- --tenant-name "Tenant Name"

Execute examples:
  npm run delete:tenant-products -- --email eamankyim@gmail.com --execute --confirm-delete

Destructive history flags, only when you have reviewed dry-run counts:
  --delete-sale-items     Delete linked sale_items so products can be deleted
  --delete-stock-history  Delete linked stock_count_items and stock_transfers
  --detach-quote-items    Set linked quote_items.productId to null
`);
}

function formatTenant(tenant) {
  return `${tenant.name} (${tenant.id})`;
}

function getIds(rows) {
  return rows.map((row) => row.id);
}

async function findTenantByEmail(args) {
  const user = await User.findOne({
    where: { email: args.email },
    attributes: ['id', 'name', 'email'],
  });

  if (!user) {
    throw new Error(`No user found for email ${args.email}`);
  }

  const memberships = await UserTenant.findAll({
    where: { userId: user.id },
    include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name', 'slug', 'status'] }],
    order: [
      ['isDefault', 'DESC'],
      ['createdAt', 'ASC'],
    ],
  });

  let matches = memberships.filter((membership) => membership.tenant);

  if (args.tenantId) {
    matches = matches.filter((membership) => membership.tenant.id === args.tenantId);
  }

  if (args.tenantName) {
    const wanted = args.tenantName.toLowerCase();
    matches = matches.filter((membership) => membership.tenant.name.toLowerCase() === wanted);
  }

  if (matches.length === 0) {
    throw new Error(`No tenant membership found for ${args.email} with the provided filters.`);
  }

  if (matches.length === 1) {
    return { user, tenant: matches[0].tenant, membership: matches[0] };
  }

  const defaultMatches = matches.filter((membership) => membership.isDefault);
  if (!args.tenantId && !args.tenantName && defaultMatches.length === 1) {
    return { user, tenant: defaultMatches[0].tenant, membership: defaultMatches[0] };
  }

  const options = matches.map((membership) => `  - ${formatTenant(membership.tenant)} role=${membership.role} default=${membership.isDefault}`);
  throw new Error(`Multiple tenants matched ${args.email}. Re-run with --tenant-id or --tenant-name:\n${options.join('\n')}`);
}

async function findTenantDirectly(args) {
  const where = {};

  if (args.tenantId) {
    where.id = args.tenantId;
  }

  if (args.tenantName) {
    where.name = { [Op.iLike]: args.tenantName };
  }

  const tenants = await Tenant.findAll({
    where,
    attributes: ['id', 'name', 'slug', 'status'],
    order: [['createdAt', 'ASC']],
  });

  if (tenants.length === 0) {
    throw new Error('No tenant found with the provided tenant filter.');
  }

  if (tenants.length > 1) {
    const options = tenants.map((tenant) => `  - ${formatTenant(tenant)} status=${tenant.status}`);
    throw new Error(`Multiple tenants matched. Re-run with --tenant-id:\n${options.join('\n')}`);
  }

  return { tenant: tenants[0] };
}

async function resolveTenant(args) {
  if (args.email) {
    return findTenantByEmail(args);
  }

  if (args.tenantId || args.tenantName) {
    return findTenantDirectly(args);
  }

  throw new Error('Provide --email, --tenant-id, or --tenant-name.');
}

async function countWhere(Model, where, options = {}) {
  if (!Model) return 0;
  return Model.count({ where, ...options });
}

async function collectTenantProductState(tenantId, options = {}) {
  const products = await Product.findAll({
    where: { tenantId },
    attributes: ['id'],
    ...options,
  });

  const productIds = getIds(products);
  const productWhere = productIds.length ? { productId: productIds } : { productId: '__none__' };
  const variantRows = productIds.length
    ? await ProductVariant.findAll({ where: productWhere, attributes: ['id'], ...options })
    : [];
  const variantIds = getIds(variantRows);

  const counts = {
    products: productIds.length,
    variants: variantIds.length,
    onlineListings: productIds.length
      ? await countWhere(OnlineProductListing, { tenantId, productId: productIds }, options)
      : 0,
    barcodes: productIds.length
      ? await countWhere(Barcode, {
        tenantId,
        [Op.or]: [
          { productId: productIds },
          ...(variantIds.length ? [{ productVariantId: variantIds }] : []),
        ],
      }, options)
      : 0,
    saleItems: productIds.length
      ? await countWhere(SaleItem, {
        [Op.or]: [
          { productId: productIds },
          ...(variantIds.length ? [{ productVariantId: variantIds }] : []),
        ],
      }, options)
      : 0,
    quoteItems: productIds.length
      ? await countWhere(QuoteItem, { tenantId, productId: productIds }, options)
      : 0,
    stockCountItems: productIds.length
      ? await countWhere(StockCountItem, {
        tenantId,
        [Op.or]: [
          { productId: productIds },
          ...(variantIds.length ? [{ productVariantId: variantIds }] : []),
        ],
      }, options)
      : 0,
    stockTransfers: productIds.length
      ? await countWhere(StockTransfer, {
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
      }, options)
      : 0,
  };

  return { productIds, variantIds, counts };
}

function printCounts(counts) {
  console.log('\nDry-run counts:');
  console.log(`  Products:                 ${counts.products}`);
  console.log(`  Product variants:         ${counts.variants}`);
  console.log(`  Online product listings:  ${counts.onlineListings}`);
  console.log(`  Barcodes:                 ${counts.barcodes}`);
  console.log('');
  console.log('Protected/history references:');
  console.log(`  Sale items:               ${counts.saleItems}`);
  console.log(`  Quote items:              ${counts.quoteItems}`);
  console.log(`  Stock count items:        ${counts.stockCountItems}`);
  console.log(`  Stock transfers:          ${counts.stockTransfers}`);
}

function assertExecuteAllowed(args, counts) {
  if (!args.execute) return;

  if (!args.confirmDelete) {
    throw new Error('Execution requires --confirm-delete.');
  }

  const blockers = [];
  if (counts.saleItems > 0 && !args.deleteSaleItems) blockers.push(`${counts.saleItems} sale_items`);
  if (counts.quoteItems > 0 && !args.detachQuoteItems) blockers.push(`${counts.quoteItems} quote_items`);
  if (counts.stockCountItems > 0 && !args.deleteStockHistory) blockers.push(`${counts.stockCountItems} stock_count_items`);
  if (counts.stockTransfers > 0 && !args.deleteStockHistory) blockers.push(`${counts.stockTransfers} stock_transfers`);

  if (blockers.length > 0) {
    throw new Error(`${PROTECTED_HISTORY_MESSAGE}\nBlocking references: ${blockers.join(', ')}`);
  }
}

async function destroyWhere(Model, where, options, label) {
  const count = await Model.destroy({ where, ...options });
  console.log(`  Deleted ${count} ${label}`);
  return count;
}

async function deleteTenantProducts(tenantId, args) {
  await sequelize.transaction(async (transaction) => {
    const options = { transaction };
    const { productIds, variantIds, counts } = await collectTenantProductState(tenantId, options);
    assertExecuteAllowed(args, counts);

    if (productIds.length === 0) {
      console.log('\nNo products found. Nothing to delete.');
      return;
    }

    const linkedProducts = { productId: productIds };
    const linkedProductsOrVariants = {
      [Op.or]: [
        { productId: productIds },
        ...(variantIds.length ? [{ productVariantId: variantIds }] : []),
      ],
    };

    console.log('\nDeleting tenant product catalog rows...');

    if (args.deleteSaleItems && counts.saleItems > 0) {
      await destroyWhere(SaleItem, linkedProductsOrVariants, options, 'sale_items');
    }

    if (args.detachQuoteItems && counts.quoteItems > 0) {
      const [affectedRows] = await QuoteItem.update(
        { productId: null },
        { where: { tenantId, ...linkedProducts }, ...options },
      );
      console.log(`  Detached ${affectedRows} quote_items`);
    }

    if (args.deleteStockHistory) {
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

    await destroyWhere(Barcode, { tenantId, ...linkedProductsOrVariants }, options, 'barcodes');
    await destroyWhere(OnlineProductListing, { tenantId, ...linkedProducts }, options, 'online_product_listings');
    await destroyWhere(ProductVariant, linkedProducts, options, 'product_variants');
    await destroyWhere(Product, { tenantId, id: productIds }, options, 'products');
  });
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

  const { user, tenant, membership } = await resolveTenant(args);

  console.log('\nResolved target:');
  if (user) {
    console.log(`  User:   ${user.name} <${user.email}> (${user.id})`);
    console.log(`  Role:   ${membership.role}`);
  }
  console.log(`  Tenant: ${formatTenant(tenant)}`);
  console.log(`  Status: ${tenant.status}`);

  const { counts } = await collectTenantProductState(tenant.id);
  printCounts(counts);

  if (!args.execute) {
    console.log('\nDRY RUN ONLY. No rows were deleted.');
    console.log('To execute, re-run with --execute --confirm-delete after reviewing the counts.');
    return;
  }

  assertExecuteAllowed(args, counts);
  await deleteTenantProducts(tenant.id, args);

  console.log('\nDone. Tenant product deletion completed.');
}

run()
  .catch((error) => {
    console.error('\nError:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
