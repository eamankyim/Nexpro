#!/usr/bin/env node
/**
 * Add 3 quantity to every product in Sulas Enterprise's main/default shop.
 *
 * Safety model:
 * - Dry run by default
 * - Requires --execute and --confirm-stock-increment for real writes
 * - Defaults to --tenant-name "Sulas Enterprise"
 * - Resolves tenant by --tenant-id, --tenant-slug, --tenant-name, or --email membership
 * - Resolves the main/default shop unless --shop-id or --shop-name is provided
 * - Updates products.quantityOnHand only; no stock movement/history rows are created
 *
 * Usage (from Backend/):
 *   npm run stock:increment-sulas-main-shop
 *   npm run stock:increment-sulas-main-shop -- --tenant-name "Sulas Enterprise"
 *   npm run stock:increment-sulas-main-shop -- --email owner@example.com --tenant-name "Sulas Enterprise"
 *   npm run stock:increment-sulas-main-shop -- --shop-name "Main shop"
 *
 * Execute after reviewing dry-run output:
 *   npm run stock:increment-sulas-main-shop -- --execute --confirm-stock-increment
 */
require('dotenv').config();

const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { User, UserTenant, Tenant, Product, Shop } = require('../models');
const { ensureDefaultShop } = require('../utils/shopUtils');

