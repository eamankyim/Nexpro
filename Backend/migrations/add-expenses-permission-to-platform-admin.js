/**
 * Migration: Add expenses.view permission to platform admin
 * Enables Expenses in the Control Panel for Operations and Finance roles
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const addExpensesPermission = async () => {
  try {
    console.log('📋 Adding expenses.view permission to platform admin...');

    await sequelize.query(`
      INSERT INTO platform_admin_permissions (key, name, description, category)
      VALUES (
        'expenses.view',
        'View Expenses',
        'View platform-wide expenses across all tenants',
        'expenses'
      )
      ON CONFLICT (key) DO NOTHING;
    `);

    await sequelize.query(`
      INSERT INTO platform_admin_role_permissions ("roleId", "permissionId")
      SELECT r.id, p.id
      FROM platform_admin_roles r
      CROSS JOIN platform_admin_permissions p
      WHERE p.key = 'expenses.view'
        AND r.name IN ('Operations', 'Finance')
        AND NOT EXISTS (
          SELECT 1 FROM platform_admin_role_permissions rp
          WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
        );
    `);

    console.log('✅ Expenses permission added. Operations and Finance roles now have expenses.view.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  addExpensesPermission()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = addExpensesPermission;
