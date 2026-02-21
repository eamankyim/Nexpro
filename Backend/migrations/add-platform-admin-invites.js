/**
 * Allow platform admin invites: inviteType column and tenantId nullable.
 * When inviteType = 'platform_admin', tenantId is null and invite is for Control Panel.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

async function up() {
  await sequelize.query(`
    ALTER TABLE invite_tokens
    ADD COLUMN IF NOT EXISTS "inviteType" VARCHAR(20) NOT NULL DEFAULT 'tenant';
  `);
  await sequelize.query(`
    ALTER TABLE invite_tokens ALTER COLUMN "tenantId" DROP NOT NULL;
  `);
}

async function down() {
  await sequelize.query(`
    UPDATE invite_tokens SET "tenantId" = (SELECT id FROM tenants LIMIT 1) WHERE "tenantId" IS NULL;
  `);
  await sequelize.query(`
    ALTER TABLE invite_tokens ALTER COLUMN "tenantId" SET NOT NULL;
  `);
  await sequelize.query(`
    ALTER TABLE invite_tokens DROP COLUMN IF EXISTS "inviteType";
  `);
}

const run = async () => {
  try {
    console.log('Running add-platform-admin-invites migration...');
    await up();
    console.log('Done.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

run();
