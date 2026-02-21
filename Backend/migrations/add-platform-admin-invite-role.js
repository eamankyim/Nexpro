/**
 * Add platformAdminRoleName to invite_tokens for platform admin invites.
 * Ensure platform_admin_roles has: Marketing, Operations, Customer service, Developer, Media.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const ROLES_TO_ADD = [
  { name: 'Customer service', department: 'Support', description: 'Access to tenants and customer support', is_default: false },
  { name: 'Developer', department: 'Engineering', description: 'Access to jobs, system health, and tenant overview', is_default: false },
  { name: 'Media', department: 'Media', description: 'Access to overview and media-related features', is_default: false }
];

async function up() {
  await sequelize.query(`
    ALTER TABLE invite_tokens
    ADD COLUMN IF NOT EXISTS "platformAdminRoleName" VARCHAR(100);
  `);

  for (const role of ROLES_TO_ADD) {
    await sequelize.query(
      `INSERT INTO platform_admin_roles (id, name, department, description, is_default, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), :name, :department, :description, :is_default, NOW(), NOW())
       ON CONFLICT (name) DO NOTHING;`,
      {
        replacements: {
          name: role.name,
          department: role.department,
          description: role.description,
          is_default: role.is_default
        }
      }
    );
  }
}

async function down() {
  await sequelize.query(`
    ALTER TABLE invite_tokens DROP COLUMN IF EXISTS "platformAdminRoleName";
  `);
}

const run = async () => {
  try {
    console.log('Running add-platform-admin-invite-role migration...');
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
