const { sequelize, testConnection } = require('../config/database');
const { User, UserTenant, Tenant } = require('../models');
require('dotenv').config();

const listUsers = async () => {
  try {
    console.log('🔍 Listing all users in the platform...\n');
    
    // Test and establish database connection
    await testConnection();
    
    // Get all users with their tenant memberships
    const users = await User.findAll({
      attributes: [
        'id',
        'name',
        'email',
        'role',
        'isActive',
        'isPlatformAdmin',
        'isFirstLogin',
        'lastLogin',
        'sabitoUserId',
        'createdAt',
        'updatedAt'
      ],
      include: [
        {
          model: UserTenant,
          as: 'tenantMemberships',
          required: false,
          include: [
            {
              model: Tenant,
              as: 'tenant',
              attributes: ['id', 'name', 'slug', 'plan', 'status', 'trialEndsAt']
            }
          ],
          attributes: ['role', 'status', 'isDefault', 'joinedAt']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    if (users.length === 0) {
      console.log('❌ No users found in the platform.\n');
      await sequelize.close();
      process.exit(0);
    }
    
    console.log(`✅ Found ${users.length} user(s) in the platform:\n`);
    console.log('='.repeat(100));
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.name} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.isActive ? '✅ Active' : '❌ Inactive'}`);
      console.log(`   Platform Admin: ${user.isPlatformAdmin ? '✅ Yes' : '❌ No'}`);
      console.log(`   First Login: ${user.isFirstLogin ? '⚠️  Yes (not logged in yet)' : '✅ No'}`);
      if (user.lastLogin) {
        console.log(`   Last Login: ${new Date(user.lastLogin).toLocaleString()}`);
      } else {
        console.log(`   Last Login: Never`);
      }
      if (user.sabitoUserId) {
        console.log(`   Sabito User ID: ${user.sabitoUserId}`);
      }
      console.log(`   Created: ${new Date(user.createdAt).toLocaleString()}`);
      
      // Show tenant memberships
      if (user.tenantMemberships && user.tenantMemberships.length > 0) {
        console.log(`   Tenant Memberships (${user.tenantMemberships.length}):`);
        user.tenantMemberships.forEach((membership, idx) => {
          const tenant = membership.tenant;
          const defaultBadge = membership.isDefault ? ' [DEFAULT]' : '';
          const statusBadge = membership.status === 'active' ? '✅' : '❌';
          console.log(`      ${idx + 1}. ${tenant ? tenant.name : 'Unknown'} (${tenant ? tenant.id : 'N/A'})${defaultBadge}`);
          console.log(`         Role: ${membership.role} | Status: ${statusBadge} ${membership.status}`);
          if (tenant) {
            console.log(`         Plan: ${tenant.plan || 'N/A'} | Tenant Status: ${tenant.status || 'N/A'}`);
            if (tenant.trialEndsAt) {
              console.log(`         Trial Ends: ${new Date(tenant.trialEndsAt).toLocaleString()}`);
            }
          }
          console.log(`         Joined: ${new Date(membership.joinedAt).toLocaleString()}`);
        });
      } else {
        console.log(`   Tenant Memberships: ❌ None`);
      }
      
      console.log('-'.repeat(100));
    });
    
    // Summary statistics
    console.log('\n📊 Summary Statistics:');
    console.log(`   Total Users: ${users.length}`);
    console.log(`   Active Users: ${users.filter(u => u.isActive).length}`);
    console.log(`   Inactive Users: ${users.filter(u => !u.isActive).length}`);
    console.log(`   Platform Admins: ${users.filter(u => u.isPlatformAdmin).length}`);
    console.log(`   Admins: ${users.filter(u => u.role === 'admin').length}`);
    console.log(`   Managers: ${users.filter(u => u.role === 'manager').length}`);
    console.log(`   Staff: ${users.filter(u => u.role === 'staff').length}`);
    console.log(`   Users with Tenant Memberships: ${users.filter(u => u.tenantMemberships && u.tenantMemberships.length > 0).length}`);
    console.log(`   Users without Tenant Memberships: ${users.filter(u => !u.tenantMemberships || u.tenantMemberships.length === 0).length}`);
    console.log(`   Users who have logged in: ${users.filter(u => u.lastLogin).length}`);
    console.log(`   Users who haven't logged in: ${users.filter(u => !u.lastLogin).length}`);
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error listing users:', error);
    await sequelize.close();
    process.exit(1);
  }
};

listUsers();
