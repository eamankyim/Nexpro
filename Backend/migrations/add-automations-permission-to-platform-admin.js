/**
 * Migration: Add automations.view permission for Control Center
 * Automations & Messaging observability for Operations, Engineering, Support
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const addAutomationsPermission = async () => {
  try {
    console.log('📋 Adding automations.view permission to platform admin...');

    await sequelize.query(`
      INSERT INTO platform_admin_permissions (key, name, description, category)
      VALUES (
        'automations.view',
        'View Automations & Messaging',
        'View cross-tenant automation rules, run KPIs, and messaging usage (no message bodies)',
        'automations'
      )
      ON CONFLICT (key) DO NOTHING;
    `);

    await sequelize.query(`
      INSERT INTO platform_admin_role_permissions ("roleId", "permissionId")
      SELECT r.id, p.id
      FROM platform_admin_roles r
      CROSS JOIN platform_admin_permissions p
      WHERE p.key = 'automations.view'
        AND r.name IN ('Operations', 'Engineering', 'Support')
        AND NOT EXISTS (
          SELECT 1 FROM platform_admin_role_permissions rp
          WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
        );
    `);

    console.log('✅ Automations permission added. Operations, Engineering, and Support have automations.view.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  addAutomationsPermission()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = addAutomationsPermission;
