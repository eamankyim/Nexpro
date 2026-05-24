/**
 * Ensure every studio tenant has one reusable default studio location.
 * Safe to run multiple times.
 *
 * Usage:
 *   node scripts/ensure-default-studio-locations-for-studio-tenants.js --dry-run
 *   node scripts/ensure-default-studio-locations-for-studio-tenants.js --apply
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');
const { Tenant, StudioLocation } = require('../models');
const { resolveBusinessType } = require('../config/businessTypes');
const { ensureDefaultStudioLocation } = require('../utils/studioLocationUtils');

const isApply = process.argv.includes('--apply');
const isDryRun = process.argv.includes('--dry-run') || !isApply;

const getLocationState = async (tenantId, transaction = null) => {
  const opts = transaction ? { transaction } : {};
  const count = await StudioLocation.count({ where: { tenantId }, ...opts });
  const defaultCount = await StudioLocation.count({ where: { tenantId, isDefault: true }, ...opts });
  return { count, defaultCount };
};

const actionFor = ({ count, defaultCount }) => {
  if (defaultCount > 0) return 'reuse';
  if (count > 0) return 'promote';
  return 'create';
};

async function main() {
  await testConnection();
  console.log(`Mode: ${isApply ? 'APPLY' : 'DRY RUN'}\n`);

  const tenants = await Tenant.findAll({
    attributes: ['id', 'name', 'businessType', 'metadata'],
    order: [['createdAt', 'ASC']],
  });

  const summary = { create: 0, promote: 0, reuse: 0, skipped: 0 };

  for (const tenant of tenants) {
    if (resolveBusinessType(tenant.businessType) !== 'studio') {
      summary.skipped += 1;
      continue;
    }

    const before = await getLocationState(tenant.id);
    const plannedAction = actionFor(before);
    summary[plannedAction] += 1;

    if (isDryRun) {
      console.log(
        `[dry-run] ${tenant.name} (${tenant.id}) locations=${before.count} defaults=${before.defaultCount} action=${plannedAction}`
      );
      continue;
    }

    await sequelize.transaction(async (transaction) => {
      const location = await ensureDefaultStudioLocation(
        tenant.id,
        { name: tenant.name || 'Main studio', source: 'default-studio-location-backfill' },
        transaction
      );
      const after = await getLocationState(tenant.id, transaction);
      console.log(
        `[apply] ${tenant.name} (${tenant.id}) action=${plannedAction} defaultStudioLocationId=${location?.id || 'none'} locations=${after.count} defaults=${after.defaultCount}`
      );
    });
  }

  console.log('Done.');
  console.log('  would/create default studio locations:', summary.create);
  console.log('  would/promote existing locations:', summary.promote);
  console.log('  reused existing defaults:', summary.reuse);
  console.log('  skipped non-studio tenants:', summary.skipped);

  await sequelize.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
