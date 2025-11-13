const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createTenantsSchema = async () => {
  console.log('🏢 Starting tenants schema migration...');

  let transaction;

  try {
    console.log('🔐 Ensuring pgcrypto extension is available...');
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    transaction = await sequelize.transaction();

    console.log('🗂️ Creating tenants table...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS tenants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(150) NOT NULL,
          slug VARCHAR(150) UNIQUE NOT NULL,
          description TEXT,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          plan VARCHAR(50) NOT NULL DEFAULT 'trial',
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          "trialEndsAt" TIMESTAMPTZ,
          "billingCustomerId" VARCHAR(255),
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      { transaction }
    );

    console.log('🛠️ Ensuring tenants.id has default UUID...');
    await sequelize.query(
      `
        ALTER TABLE tenants
        ALTER COLUMN id SET DEFAULT gen_random_uuid();
      `,
      { transaction }
    );

    console.log('⏱️ Ensuring tenants timestamps have defaults...');
    await sequelize.query(
      `
        ALTER TABLE tenants
        ALTER COLUMN "createdAt" SET DEFAULT NOW();
      `,
      { transaction }
    );
    await sequelize.query(
      `
        ALTER TABLE tenants
        ALTER COLUMN "updatedAt" SET DEFAULT NOW();
      `,
      { transaction }
    );

    console.log('📌 Ensuring tenants slug index exists...');
    await sequelize.query(
      `
        CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON tenants(slug);
      `,
      { transaction }
    );

    console.log('👥 Creating user_tenants join table...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS user_tenants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
          "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL DEFAULT 'member',
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          "isDefault" BOOLEAN NOT NULL DEFAULT false,
          "invitedBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
          "invitedAt" TIMESTAMPTZ,
          "joinedAt" TIMESTAMPTZ,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      { transaction }
    );

    console.log('🛠️ Ensuring user_tenants.id has default UUID...');
    await sequelize.query(
      `
        ALTER TABLE user_tenants
        ALTER COLUMN id SET DEFAULT gen_random_uuid();
      `,
      { transaction }
    );

    console.log('⏱️ Ensuring user_tenants timestamps have defaults...');
    await sequelize.query(
      `
        ALTER TABLE user_tenants
        ALTER COLUMN "createdAt" SET DEFAULT NOW();
      `,
      { transaction }
    );
    await sequelize.query(
      `
        ALTER TABLE user_tenants
        ALTER COLUMN "updatedAt" SET DEFAULT NOW();
      `,
      { transaction }
    );

    await sequelize.query(
      `
        CREATE UNIQUE INDEX IF NOT EXISTS user_tenants_unique_idx
        ON user_tenants("userId", "tenantId");
      `,
      { transaction }
    );

    console.log('🌱 Seeding default tenant if missing...');
    const [existingTenantRows] = await sequelize.query(
      `SELECT id FROM tenants WHERE slug = 'default' LIMIT 1;`,
      { transaction }
    );

    let defaultTenantId = existingTenantRows?.[0]?.id;

    if (!defaultTenantId) {
      const [insertedTenantRows] = await sequelize.query(
        `
          INSERT INTO tenants (name, slug, plan, status, metadata)
          VALUES ('Default Tenant', 'default', 'trial', 'active', '{}'::jsonb)
          RETURNING id;
        `,
        { transaction }
      );

      defaultTenantId = insertedTenantRows?.[0]?.id;
      console.log('✅ Default tenant created with ID:', defaultTenantId);
    } else {
      console.log('ℹ️ Default tenant already exists:', defaultTenantId);
    }

    if (defaultTenantId) {
      console.log('👤 Assigning admin users to default tenant as owners...');
      await sequelize.query(
        `
          INSERT INTO user_tenants ("userId", "tenantId", role, status, "isDefault", "joinedAt", metadata)
          SELECT id, :tenantId, 'owner', 'active', true, NOW(), '{}'::jsonb
          FROM users
          WHERE role = 'admin'
            AND id NOT IN (
              SELECT "userId" FROM user_tenants WHERE "tenantId" = :tenantId
            );
        `,
        {
          transaction,
          replacements: { tenantId: defaultTenantId }
        }
      );
    }

    await transaction.commit();
    console.log('🎉 Tenants schema migration completed successfully!');
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('💥 Tenants schema migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

createTenantsSchema();

