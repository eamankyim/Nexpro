/**
 * Migration: Customer email/phone unique per branch (studio location or shop),
 * tenant-wide when neither scope column is set.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const tryUniqueIndex = async (name, sql) => {
  try {
    await sequelize.query(sql);
    return true;
  } catch (e) {
    if (
      e.code === '23505' ||
      e.parent?.code === '23505' ||
      e.message?.includes('duplicate key') ||
      e.name === 'SequelizeUniqueConstraintError'
    ) {
      console.warn(
        `  ⚠️  Skipped ${name}: duplicate values exist in scope. Resolve duplicates and re-run to enforce.`
      );
      return false;
    }
    throw e;
  }
};

const dropIndexIfExists = async (indexName) => {
  try {
    await sequelize.query(`DROP INDEX IF EXISTS "${indexName}";`);
  } catch (e) {
    if (!e.message?.includes('does not exist')) throw e;
  }
};

const fixCustomerUniquenessPerScope = async () => {
  console.log('🔄 Fixing customer email/phone uniqueness to be per branch...\n');

  try {
    console.log('  ➡️  Backfilling customers.studioLocationId for studio tenants...');
    await sequelize.query(`
      UPDATE customers c
      SET "studioLocationId" = sl.id
      FROM studio_locations sl
      WHERE c."tenantId" = sl."tenantId"
        AND sl."isDefault" = true
        AND c."studioLocationId" IS NULL;
    `);
    await sequelize.query(`
      UPDATE customers c
      SET "studioLocationId" = sl.id
      FROM (
        SELECT DISTINCT ON ("tenantId") id, "tenantId"
        FROM studio_locations
        WHERE "isActive" = true
        ORDER BY "tenantId", "isDefault" DESC, "createdAt" ASC
      ) sl
      WHERE c."tenantId" = sl."tenantId" AND c."studioLocationId" IS NULL;
    `);

    console.log('  ➡️  Backfilling customers.shopId where missing...');
    await sequelize.query(`
      UPDATE customers c
      SET "shopId" = s.id
      FROM shops s
      WHERE c."tenantId" = s."tenantId"
        AND s."isDefault" = true
        AND c."shopId" IS NULL;
    `);
    await sequelize.query(`
      UPDATE customers c
      SET "shopId" = s.id
      FROM (
        SELECT DISTINCT ON ("tenantId") id, "tenantId"
        FROM shops
        WHERE "isActive" = true
        ORDER BY "tenantId", "isDefault" DESC, "createdAt" ASC
      ) s
      WHERE c."tenantId" = s."tenantId" AND c."shopId" IS NULL;
    `);

    console.log('  ➡️  Replacing tenant-wide customer contact indexes...');
    await dropIndexIfExists('idx_customers_tenant_email_unique');
    await dropIndexIfExists('idx_customers_tenant_phone_unique');

    await tryUniqueIndex('customers_studio_email', `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_studio_email_unique
      ON customers ("tenantId", "studioLocationId", LOWER(TRIM(email)))
      WHERE "studioLocationId" IS NOT NULL
        AND email IS NOT NULL AND TRIM(email) != '';
    `);
    await tryUniqueIndex('customers_studio_phone', `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_studio_phone_unique
      ON customers ("tenantId", "studioLocationId", TRIM(phone))
      WHERE "studioLocationId" IS NOT NULL
        AND phone IS NOT NULL AND TRIM(phone) != '';
    `);

    await tryUniqueIndex('customers_shop_email', `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_shop_email_unique
      ON customers ("tenantId", "shopId", LOWER(TRIM(email)))
      WHERE "shopId" IS NOT NULL
        AND email IS NOT NULL AND TRIM(email) != '';
    `);
    await tryUniqueIndex('customers_shop_phone', `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_shop_phone_unique
      ON customers ("tenantId", "shopId", TRIM(phone))
      WHERE "shopId" IS NOT NULL
        AND phone IS NOT NULL AND TRIM(phone) != '';
    `);

    await tryUniqueIndex('customers_no_scope_email', `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_email_no_scope_unique
      ON customers ("tenantId", LOWER(TRIM(email)))
      WHERE "studioLocationId" IS NULL AND "shopId" IS NULL
        AND email IS NOT NULL AND TRIM(email) != '';
    `);
    await tryUniqueIndex('customers_no_scope_phone', `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_phone_no_scope_unique
      ON customers ("tenantId", TRIM(phone))
      WHERE "studioLocationId" IS NULL AND "shopId" IS NULL
        AND phone IS NOT NULL AND TRIM(phone) != '';
    `);

    console.log('\n✅ Customer contact uniqueness is now per branch (studio/shop) or tenant-wide when unscoped.');
  } catch (error) {
    console.error('❌ fix-customer-uniqueness-per-scope failed:', error.message);
    throw error;
  }
};

if (require.main === module) {
  fixCustomerUniquenessPerScope()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = fixCustomerUniquenessPerScope;
