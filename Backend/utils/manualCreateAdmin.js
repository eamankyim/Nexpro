const { sequelize } = require('../config/database');
const { User } = require('../models');
require('dotenv').config();

const manualCreateAdmin = async () => {
  try {
    console.log('🌱 Manually creating admin user...\n');
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ where: { email: 'admin@printingpress.com' } });
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists!');
      console.log('   Email: admin@printingpress.com');
      console.log('   Password: admin123');
      console.log('\n🎉 No action needed.\n');
      process.exit(0);
    }
    
    // Create admin user directly
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@printingpress.com',
      password: 'admin123', // Will be hashed by the model
      role: 'admin',
      isActive: true,
      isFirstLogin: false // Admin has logged in
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('\n📧 Login Credentials:');
    console.log('   Email: admin@printingpress.com');
    console.log('   Password: admin123');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    console.log('\n🎉 Database is ready to use!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
};

manualCreateAdmin();

