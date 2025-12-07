const { sequelize, testConnection } = require('../config/database');
const { User } = require('../models');
require('dotenv').config();

const resetAdminPassword = async () => {
  try {
    console.log('🔐 Resetting admin password...\n');
    
    // Test and establish database connection
    await testConnection();
    
    // Priority 1: Find admin@printingpress.com (preferred email)
    let admin = await User.findOne({ where: { email: 'admin@printingpress.com' } });
    
    if (admin) {
      // Reset password for admin@printingpress.com
      admin.password = '111111@1A';
      await admin.save();
      console.log('✅ Admin password reset successfully!');
    } else {
      // Priority 2: Check if any admin exists, update email if found
      let existingAdmin = await User.findOne({ 
        where: { 
          role: 'admin'
        },
        order: [['createdAt', 'ASC']]
      });
      
      // If still not found, try platform admin
      if (!existingAdmin) {
        existingAdmin = await User.findOne({ 
          where: { 
            isPlatformAdmin: true
          }
        });
      }
      
      if (existingAdmin) {
        // Update existing admin to use admin@printingpress.com
        console.log(`⚠️  Found admin with email: ${existingAdmin.email}`);
        console.log('   Updating email to admin@printingpress.com and resetting password...\n');
        existingAdmin.email = 'admin@printingpress.com';
        existingAdmin.password = '111111@1A';
        existingAdmin.role = 'admin';
        existingAdmin.isActive = true;
        existingAdmin.isPlatformAdmin = true;
        await existingAdmin.save();
        admin = existingAdmin;
        console.log('✅ Admin email updated and password reset!');
      } else {
        // Create new admin@printingpress.com
        console.log('⚠️  Admin user not found. Creating new admin user...\n');
        admin = await User.create({
          name: 'Admin User',
          email: 'admin@printingpress.com',
          password: '111111@1A',
          role: 'admin',
          isActive: true,
          isFirstLogin: false,
          isPlatformAdmin: true
        });
        console.log('✅ Admin user created successfully!');
      }
    }
    
    console.log('\n📧 Login Credentials:');
    console.log(`   Email: ${admin.email}`);
    console.log('   Password: 111111@1A');
    console.log('\n🎉 Password has been updated!\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting admin password:', error);
    await sequelize.close();
    process.exit(1);
  }
};

resetAdminPassword();

