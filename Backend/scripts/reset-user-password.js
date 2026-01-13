const { sequelize } = require('../config/database');
const { User, UserTenant, Tenant } = require('../models');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const resetUserPassword = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.\n');

    // Target email
    const targetEmail = 'eamankyim@gmail.com';
    const possibleEmails = [targetEmail];

    const newPassword = '111111@1A';
    let user = null;
    let foundEmail = null;

    // Try to find user with any of the possible emails
    for (const email of possibleEmails) {
      user = await User.findOne({ where: { email } });
      if (user) {
        foundEmail = email;
        break;
      }
    }

    if (!user) {
      console.log(`❌ User with email variations not found.`);
      console.log('\nAvailable users:');
      const allUsers = await User.findAll({
        attributes: ['id', 'name', 'email', 'role', 'isActive'],
        order: [['email', 'ASC']]
      });
      allUsers.forEach(u => {
        console.log(`  - ${u.email} (${u.name}, ${u.role})`);
      });
      
      // Ask if we should create the user
      console.log(`\n💡 Creating new user with email: ${possibleEmails[0]}@email.com`);
      user = await User.create({
        name: 'User',
        email: `${possibleEmails[0]}@email.com`,
        password: newPassword, // Will be hashed by model hook
        role: 'staff',
        isActive: true
      });
      console.log(`✅ User created successfully!`);
      
      // Try to add user to first available tenant
      const firstTenant = await Tenant.findOne({ order: [['createdAt', 'ASC']] });
      if (firstTenant) {
        try {
          await UserTenant.create({
            userId: user.id,
            tenantId: firstTenant.id,
            role: 'staff',
            status: 'active',
            isDefault: true,
            joinedAt: new Date()
          });
          console.log(`✅ User added to tenant: ${firstTenant.name}`);
        } catch (tenantError) {
          console.log(`⚠️  Could not add user to tenant (may already exist): ${tenantError.message}`);
        }
      }
    } else {
      // Reset password for existing user
      user.password = newPassword; // Will be hashed by model hook
      await user.save();
      console.log(`✅ Password reset successfully for user: ${user.email}`);
    }

    console.log(`\n📧 Login Credentials:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${newPassword}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log('\n🎉 Password has been updated!\n');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    await sequelize.close();
    process.exit(1);
  }
};

// Run the script
resetUserPassword();

