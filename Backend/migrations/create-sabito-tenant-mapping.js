const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const createSabitoTenantMapping = async () => {
  console.log('🔗 Creating Sabito tenant mapping table...');

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sabito_tenant_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sabito_business_id VARCHAR(255) NOT NULL UNIQUE,
        nexpro_tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        business_name VARCHAR(255),
        metadata JSONB DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sabito_tenant_mappings_sabito_business_id_idx 
      ON sabito_tenant_mappings(sabito_business_id);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sabito_tenant_mappings_nexpro_tenant_id_idx 
      ON sabito_tenant_mappings(nexpro_tenant_id);
    `);

    console.log('✅ Sabito tenant mapping table created successfully');
  } catch (error) {
    console.error('❌ Error creating mapping table:', error);
    throw error;
  }
};

createSabitoTenantMapping()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });




