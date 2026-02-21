/**
 * Migration: Add expenses.manage permission to platform admin
 * Enables creating expenses in the Control Panel for Operations and Finance roles
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const addExpensesManagePermission = async () => {
  try {
    console.log('📋 Adding expenses.manage permission to platform admin...');

    await sequelize.query(`
      INSERT INTO platform_admin_permissions (key, name, description, category)
      VALUES (
        'expenses.manage',
        'Manage Expenses',
        'Create and manage platform-wide expenses across tenants',
        'expenses'
      )
      ON CONFLICT (key) DO NOTHING;
    `);

    await sequelize.query(`
      INSERT INTO platform_admin_role_permissions ("roleId", "permissionId")
      SELECT r.id, p.id
      FROM platform_admin_roles r
      CROSS JOIN platform_admin_permissions p
      WHERE p.key = 'expenses.manage'
        AND r.name IN ('Operations', 'Finance')
        AND NOT EXISTS (
          SELECT 1 FROM platform_admin_role_permissions rp
          WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
        );
    `);

    console.log('✅ Expenses manage permission added. Operations and Finance roles now have expenses.manage.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  addExpensesManagePermission()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = addExpensesManagePermission;
