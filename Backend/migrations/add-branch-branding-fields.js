const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Per-shop/studio branding: manager user reference and logo for invoices/receipts.
 */
const addBranchBrandingFields = async () => {
  console.log('🚀 Adding branch branding fields (managerUserId, logoUrl)...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(
      `
      ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS "managerUserId" UUID REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL;
    `,
      { transaction }
    );
    await sequelize.query(
      `
      ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
    `,
      { transaction }
    );
    await sequelize.query(
      `
      CREATE INDEX IF NOT EXISTS shops_manager_user_idx ON shops("managerUserId");
    `,
      { transaction }
    );

    await sequelize.query(
      `
      ALTER TABLE studio_locations
      ADD COLUMN IF NOT EXISTS "managerUserId" UUID REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL;
    `,
      { transaction }
    );
    await sequelize.query(
      `
      ALTER TABLE studio_locations
      ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
    `,
      { transaction }
    );
    await sequelize.query(
      `
      CREATE INDEX IF NOT EXISTS studio_locations_manager_user_idx
        ON studio_locations("managerUserId");
    `,
      { transaction }
    );

    await transaction.commit();
    console.log('✅ Branch branding fields migration completed.');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Branch branding fields migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  addBranchBrandingFields()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addBranchBrandingFields;
