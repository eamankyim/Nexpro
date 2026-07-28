/**
 * Soft-reset Online Store merchant setup so mobile/web treat tenants as
 * "no store yet" (checklist.hasSettings === false).
 *
 * WHAT THIS TOUCHES
 * - Deletes rows from `online_store_settings` only (default).
 * - Optional: also deletes `online_product_listings` / `online_service_listings`
 *   for the same tenant(s) via `--also-listings` (does NOT delete catalog products).
 *
 * WHAT THIS NEVER TOUCHES
 * - tenants, users, products, shops, sales/orders, Sabito marketplace tables
 * - online_store_hero_* library (platform templates)
 *
 * WHY
 * Mobile Online Store welcome gates on GET /store/setup-status →
 * checklist.hasSettings = Boolean(settings?.id). Removing the settings row
 * makes welcome show again. Listings are independent (tenantId FK only).
 *
 * SAFETY
 * - Dry-run by default (lists matching rows, no writes).
 * - Writes require `--execute --confirm-delete`.
 * - Non-localhost DATABASE_URL also requires `--allow-non-local-db`.
 * - Production host (canonical) refuses unless `--i-understand-production` is set.
 *
 * Usage (from Backend/):
 *   node scripts/reset-online-store-settings.js
 *   node scripts/reset-online-store-settings.js --all
 *   node scripts/reset-online-store-settings.js --tenant-id <uuid>
 *   node scripts/reset-online-store-settings.js --email user@example.com
 *   node scripts/reset-online-store-settings.js --all --execute --confirm-delete --allow-non-local-db
 *   node scripts/reset-online-store-settings.js --all --also-listings --execute --confirm-delete --allow-non-local-db
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { Op } = require('sequelize');
const {
  getDatabaseHost,
  isProductionDatabaseUrl,
  isDemoCanonicalDatabaseUrl,
  PRODUCTION_DB_HOST,
  DEMO_CANONICAL_DB_HOST,
} = require('../config/canonicalDatabase');
const { sequelize, testConnection } = require('../config/database');
const {
  User,
  Tenant,
  UserTenant,
  OnlineStoreSettings,
  OnlineProductListing,
  OnlineServiceListing,
} = require('../models');

function parseArgs(argv) {
  const args = {
    execute: false,
    confirmDelete: false,
    allowNonLocalDb: false,
    understandProduction: false,
    alsoListings: false,
    all: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    const next = argv[i + 1];

    if (value === '--all') {
      args.all = true;
    } else if (value === '--execute') {
      args.execute = true;
    } else if (value === '--confirm-delete') {
      args.confirmDelete = true;
    } else if (value === '--allow-non-local-db') {
      args.allowNonLocalDb = true;
    } else if (value === '--i-understand-production') {
      args.understandProduction = true;
    } else if (value === '--also-listings') {
      args.alsoListings = true;
    } else if (value === '--tenant-id') {
      args.tenantId = next;
      i += 1;
    } else if (value === '--email') {
      args.email = next;
      i += 1;
    } else if (value === '--help' || value === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${value}`);
    }
  }

  if (args.email) args.email = String(args.email).trim().toLowerCase();
  if (args.tenantId) args.tenantId = String(args.tenantId).trim();
  return args;
}

function printHelp() {
  console.log(`
reset-online-store-settings.js

Soft-reset Online Store settings so hasSettings becomes false (welcome shows again).

Default mode: dry-run (list only).

Filters (pick one; default is --all when listing):
  --all
  --tenant-id <uuid>
  --email <user@example.com>

Flags:
  --also-listings              Also delete online product/service listings for those tenants
  --execute --confirm-delete   Perform deletes
  --allow-non-local-db         Required when DATABASE_URL is not localhost
  --i-understand-production    Required when DATABASE_URL is production Neon host

Examples:
  node scripts/reset-online-store-settings.js
  node scripts/reset-online-store-settings.js --all --execute --confirm-delete --allow-non-local-db
`);
}

function formatDbTarget() {
  const host = getDatabaseHost(process.env.DATABASE_URL);
  if (!host) return '[DATABASE_URL not set or unparseable]';
  try {
    const url = new URL(String(process.env.DATABASE_URL).replace(/^postgresql:/, 'postgres:'));
    return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}${url.pathname}`;
  } catch {
    return host;
  }
}

function isLocalDatabaseUrl() {
  const host = getDatabaseHost(process.env.DATABASE_URL);
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

async function resolveTenantIds(args) {
  if (args.tenantId) {
    const tenant = await Tenant.findByPk(args.tenantId, { attributes: ['id', 'name'] });
    if (!tenant) throw new Error(`No tenant found for --tenant-id ${args.tenantId}`);
    return [{ id: tenant.id, name: tenant.name }];
  }

  if (args.email) {
    const user = await User.findOne({
      where: { email: args.email },
      attributes: ['id', 'email'],
    });
    if (!user) throw new Error(`No user found for --email ${args.email}`);
    const memberships = await UserTenant.findAll({
      where: { userId: user.id },
      attributes: ['tenantId'],
    });
    const tenantIds = memberships.map((m) => m.tenantId);
    if (!tenantIds.length) throw new Error(`User ${args.email} has no tenant memberships`);
    const tenants = await Tenant.findAll({
      where: { id: { [Op.in]: tenantIds } },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    return tenants.map((t) => ({ id: t.id, name: t.name }));
  }

  // --all or default list scope: any tenant that has settings (resolved from rows later)
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.all && !args.tenantId && !args.email) {
    // Default to listing everything (dry-run friendly)
    args.all = true;
  }

  if ((args.tenantId ? 1 : 0) + (args.email ? 1 : 0) + (args.all ? 1 : 0) > 1) {
    throw new Error('Use only one of --all, --tenant-id, or --email');
  }

  if (args.execute && !args.confirmDelete) {
    throw new Error('Writes require --execute --confirm-delete');
  }
  if (args.execute && !isLocalDatabaseUrl() && !args.allowNonLocalDb) {
    throw new Error(
      'Refusing to write to a non-local DATABASE_URL. Use localhost or pass --allow-non-local-db.'
    );
  }
  if (args.execute && isProductionDatabaseUrl(process.env.DATABASE_URL) && !args.understandProduction) {
    throw new Error(
      `Refusing to write to production host (${PRODUCTION_DB_HOST}). Pass --i-understand-production if intentional.`
    );
  }

  await testConnection();

  const dbTarget = formatDbTarget();
  const host = getDatabaseHost(process.env.DATABASE_URL);
  const envLabel = isProductionDatabaseUrl(process.env.DATABASE_URL)
    ? 'PRODUCTION'
    : isDemoCanonicalDatabaseUrl(process.env.DATABASE_URL)
      ? 'DEMO_CANONICAL'
      : isLocalDatabaseUrl()
        ? 'LOCAL'
        : 'REMOTE_OTHER';

  console.log('=== reset-online-store-settings ===');
  console.log(`DB target:  ${dbTarget}`);
  console.log(`DB class:   ${envLabel}${host ? ` (${host})` : ''}`);
  console.log(`Mode:       ${args.execute ? 'EXECUTE (will delete)' : 'DRY-RUN (list only)'}`);
  console.log(`Also listings: ${args.alsoListings ? 'yes' : 'no (settings only)'}`);
  console.log(`Expected demo host: ${DEMO_CANONICAL_DB_HOST}`);
  console.log(`Expected prod host: ${PRODUCTION_DB_HOST}`);
  console.log('');

  const scopedTenants = await resolveTenantIds(args);
  const where = scopedTenants
    ? { tenantId: { [Op.in]: scopedTenants.map((t) => t.id) } }
    : {};

  const rows = await OnlineStoreSettings.findAll({
    where,
    attributes: [
      'id',
      'tenantId',
      'shopId',
      'studioLocationId',
      'slug',
      'displayName',
      'enabled',
      'setupCompletedAt',
      'customDomain',
      'createdAt',
    ],
    order: [['createdAt', 'DESC']],
    raw: true,
  });

  const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
  const tenants = tenantIds.length
    ? await Tenant.findAll({
      where: { id: { [Op.in]: tenantIds } },
      attributes: ['id', 'name'],
      raw: true,
    })
    : [];
  const tenantNameById = new Map(tenants.map((t) => [t.id, t.name]));

  let productListingCount = 0;
  let serviceListingCount = 0;
  if (tenantIds.length) {
    productListingCount = await OnlineProductListing.count({
      where: { tenantId: { [Op.in]: tenantIds } },
    });
    serviceListingCount = await OnlineServiceListing.count({
      where: { tenantId: { [Op.in]: tenantIds } },
    });
  }

  console.log(`online_store_settings rows matched: ${rows.length}`);
  console.log(`tenants affected: ${tenantIds.length}`);
  console.log(`online_product_listings (same tenants): ${productListingCount}`);
  console.log(`online_service_listings (same tenants): ${serviceListingCount}`);
  console.log('');

  if (!rows.length) {
    console.log('Nothing to delete. hasSettings is already false for the selected scope.');
    await sequelize.close();
    return;
  }

  rows.forEach((row, index) => {
    const name = tenantNameById.get(row.tenantId) || '(unknown tenant)';
    console.log(
      `  ${index + 1}. ${row.displayName} / ${row.slug}` +
      ` | tenant=${name} (${row.tenantId})` +
      ` | enabled=${row.enabled}` +
      ` | launchedAt=${row.setupCompletedAt || 'null'}` +
      ` | id=${row.id}`
    );
  });
  console.log('');

  if (!args.execute) {
    console.log('Dry-run complete. No rows deleted.');
    console.log('To delete settings only:');
    console.log(
      '  node scripts/reset-online-store-settings.js --all --execute --confirm-delete --allow-non-local-db'
    );
    if (envLabel === 'PRODUCTION') {
      console.log('  (add --i-understand-production for production Neon)');
    }
    await sequelize.close();
    return;
  }

  await sequelize.transaction(async (transaction) => {
    if (args.alsoListings && tenantIds.length) {
      const deletedProducts = await OnlineProductListing.destroy({
        where: { tenantId: { [Op.in]: tenantIds } },
        transaction,
      });
      const deletedServices = await OnlineServiceListing.destroy({
        where: { tenantId: { [Op.in]: tenantIds } },
        transaction,
      });
      console.log(`Deleted online_product_listings: ${deletedProducts}`);
      console.log(`Deleted online_service_listings: ${deletedServices}`);
    }

    const deletedSettings = await OnlineStoreSettings.destroy({
      where: { id: { [Op.in]: rows.map((r) => r.id) } },
      transaction,
    });
    console.log(`Deleted online_store_settings: ${deletedSettings}`);
  });

  console.log('');
  console.log('Done. Verify: GET /store/setup-status → checklist.hasSettings should be false.');
  console.log('Mobile: pull-to-refresh Store tab (or clear React Query cache) to see OnlineStoreWelcome.');
  await sequelize.close();
}

main().catch(async (error) => {
  console.error('FAILED:', error.message || error);
  try {
    await sequelize.close();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
