const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Platform IT Ops vault: assets, secret reveal audit, OTP challenges + ops.view permission.
 * @param {{ closeConnection?: boolean }} [options]
 */
const createPlatformOpsAssets = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('Starting platform ops assets migration...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS platform_ops_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        "expiresOn" DATE NULL,
        "loginUrl" TEXT NULL,
        username VARCHAR(255) NULL,
        "passwordEncrypted" TEXT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        notes TEXT NULL,
        "createdBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        "updatedBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS platform_ops_assets_type_idx
        ON platform_ops_assets (type);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS platform_ops_assets_status_idx
        ON platform_ops_assets (status);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS platform_ops_assets_expires_on_idx
        ON platform_ops_assets ("expiresOn");
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS platform_ops_secret_reveals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "assetId" UUID NOT NULL REFERENCES platform_ops_assets(id) ON DELETE CASCADE ON UPDATE CASCADE,
        "requestedBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        method VARCHAR(20) NOT NULL,
        success BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS platform_ops_secret_reveals_asset_idx
        ON platform_ops_secret_reveals ("assetId", "createdAt" DESC);
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS platform_ops_reveal_challenges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "assetId" UUID NOT NULL REFERENCES platform_ops_assets(id) ON DELETE CASCADE ON UPDATE CASCADE,
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        "codeHash" VARCHAR(255) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "consumedAt" TIMESTAMP WITH TIME ZONE NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS platform_ops_reveal_challenges_user_asset_idx
        ON platform_ops_reveal_challenges ("userId", "assetId", "expiresAt");
    `, { transaction });

    await sequelize.query(`
      INSERT INTO platform_admin_permissions (key, name, description, category)
      VALUES (
        'ops.view',
        'View IT Ops Vault',
        'View and manage platform IT ops assets (domains, servers, services)',
        'ops'
      )
      ON CONFLICT (key) DO NOTHING;
    `, { transaction });

    await sequelize.query(`
      INSERT INTO platform_admin_role_permissions ("roleId", "permissionId")
      SELECT r.id, p.id
      FROM platform_admin_roles r
      CROSS JOIN platform_admin_permissions p
      WHERE p.key = 'ops.view'
        AND r.name IN ('Operations', 'Engineering')
        AND NOT EXISTS (
          SELECT 1 FROM platform_admin_role_permissions rp
          WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
        );
    `, { transaction });

    await transaction.commit();
    console.log('Platform ops assets migration completed.');
  } catch (error) {
    await transaction.rollback();
    console.error('Platform ops assets migration failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      await sequelize.close().catch(() => {});
    }
  }
};

if (require.main === module) {
  createPlatformOpsAssets()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = createPlatformOpsAssets;
module.exports.up = createPlatformOpsAssets;