const DEFAULT_TENANT_NAME = 'Sulas Enterprise';
const STOCK_INCREMENT = 3;
const SAMPLE_LIMIT = 12;
const VALUE_FLAGS = new Set([
  '--email',
  '--tenant-id',
  '--tenant-slug',
  '--tenant-name',
  '--shop-id',
  '--shop-name',
]);
const BOOLEAN_FLAGS = new Set([
  '--execute',
  '--confirm-stock-increment',
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
const shouldConfirm = hasFlag('--confirm-stock-increment');
const email = normalizeEmail(getArgValue('--email', ''));
const explicitTenantId = normalizeText(getArgValue('--tenant-id', '')) || null;
const tenantSlug = normalizeText(getArgValue('--tenant-slug', '')) || null;
const tenantName = normalizeText(getArgValue('--tenant-name', DEFAULT_TENANT_NAME)) || DEFAULT_TENANT_NAME;
const explicitShopId = normalizeText(getArgValue('--shop-id', '')) || null;
const explicitShopName = normalizeText(getArgValue('--shop-name', '')) || null;

const USAGE = `
Usage:
  npm run stock:increment-sulas-main-shop -- [--tenant-name <name> | --tenant-slug <slug> | --tenant-id <uuid> | --email <user-email>] [--shop-id <uuid> | --shop-name <name>] [--execute --confirm-stock-increment]

Dry-run examples:
  npm run stock:increment-sulas-main-shop
  npm run stock:increment-sulas-main-shop -- --tenant-name "Sulas Enterprise"
  npm run stock:increment-sulas-main-shop -- --email owner@example.com --tenant-name "Sulas Enterprise"
  npm run stock:increment-sulas-main-shop -- --shop-name "Main shop"

Execute example:
  npm run stock:increment-sulas-main-shop -- --execute --confirm-stock-increment
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

function toFiniteNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function formatQuantity(value) {
  const number = toFiniteNumber(value);
  if (number === null) return 'invalid';
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function productLabel(product) {
  const code = product.sku || product.barcode;
  return `${product.name}${code ? ` (${code})` : ''}`;
}

function formatTenant(tenant) {
  return `${tenant.name} (${tenant.id})`;
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
    return { shop, action: 'existing-id' };
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
      matches.forEach((shop) => {
        console.error(`- ${shop.id} (${shop.name})${shop.isDefault ? ' default' : ''}`);
      });
      process.exit(1);
    }
    return { shop: matches[0], action: 'existing-name' };
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

async function loadProducts(tenantId, shopId, options = {}) {
  return Product.findAll({
    where: { tenantId, shopId },
    attributes: ['id', 'name', 'sku', 'barcode', 'quantityOnHand', 'trackStock', 'isActive', 'updatedAt'],
    order: [['name', 'ASC'], ['createdAt', 'ASC']],
    ...options,
  });
}

function planIncrement(products) {
  const toUpdate = [];
  const skipped = [];

  for (const productModel of products) {
    const product = productModel.get ? productModel.get({ plain: true }) : productModel;
    const oldQuantity = toFiniteNumber(product.quantityOnHand);
    if (oldQuantity === null) {
      skipped.push({ product, reason: `invalid quantityOnHand: ${product.quantityOnHand}` });
      continue;
    }

    toUpdate.push({
      product,
      oldQuantity,
      newQuantity: oldQuantity + STOCK_INCREMENT,
      adjustment: STOCK_INCREMENT,
    });
  }

  return { toUpdate, skipped };
}

function sumQuantity(rows, field) {
  return rows.reduce((sum, row) => sum + row[field], 0);
}

function printPlan(plan) {
  const beforeTotal = sumQuantity(plan.toUpdate, 'oldQuantity');
  const afterTotal = sumQuantity(plan.toUpdate, 'newQuantity');
  const untrackedCount = plan.toUpdate.filter((row) => row.product.trackStock === false).length;
  const inactiveCount = plan.toUpdate.filter((row) => row.product.isActive === false).length;

  console.log('\nPlan:');
  printSummary('Products found in shop', plan.toUpdate.length + plan.skipped.length);
  printSummary('Products to update', plan.toUpdate.length);
  printSummary('Products skipped', plan.skipped.length);
  printSummary('Increment per product', STOCK_INCREMENT);
  printSummary('Before quantity total', formatQuantity(beforeTotal));
  printSummary('After quantity total', formatQuantity(afterTotal));
  printSummary('Net quantity increase', formatQuantity(afterTotal - beforeTotal));
  printSummary('Track stock=false included', untrackedCount);
  printSummary('Inactive products included', inactiveCount);
  printSummary('Stock movement history', 'not recorded by this script');

  printRows('Sample updates', plan.toUpdate, (row) =>
    `${productLabel(row.product)}: ${formatQuantity(row.oldQuantity)} -> ${formatQuantity(row.newQuantity)}`
  );
  printRows('Skipped products', plan.skipped, (row) =>
    `${productLabel(row.product)} - ${row.reason}`
  );
}

async function executeIncrement(tenantId, shopId) {
  return sequelize.transaction(async (transaction) => {
    const products = await loadProducts(tenantId, shopId, {
      transaction,
      lock: true,
    });
    const plan = planIncrement(products);

    if (plan.skipped.length) {
      throw new Error(`Refusing to execute because ${plan.skipped.length} products have invalid quantityOnHand values.`);
    }

    for (const row of plan.toUpdate) {
      await Product.update(
        { quantityOnHand: row.newQuantity },
        { where: { id: row.product.id, tenantId, shopId }, transaction }
      );
    }

    return plan;
  });
}

async function main() {
  validateArgs();
  if (hasFlag('--help') || hasFlag('-h')) {
    console.log(USAGE);
    return;
  }

  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required');
  if (isExecute && !shouldConfirm) fail('Execute mode requires --confirm-stock-increment');

  console.log('\n=== Sulas Main Shop Stock Increment ===');
  printSummary('Mode', isDryRun ? 'DRY RUN' : 'EXECUTE');
  printSummary('Tenant selector', explicitTenantId || tenantSlug || tenantName);
  if (email) printSummary('Email', email);
  printSummary('Shop selector', explicitShopId || explicitShopName || 'default/main shop');
  printSummary('Increment per product', STOCK_INCREMENT);

  await testConnection();

  const { user, tenant, tenantId, membershipRole } = await resolveTenantTarget();
  const { shop, action: shopAction } = await resolveShop(tenantId);

  console.log('\nTarget:');
  if (user) printSummary('User', `${user.name || 'Unknown'} <${user.email}> (${user.id})`);
  printSummary('Tenant', `${tenant?.name || 'Unknown'} (${tenantId})`);
  printSummary('Tenant slug', tenant?.slug || 'none');
  printSummary('Tenant status', tenant?.status || 'unknown');
  printSummary('Business type', tenant?.businessType || 'unknown');
  if (membershipRole) printSummary('Membership role', membershipRole);
  printSummary('Shop', shop ? `${shop.name} (${shop.id})` : 'none resolved');
  printSummary('Shop resolution', shopAction);

  if (!shop) {
    if (isDryRun) {
      console.log('\nDry run note: execute mode would create/promote the tenant default shop before updating products.');
      return;
    }
    fail(`No main/default shop could be resolved for tenant ${tenantId}`);
  }

  const products = await loadProducts(tenantId, shop.id);
  const dryRunPlan = planIncrement(products);
  printPlan(dryRunPlan);

  if (isDryRun) {
    console.log('\nDry run complete. No database changes made.');
    console.log('To execute, re-run with --execute --confirm-stock-increment after reviewing the counts.');
    return;
  }

  const executionPlan = await executeIncrement(tenantId, shop.id);
  const beforeTotal = sumQuantity(executionPlan.toUpdate, 'oldQuantity');
  const afterTotal = sumQuantity(executionPlan.toUpdate, 'newQuantity');

  console.log('\nStock increment completed.');
  printSummary('Products updated', executionPlan.toUpdate.length);
  printSummary('Before quantity total', formatQuantity(beforeTotal));
  printSummary('After quantity total', formatQuantity(afterTotal));
  printSummary('Net quantity increase', formatQuantity(afterTotal - beforeTotal));
  console.log('\nNote: updated products.quantityOnHand only; no stock movement/history rows were created.');
}

main()
  .catch((error) => {
    console.error('\nStock increment failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (_error) {
      // Ignore close errors during CLI shutdown.
    }
  });
