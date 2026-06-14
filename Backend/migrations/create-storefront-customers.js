const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const createStorefrontCustomers = async (options = {}) => {
  const { closeConnection = false } = options;
  const isDirect = require.main === module;
  try {
    console.log('🔄 Creating storefront customer accounts table...');
    if (isDirect) await testConnection();

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS storefront_customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(160) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(40) NULL,
        password VARCHAR(255) NOT NULL,
        google_id VARCHAR(255) NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "emailVerifiedAt" TIMESTAMPTZ NULL,
        "lastLoginAt" TIMESTAMPTZ NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`ALTER TABLE storefront_customers ALTER COLUMN "isActive" SET DEFAULT true;`);
    await sequelize.query(`ALTER TABLE storefront_customers ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) NULL;`);
    await sequelize.query(`ALTER TABLE storefront_customers ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMPTZ NULL;`);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_storefront_customers_email_lower ON storefront_customers (LOWER(email));`);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_storefront_customers_google_id ON storefront_customers (google_id) WHERE google_id IS NOT NULL;`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_storefront_customers_phone ON storefront_customers (phone);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_storefront_customers_active ON storefront_customers ("isActive");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_storefront_customers_email_verified_at ON storefront_customers ("emailVerifiedAt");`);

    console.log('✅ Storefront customer accounts table ready.');
  } catch (error) {
    console.error('❌ create-storefront-customers failed:', error);
    throw error;
  } finally {
    if (isDirect || closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
};

if (require.main === module) {
  createStorefrontCustomers({ closeConnection: true })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createStorefrontCustomers;
