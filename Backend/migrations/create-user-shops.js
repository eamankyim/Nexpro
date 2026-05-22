const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Junction table: which shops a workspace user can access (retail tenants).
 */
const createUserShops = async () => {
  const isDirect = require.main === module;
  try {
    console.log('Creating user_shops table if needed...\n');
    if (isDirect) await testConnection();

    const tables = await sequelize.query(
      `
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND lower(table_name) = 'user_shops';
    `,
      { type: QueryTypes.SELECT }
    );

    if (tables.length > 0) {
      console.log('user_shops table already exists, skipping');
      return;
    }

    await sequelize.query(`
      CREATE TABLE user_shops (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "shopId" UUID NOT NULL REFERENCES shops(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT user_shops_user_shop_unique UNIQUE ("userId", "shopId")
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS user_shops_user_tenant_idx ON user_shops("userId", "tenantId");
      CREATE INDEX IF NOT EXISTS user_shops_shop_idx ON user_shops("shopId");
    `);

    console.log('user_shops table created');
  } catch (error) {
    console.error('create-user-shops migration failed:', error);
    throw error;
  }
};

module.exports = createUserShops;

if (require.main === module) {
  createUserShops()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
