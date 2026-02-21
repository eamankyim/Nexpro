const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createEquipmentTables = async () => {
  console.log('Creating equipment schema...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_equipment_status') THEN
          CREATE TYPE enum_equipment_status AS ENUM ('active', 'disposed', 'sold');
        END IF;
      END
      $$;
    `, { transaction });

    console.log('Creating equipment_categories table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS equipment_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT equipment_categories_tenant_name_unique UNIQUE ("tenantId", name)
      );
    `, { transaction });

    console.log('Creating equipment table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "categoryId" UUID REFERENCES equipment_categories(id) ON UPDATE CASCADE ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        "purchaseDate" DATE,
        "purchaseValue" NUMERIC(12,2) NOT NULL DEFAULT 0,
        location VARCHAR(255),
        "serialNumber" VARCHAR(255),
        status enum_equipment_status NOT NULL DEFAULT 'active',
        "vendorId" UUID REFERENCES vendors(id) ON UPDATE CASCADE ON DELETE SET NULL,
        notes TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    console.log('Creating indexes for equipment tables...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS equipment_categories_tenant_idx ON equipment_categories("tenantId");
      CREATE INDEX IF NOT EXISTS equipment_tenant_idx ON equipment("tenantId");
      CREATE INDEX IF NOT EXISTS equipment_category_idx ON equipment("categoryId");
      CREATE INDEX IF NOT EXISTS equipment_status_idx ON equipment(status);
      CREATE INDEX IF NOT EXISTS equipment_vendor_idx ON equipment("vendorId");
    `, { transaction });

    await transaction.commit();
    console.log('Equipment schema migration completed successfully.');
  } catch (error) {
    await transaction.rollback();
    console.error('Equipment schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createEquipmentTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createEquipmentTables;
