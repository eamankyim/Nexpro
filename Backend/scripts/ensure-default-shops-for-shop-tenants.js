/**
 * One-off: create a default (main) shop for shop tenants that have none.
 * Safe to run multiple times.
 *
 * Usage: node scripts/ensure-default-shops-for-shop-tenants.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');
const { Tenant, Shop } = require('../models');
const { resolveBusinessType } = require('../config/businessTypes');
const { ensureDefaultShop } = require('../utils/shopUtils');

async function main() {
  await testConnection();

  const tenants = await Tenant.findAll({
    where: { businessType: 'shop' },
    attributes: ['id', 'name', 'businessType', 'metadata'],
  });

  let created = 0;
  let promoted = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    if (resolveBusinessType(tenant.businessType) !== 'shop') {
      skipped += 1;
      continue;
    }

    const before = await Shop.count({ where: { tenantId: tenant.id } });
    const shop = await ensureDefaultShop(tenant.id, { name: tenant.name, source: 'backfill' });
    const after = await Shop.count({ where: { tenantId: tenant.id } });

    if (after > before) created += 1;
    else if (shop?.isDefault) promoted += 1;
    else skipped += 1;
  }

  console.log('Done.');
  console.log('  shop tenants:', tenants.length);
  console.log('  new default shops:', created);
  console.log('  existing (ensured default flag):', promoted);
  console.log('  skipped:', skipped);

  await sequelize.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
