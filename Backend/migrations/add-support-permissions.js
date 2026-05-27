/**
 * Add support tickets and tenant support-access permissions for platform admins.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const PERMISSIONS = [
  {
    key: 'tickets.view',
    name: 'View Support Tickets',
    description: 'View support tickets in Control Center',
    category: 'support',
  },
  {
    key: 'tickets.manage',
    name: 'Manage Support Tickets',
    description: 'Create and update support tickets',
    category: 'support',
  },
  {
    key: 'tenants.support_access',
    name: 'Tenant Support Access',
    description: 'Start read-only support sessions in tenant workspaces',
    category: 'tenants',
  },
];

async function up() {
  for (const perm of PERMISSIONS) {
    await sequelize.query(
      `
      INSERT INTO platform_admin_permissions (key, name, description, category)
      VALUES (:key, :name, :description, :category)
      ON CONFLICT (key) DO NOTHING;
    `,
      { replacements: perm }
    );
  }

  const roleNames = ['Operations', 'Support'];
  const permissionKeys = PERMISSIONS.map((p) => p.key);

  for (const roleName of roleNames) {
    for (const permKey of permissionKeys) {
      await sequelize.query(
        `
        INSERT INTO platform_admin_role_permissions ("roleId", "permissionId")
        SELECT r.id, p.id
        FROM platform_admin_roles r
        CROSS JOIN platform_admin_permissions p
        WHERE r.name = :roleName AND p.key = :permKey
          AND NOT EXISTS (
            SELECT 1 FROM platform_admin_role_permissions rp
            WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
          );
      `,
        { replacements: { roleName, permKey } }
      );
    }
  }

  console.log('Support permissions added for Operations and Support roles.');
}

if (require.main === module) {
  up()
    .then(() => {
      console.log('Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = up;
