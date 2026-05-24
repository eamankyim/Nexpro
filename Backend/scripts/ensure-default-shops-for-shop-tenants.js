/**
 * Ensure every shop tenant has one reusable default shop.
 * Safe to run multiple times.
 *
 * Usage:
 *   node scripts/ensure-default-shops-for-shop-tenants.js --dry-run
 *   node scripts/ensure-default-shops-for-shop-tenants.js --apply
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');
const { Tenant, Shop } = require('../models');
const { resolveBusinessType } = require('../config/businessTypes');
const { ensureDefaultShop } = require('../utils/shopUtils');

const isApply = process.argv.includes('--apply');
const isDryRun = process.argv.includes('--dry-run') || !isApply;

const getShopState = async (tenantId, transaction = null) => {
  const opts = transaction ? { transaction } : {};
  const count = await Shop.count({ where: { tenantId }, ...opts });
  const defaultCount = await Shop.count({ where: { tenantId, isDefault: true }, ...opts });
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
    if (resolveBusinessType(tenant.businessType) !== 'shop') {
      summary.skipped += 1;
      continue;
    }

    const before = await getShopState(tenant.id);
    const plannedAction = actionFor(before);
    summary[plannedAction] += 1;

    if (isDryRun) {
      console.log(
        `[dry-run] ${tenant.name} (${tenant.id}) shops=${before.count} defaults=${before.defaultCount} action=${plannedAction}`
      );
      continue;
    }

    await sequelize.transaction(async (transaction) => {
      const shop = await ensureDefaultShop(
        tenant.id,
        { name: tenant.name, source: 'default-shop-backfill' },
        transaction
      );
      const after = await getShopState(tenant.id, transaction);
      console.log(
        `[apply] ${tenant.name} (${tenant.id}) action=${plannedAction} defaultShopId=${shop?.id || 'none'} shops=${after.count} defaults=${after.defaultCount}`
      );
    });
  }

  console.log('Done.');
  console.log('  would/create default shops:', summary.create);
  console.log('  would/promote existing shops:', summary.promote);
  console.log('  reused existing defaults:', summary.reuse);
  console.log('  skipped non-shop tenants:', summary.skipped);

  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  sequelize.close().finally(() => process.exit(1));
});
