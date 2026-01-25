const { sequelize, testConnection } = require('../config/database');
const { User } = require('../models');
require('dotenv').config();

const resetSuperadminPassword = async () => {
  try {
    console.log('🔐 Resetting superadmin password...\n');
    
    // Test and establish database connection
    await testConnection();
    
    const superadminEmail = 'superadmin@nexpro.com';
    const newPassword = '111111@1A';
    
    // Find the superadmin user
    let superadmin = await User.findOne({ 
      where: { 
        email: superadminEmail 
      } 
    });
    
    if (!superadmin) {
      // Try to find any platform admin
      superadmin = await User.findOne({ 
        where: { 
          isPlatformAdmin: true 
        },
        order: [['createdAt', 'ASC']]
      });
      
      if (!superadmin) {
        console.log('❌ Superadmin user not found.');
        console.log('\n💡 Creating new superadmin user...\n');
        superadmin = await User.create({
          name: 'Super Admin',
          email: superadminEmail,
          password: newPassword,
          role: 'admin',
          isActive: true,
          isPlatformAdmin: true,
          isFirstLogin: false
        });
        console.log('✅ Superadmin user created successfully!');
      } else {
        console.log(`⚠️  Found platform admin with email: ${superadmin.email}`);
        console.log(`   Updating email to ${superadminEmail} and resetting password...\n`);
        superadmin.email = superadminEmail;
        superadmin.password = newPassword;
        superadmin.role = 'admin';
        superadmin.isActive = true;
        superadmin.isPlatformAdmin = true;
        await superadmin.save();
        console.log('✅ Superadmin email updated and password reset!');
      }
    } else {
      // Reset password for existing superadmin
      superadmin.password = newPassword;
      await superadmin.save();
      console.log('✅ Superadmin password reset successfully!');
    }
    
    console.log('\n📧 Login Credentials:');
    console.log(`   Email: ${superadmin.email}`);
    console.log(`   Password: ${newPassword}`);
    console.log(`   Role: ${superadmin.role}`);
    console.log(`   Platform Admin: ${superadmin.isPlatformAdmin ? 'Yes' : 'No'}`);
    console.log('\n🎉 Password has been updated!\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting superadmin password:', error);
    await sequelize.close();
    process.exit(1);
  }
};

resetSuperadminPassword();
