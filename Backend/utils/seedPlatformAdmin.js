const { sequelize, testConnection } = require('../config/database');
const { User, Tenant, UserTenant } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
require('dotenv').config();

/**
 * Seed platform admin (superadmin) for control center
 * Platform admins can manage all tenants and have access to control center features
 */

const seedPlatformAdmin = async () => {
  try {
    console.log('👑 Starting platform admin seed...\n');
    
    // Test and establish database connection
    await testConnection();
    
    const transaction = await sequelize.transaction();
    
    try {
      const targetEmail = 'superadmin@nexpro.com';
      
      // Check if platform admin already exists
      const existingPlatformAdmin = await User.findOne({ 
        where: { isPlatformAdmin: true },
        transaction 
      });
      
      let platformAdmin;
      
      if (existingPlatformAdmin) {
        // Platform admin exists - check if email needs to be updated
        if (existingPlatformAdmin.email !== targetEmail) {
          // Check if target email is already taken by another user
          const emailTaken = await User.findOne({
            where: { 
              email: targetEmail,
              id: { [Op.ne]: existingPlatformAdmin.id }
            },
            transaction
          });
          
          if (emailTaken) {
            throw new Error(`Email ${targetEmail} is already taken by another user.`);
          }
          
          // Update existing platform admin email
          existingPlatformAdmin.email = targetEmail;
          existingPlatformAdmin.name = 'Eric Amankyim';
          existingPlatformAdmin.role = 'admin';
          existingPlatformAdmin.isActive = true;
          await existingPlatformAdmin.save({ transaction });
          platformAdmin = existingPlatformAdmin;
          console.log('♻️ Updated existing platform admin email to:', targetEmail);
        } else {
          // Email is correct, just ensure other fields are set
          existingPlatformAdmin.name = 'Eric Amankyim';
          existingPlatformAdmin.role = 'admin';
          existingPlatformAdmin.isActive = true;
          await existingPlatformAdmin.save({ transaction });
          platformAdmin = existingPlatformAdmin;
          console.log('♻️ Platform admin already exists with correct email.');
        }
      } else {
        // No platform admin exists - check if user with target email exists
        const existingUser = await User.findOne({ 
          where: { email: targetEmail },
          transaction 
        });
        
        if (existingUser) {
          // Update existing user to be platform admin
          existingUser.name = 'Eric Amankyim';
          existingUser.isPlatformAdmin = true;
          existingUser.role = 'admin';
          existingUser.isActive = true;
          await existingUser.save({ transaction });
          platformAdmin = existingUser;
          console.log('♻️ Updated existing user to platform admin.');
        } else {
          // Create new platform admin
          platformAdmin = await User.create({
            name: 'Eric Amankyim',
            email: targetEmail,
            password: '199855@EricAdmin',
            role: 'admin',
            isPlatformAdmin: true,
            isActive: true,
            isFirstLogin: false
          }, { transaction });
          
          console.log('✅ Platform admin user created successfully!');
        }
      }
      
      // Ensure platform admin has access to default tenant
      const [defaultTenant] = await Tenant.findOrCreate({
        where: { slug: 'default' },
        defaults: {
          name: 'Default Tenant',
          plan: 'trial',
          status: 'active',
          metadata: {},
          trialEndsAt: dayjs().add(1, 'month').toDate()
        },
        transaction
      });
      
      // Check if platform admin is already linked to default tenant
      const existingMembership = await UserTenant.findOne({
        where: { 
          userId: platformAdmin.id, 
          tenantId: defaultTenant.id 
        },
        transaction
      });
      
      if (!existingMembership) {
        await UserTenant.create({
          userId: platformAdmin.id,
          tenantId: defaultTenant.id,
          role: 'owner',
          status: 'active',
          isDefault: true,
          joinedAt: new Date()
        }, { transaction });
        
        console.log('✅ Linked platform admin to default tenant.');
      }
      
      await transaction.commit();
      
      console.log('\n👑 Platform Admin Credentials:');
      console.log('   Name: Eric Amankyim');
      console.log('   Email: superadmin@nexpro.com');
      console.log('   Password: 199855@EricAdmin');
      console.log('   Role: Platform Admin (Superadmin)');
      console.log('\n🎯 Platform Admin Capabilities:');
      console.log('   ✅ Access to Control Center');
      console.log('   ✅ Manage all tenants');
      console.log('   ✅ View platform-wide analytics');
      console.log('   ✅ Manage platform settings');
      console.log('   ✅ Create/manage other platform admins');
      console.log('\n⚠️  IMPORTANT: Change the password after first login!');
      console.log('\n🎉 Platform admin is ready for Control Center!\n');
      
      await sequelize.close();
      process.exit(0);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('❌ Error seeding platform admin:', error);
    await sequelize.close();
    process.exit(1);
  }
};

// Run seeder
if (require.main === module) {
  seedPlatformAdmin();
}

module.exports = { seedPlatformAdmin };

