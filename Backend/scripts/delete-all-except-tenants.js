/**
 * Deletes users, tenants, and business data for all tenants EXCEPT a keep-list.
 *
 * Usage (from Backend directory):
 *   KEEP_TENANT_SLUGS=my-business-zhfssm,my-business-3 DRY_RUN=true node scripts/delete-all-except-tenants.js
 *   KEEP_TENANT_SLUGS=my-business-zhfssm,my-business-3 CONFIRM_DELETE=yes node scripts/delete-all-except-tenants.js
 */
require('dotenv').config();

const { sequelize, testConnection } = require('../config/database');
const { Tenant, User } = require('../models');
const {
  deleteTenantData,
  deleteOrphanUsersWithoutTenants,
} = require('../utils/deleteTenantData');

function parseKeepSlugs() {
  const raw = process.env.KEEP_TENANT_SLUGS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isDryRun() {
  return String(process.env.DRY_RUN || '').toLowerCase() === 'true';
}

async function run() {
  const keepSlugs = parseKeepSlugs();
  const dryRun = isDryRun();

  if (!keepSlugs.length) {
    console.error('No keep-list provided. Set KEEP_TENANT_SLUGS=slug1,slug2');
    process.exit(1);
  }

  if (!dryRun && process.env.CONFIRM_DELETE !== 'yes') {
    console.error('This script deletes data permanently.');
    console.error('Set CONFIRM_DELETE=yes to run a real delete, or DRY_RUN=true for preview.');
    process.exit(1);
  }

  try {
    await testConnection();

    const tenants = await Tenant.findAll({
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'name', 'slug']
    });

    const keepSet = new Set(keepSlugs);
    const keepTenants = tenants.filter((t) => keepSet.has(t.slug));
    const deleteTenants = tenants.filter((t) => !keepSet.has(t.slug));

    const missing = keepSlugs.filter((slug) => !keepTenants.some((t) => t.slug === slug));
    if (missing.length) {
      console.error('These keep slugs were not found:', missing.join(', '));
      process.exit(1);
    }

    console.log(`Total tenants: ${tenants.length}`);
    console.log(`Keeping (${keepTenants.length}): ${keepTenants.map((t) => t.slug).join(', ')}`);
    console.log(`Deleting (${deleteTenants.length}): ${deleteTenants.map((t) => t.slug).join(', ')}`);

    if (dryRun) {
      console.log('DRY_RUN=true, no data deleted.');
      await sequelize.close();
      process.exit(0);
    }

    await sequelize.transaction(async (tx) => {
      for (const t of deleteTenants) {
        console.log(`Deleting tenant data: ${t.slug} (${t.id})...`);
        await deleteTenantData(t.id, tx);
      }

      await deleteOrphanUsersWithoutTenants(tx);
    });

    console.log('Done. All non-keep tenants and their data were deleted.');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

run();
