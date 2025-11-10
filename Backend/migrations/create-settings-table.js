const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createSettingsTable = async () => {
  console.log('🚀 Starting settings schema migration...');
  let transaction;

  try {
    console.log('🔐 Ensuring pgcrypto extension is available...');
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    transaction = await sequelize.transaction();

    console.log('🗂️ Creating settings table if needed...');
    await sequelize.query(
      `
        CREATE TABLE IF NOT EXISTS settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key VARCHAR(100) UNIQUE NOT NULL,
          value JSONB NOT NULL DEFAULT '{}'::jsonb,
          description TEXT,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `,
      { transaction }
    );

    await sequelize.query(
      `
        ALTER TABLE settings
          ALTER COLUMN "createdAt" SET DEFAULT NOW(),
          ALTER COLUMN "updatedAt" SET DEFAULT NOW();
      `,
      { transaction }
    );

    await sequelize.query(
      `
        UPDATE settings
        SET "createdAt" = COALESCE("createdAt", NOW()),
            "updatedAt" = COALESCE("updatedAt", NOW())
        WHERE "createdAt" IS NULL OR "updatedAt" IS NULL;
      `,
      { transaction }
    );

    console.log('📊 Creating index on settings key...');
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS settings_key_idx ON settings(key);`, { transaction });

    console.log('🌱 Seeding default settings...');
    await sequelize.query(
      `
        INSERT INTO settings (id, key, value, description, "createdAt", "updatedAt")
        VALUES
          (
            gen_random_uuid(),
            'organization',
            '{"name":"Nexus Printing Press","legalName":"Nexus Printing Press Ltd.","email":"info@nexuspress.com","phone":"+233-000-0000","website":"https://nexuspress.com","logoUrl":"","address":{"line1":"123 Printing Ave","city":"Accra","state":"Greater Accra","country":"Ghana","postalCode":"GA-000-0000"},"tax":{"vatNumber":"","tin":""},"invoiceFooter":"Thank you for doing business with us."}'::jsonb,
            'Default organization profile',
            NOW(),
            NOW()
          )
        ON CONFLICT (key) DO NOTHING;
      `,
      { transaction }
    );

    await transaction.commit();
    console.log('✅ Settings schema migration completed successfully!');
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('💥 Settings schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createSettingsTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createSettingsTable;

