const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const createPlatformAdminRoles = async () => {
  let transaction;
  
  try {
    console.log('🚀 Starting platform admin roles migration...\n');
    
    await testConnection();
    transaction = await sequelize.transaction();
    
    // Step 1: Create platform_admin_roles table
    console.log('📋 Creating platform_admin_roles table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS platform_admin_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        department VARCHAR(100) NOT NULL,
        description TEXT,
        is_default BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });
    console.log('   ✅ Created platform_admin_roles table');
    
    // Step 2: Create platform_admin_permissions table
    console.log('📋 Creating platform_admin_permissions table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS platform_admin_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });
    console.log('   ✅ Created platform_admin_permissions table');
    
    // Step 3: Create platform_admin_role_permissions junction table
    console.log('📋 Creating platform_admin_role_permissions table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS platform_admin_role_permissions (
        "roleId" UUID NOT NULL REFERENCES platform_admin_roles(id) ON DELETE CASCADE,
        "permissionId" UUID NOT NULL REFERENCES platform_admin_permissions(id) ON DELETE CASCADE,
        PRIMARY KEY ("roleId", "permissionId")
      );
    `, { transaction });
    console.log('   ✅ Created platform_admin_role_permissions table');
    
    // Step 4: Create platform_admin_user_roles junction table
    console.log('📋 Creating platform_admin_user_roles table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS platform_admin_user_roles (
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "roleId" UUID NOT NULL REFERENCES platform_admin_roles(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("userId", "roleId")
      );
    `, { transaction });
    console.log('   ✅ Created platform_admin_user_roles table');
    
    // Step 5: Create indexes
    console.log('📋 Creating indexes...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS platform_admin_roles_department_idx 
      ON platform_admin_roles(department);
    `, { transaction });
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS platform_admin_permissions_category_idx 
      ON platform_admin_permissions(category);
    `, { transaction });
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS platform_admin_user_roles_user_idx 
      ON platform_admin_user_roles("userId");
    `, { transaction });
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS platform_admin_user_roles_role_idx 
      ON platform_admin_user_roles("roleId");
    `, { transaction });
    
    console.log('   ✅ Created indexes');
    
    // Step 6: Insert default permissions
    console.log('📋 Inserting default permissions...');
    const permissions = [
      // Overview
      { key: 'overview.view', name: 'View Overview', description: 'View platform overview dashboard', category: 'overview' },
      
      // Tenants
      { key: 'tenants.view', name: 'View Tenants', description: 'View tenant list and details', category: 'tenants' },
      { key: 'tenants.create', name: 'Create Tenants', description: 'Create new tenants', category: 'tenants' },
      { key: 'tenants.update', name: 'Update Tenants', description: 'Update tenant information', category: 'tenants' },
      { key: 'tenants.delete', name: 'Delete Tenants', description: 'Delete tenants', category: 'tenants' },
      { key: 'tenants.manage_status', name: 'Manage Tenant Status', description: 'Activate, pause, or suspend tenants', category: 'tenants' },
      
      // Leads
      { key: 'leads.view', name: 'View Leads', description: 'View admin leads', category: 'leads' },
      { key: 'leads.manage', name: 'Manage Leads', description: 'Create, update, and delete admin leads', category: 'leads' },
      
      // Jobs
      { key: 'jobs.view', name: 'View Jobs', description: 'View admin jobs', category: 'jobs' },
      { key: 'jobs.manage', name: 'Manage Jobs', description: 'Create, update, and delete admin jobs', category: 'jobs' },
      
      // Billing
      { key: 'billing.view', name: 'View Billing', description: 'View billing information', category: 'billing' },
      { key: 'billing.manage', name: 'Manage Billing', description: 'Manage billing and subscriptions', category: 'billing' },
      
      // Reports
      { key: 'reports.view', name: 'View Reports', description: 'View platform reports', category: 'reports' },
      
      // Health
      { key: 'health.view', name: 'View System Health', description: 'View system health and status', category: 'health' },
      
      // Settings
      { key: 'settings.view', name: 'View Settings', description: 'View platform settings', category: 'settings' },
      { key: 'settings.manage', name: 'Manage Settings', description: 'Update platform settings', category: 'settings' },
      
      // Users
      { key: 'users.view', name: 'View Platform Admins', description: 'View platform admin users', category: 'users' },
      { key: 'users.manage', name: 'Manage Platform Admins', description: 'Create, update, and delete platform admin users', category: 'users' },
      
      // Roles
      { key: 'roles.view', name: 'View Roles', description: 'View platform admin roles', category: 'roles' },
      { key: 'roles.manage', name: 'Manage Roles', description: 'Create, update, and delete roles, assign permissions', category: 'roles' },
    ];
    
    for (const perm of permissions) {
      await sequelize.query(`
        INSERT INTO platform_admin_permissions (key, name, description, category)
        VALUES (:key, :name, :description, :category)
        ON CONFLICT (key) DO NOTHING;
      `, {
        replacements: perm,
        transaction
      });
    }
    console.log(`   ✅ Inserted ${permissions.length} permissions`);
    
    // Step 7: Insert default roles
    console.log('📋 Inserting default roles...');
    const roles = [
      {
        name: 'Operations',
        department: 'Operations',
        description: 'Full access to all platform features',
        is_default: true
      },
      {
        name: 'Marketing',
        department: 'Marketing',
        description: 'Access to leads, reports, and tenant overview',
        is_default: false
      },
      {
        name: 'Engineering',
        department: 'Engineering',
        description: 'Access to jobs, system health, and tenant overview',
        is_default: false
      },
      {
        name: 'Sales',
        department: 'Sales',
        description: 'Access to leads, tenants, billing, and reports',
        is_default: false
      },
      {
        name: 'Support',
        department: 'Support',
        description: 'Access to tenants and system health',
        is_default: false
      },
      {
        name: 'Finance',
        department: 'Finance',
        description: 'Access to billing, reports, and tenant overview',
        is_default: false
      }
    ];
    
    const rolePermissionMap = {
      'Operations': [
        'overview.view', 'tenants.view', 'tenants.create', 'tenants.update', 'tenants.delete', 'tenants.manage_status',
        'leads.view', 'leads.manage', 'jobs.view', 'jobs.manage',
        'billing.view', 'billing.manage', 'reports.view', 'health.view',
        'settings.view', 'settings.manage', 'users.view', 'users.manage',
        'roles.view', 'roles.manage'
      ],
      'Marketing': [
        'overview.view', 'tenants.view', 'leads.view', 'leads.manage', 'reports.view'
      ],
      'Engineering': [
        'overview.view', 'tenants.view', 'jobs.view', 'jobs.manage', 'health.view'
      ],
      'Sales': [
        'overview.view', 'tenants.view', 'leads.view', 'leads.manage', 'billing.view', 'reports.view'
      ],
      'Support': [
        'overview.view', 'tenants.view', 'health.view'
      ],
      'Finance': [
        'overview.view', 'tenants.view', 'billing.view', 'billing.manage', 'reports.view'
      ]
    };
    
    for (const role of roles) {
      const [roleResult] = await sequelize.query(`
        INSERT INTO platform_admin_roles (name, department, description, is_default)
        VALUES (:name, :department, :description, :is_default)
        ON CONFLICT (name) DO NOTHING
        RETURNING id;
      `, {
        replacements: role,
        transaction
      });
      
      if (roleResult && roleResult.length > 0) {
        const roleId = roleResult[0].id;
        const permissionKeys = rolePermissionMap[role.name] || [];
        
        if (permissionKeys.length > 0) {
          await sequelize.query(`
            INSERT INTO platform_admin_role_permissions ("roleId", "permissionId")
            SELECT :roleId, id
            FROM platform_admin_permissions
            WHERE key IN (:permissionKeys);
          `, {
            replacements: {
              roleId,
              permissionKeys
            },
            transaction
          });
        }
      }
    }
    console.log(`   ✅ Inserted ${roles.length} roles with permissions`);
    
    // Step 8: Assign Operations role to all existing platform admins
    console.log('📋 Assigning Operations role to existing platform admins...');
    const [operationsRole] = await sequelize.query(`
      SELECT id FROM platform_admin_roles WHERE name = 'Operations' LIMIT 1;
    `, { transaction });
    
    if (operationsRole && operationsRole.length > 0) {
      const operationsRoleId = operationsRole[0].id;
      await sequelize.query(`
        INSERT INTO platform_admin_user_roles ("userId", "roleId")
        SELECT id, :roleId
        FROM users
        WHERE "isPlatformAdmin" = true
        AND id NOT IN (SELECT "userId" FROM platform_admin_user_roles WHERE "roleId" = :roleId);
      `, {
        replacements: { roleId: operationsRoleId },
        transaction
      });
      console.log('   ✅ Assigned Operations role to existing platform admins');
    }
    
    await transaction.commit();
    console.log('\n✅ Platform admin roles migration completed successfully!');
    console.log('📊 Created roles: Operations, Marketing, Engineering, Sales, Support, Finance\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    await sequelize.close();
    process.exit(1);
  }
};

// Run the migration if called directly
if (require.main === module) {
  createPlatformAdminRoles();
}

module.exports = createPlatformAdminRoles;
