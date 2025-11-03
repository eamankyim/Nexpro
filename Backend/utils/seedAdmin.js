const { sequelize, testConnection } = require('../config/database');
const { User } = require('../models');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    console.log('🌱 Starting admin user seed...\n');
    
    // Test and establish database connection
    await testConnection();
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ where: { email: 'admin@printingpress.com' } });
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists!');
      console.log('   Email: admin@printingpress.com');
      console.log('   Password: 111111@1A');
      console.log('\n🎉 No action needed.\n');
      await sequelize.close();
      process.exit(0);
    }
    
    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@printingpress.com',
      password: '111111@1A', // Will be hashed by the model
      role: 'admin',
      isActive: true,
      isFirstLogin: false // Admin has logged in
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('\n📧 Login Credentials:');
    console.log('   Email: admin@printingpress.com');
    console.log('   Password: 111111@1A');
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    console.log('\n🎉 Database is ready to use!\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    await sequelize.close();
    process.exit(1);
  }
};

seedAdmin();

