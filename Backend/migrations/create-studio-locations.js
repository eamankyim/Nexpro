const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');
const { resolveBusinessType } = require('../config/businessTypes');

const createStudioLocations = async () => {
  console.log('🚀 Starting studio locations migration...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`, { transaction });

    console.log('🏢 Creating studio_locations table...');
    await sequelize.query(
      `
      CREATE TABLE IF NOT EXISTS studio_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        "studioType" VARCHAR(100),
        code VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Ghana',
        "postalCode" VARCHAR(20),
        phone VARCHAR(50),
        email VARCHAR(255),
        "managerName" VARCHAR(255),
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
      { transaction }
    );

    await sequelize.query(
      `
      CREATE INDEX IF NOT EXISTS studio_locations_tenant_idx ON studio_locations("tenantId");
      CREATE UNIQUE INDEX IF NOT EXISTS studio_locations_tenant_code_unique
        ON studio_locations("tenantId", code) WHERE code IS NOT NULL;
    `,
      { transaction }
    );

    console.log('👤 Creating user_studio_locations table...');
    await sequelize.query(
      `
      CREATE TABLE IF NOT EXISTS user_studio_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "studioLocationId" UUID NOT NULL REFERENCES studio_locations(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT user_studio_locations_user_location_unique UNIQUE ("userId", "studioLocationId")
      );
    `,
      { transaction }
    );

    await sequelize.query(
      `
      CREATE INDEX IF NOT EXISTS user_studio_locations_user_tenant_idx
        ON user_studio_locations("userId", "tenantId");
      CREATE INDEX IF NOT EXISTS user_studio_locations_location_idx
        ON user_studio_locations("studioLocationId");
    `,
      { transaction }
    );

    const tables = ['customers', 'jobs', 'quotes', 'invoices'];
    for (const table of tables) {
      console.log(`📎 Adding studioLocationId to ${table}...`);
      await sequelize.query(
        `
        ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS "studioLocationId" UUID REFERENCES studio_locations(id)
          ON UPDATE CASCADE ON DELETE SET NULL;
      `,
        { transaction }
      );
      await sequelize.query(
        `
        CREATE INDEX IF NOT EXISTS ${table}_studio_location_idx ON ${table}("studioLocationId");
      `,
        { transaction }
      );
    }

    await sequelize.query(
      `
      ALTER TABLE invite_tokens
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    `,
      { transaction }
    );

    console.log('🌱 Backfilling default studio location per studio tenant...');
    const [tenants] = await sequelize.query(
      `SELECT id, name, "businessType", metadata FROM tenants WHERE status != 'deleted'`,
      { transaction }
    );

    for (const tenant of tenants || []) {
      if (resolveBusinessType(tenant.businessType) !== 'studio') continue;

      const [[existing]] = await sequelize.query(
        `SELECT id FROM studio_locations WHERE "tenantId" = :tenantId LIMIT 1`,
        { replacements: { tenantId: tenant.id }, transaction }
      );
      if (existing?.id) continue;

      const [inserted] = await sequelize.query(
        `
        INSERT INTO studio_locations ("tenantId", name, "studioType", "isDefault", "isActive", "createdAt", "updatedAt")
        VALUES (:tenantId, :name, :studioType, true, true, NOW(), NOW())
        RETURNING id;
      `,
        {
          replacements: {
            tenantId: tenant.id,
            name: tenant.name || 'Main studio',
            studioType: tenant.metadata?.studioType || tenant.metadata?.businessSubType || null,
          },
          transaction,
        }
      );
      const locationId = inserted?.[0]?.id;
      if (!locationId) continue;

      for (const table of tables) {
        await sequelize.query(
          `
          UPDATE ${table}
          SET "studioLocationId" = :locationId
          WHERE "tenantId" = :tenantId AND "studioLocationId" IS NULL;
        `,
          { replacements: { locationId, tenantId: tenant.id }, transaction }
        );
      }

      const [owners] = await sequelize.query(
        `
        SELECT "userId" FROM user_tenants
        WHERE "tenantId" = :tenantId AND status = 'active' AND role IN ('owner', 'admin');
      `,
        { replacements: { tenantId: tenant.id }, transaction }
      );

      for (const row of owners || []) {
        await sequelize.query(
          `
          INSERT INTO user_studio_locations ("userId", "tenantId", "studioLocationId", "createdAt", "updatedAt")
          VALUES (:userId, :tenantId, :locationId, NOW(), NOW())
          ON CONFLICT ("userId", "studioLocationId") DO NOTHING;
        `,
          { replacements: { userId: row.userId, tenantId: tenant.id, locationId }, transaction }
        );
      }
    }

    await transaction.commit();
    console.log('✅ Studio locations migration completed.');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Studio locations migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createStudioLocations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createStudioLocations;
