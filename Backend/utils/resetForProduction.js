const { sequelize } = require('../config/database');
const { Sequelize } = require('sequelize');
const { Op } = Sequelize;
const { 
  User, 
  Customer, 
  Vendor, 
  Job, 
  Payment, 
  Expense, 
  PricingTemplate, 
  Invoice, 
  JobItem,
  InviteToken,
  VendorPriceList 
} = require('../models');
require('dotenv').config();

const resetForProduction = async () => {
  try {
    console.log('🗑️  Clearing all data for production deployment...');
    
    // Delete all data in the correct order (respecting foreign keys)
    await JobItem.destroy({ where: {}, force: true });
    console.log('✅ Job Items cleared');
    
    await Invoice.destroy({ where: {}, force: true });
    console.log('✅ Invoices cleared');
    
    await Job.destroy({ where: {}, force: true });
    console.log('✅ Jobs cleared');
    
    await Payment.destroy({ where: {}, force: true });
    console.log('✅ Payments cleared');
    
    await Expense.destroy({ where: {}, force: true });
    console.log('✅ Expenses cleared');
    
    await VendorPriceList.destroy({ where: {}, force: true });
    console.log('✅ Vendor Price Lists cleared');
    
    await PricingTemplate.destroy({ where: {}, force: true });
    console.log('✅ Pricing Templates cleared');
    
    await InviteToken.destroy({ where: {}, force: true });
    console.log('✅ Invite Tokens cleared');
    
    await Customer.destroy({ where: {}, force: true });
    console.log('✅ Customers cleared');
    
    await Vendor.destroy({ where: {}, force: true });
    console.log('✅ Vendors cleared');
    
    // Delete all users EXCEPT admin users
    const deletedUsers = await User.destroy({ 
      where: { 
        role: { [Op.ne]: 'admin' }
      },
      force: true 
    });
    console.log(`✅ Non-admin users cleared (${deletedUsers} deleted)`);
    
    // Get admin users count
    const adminCount = await User.count({ where: { role: 'admin' } });
    console.log(`📊 Admin users remaining: ${adminCount}`);
    
    if (adminCount === 0) {
      console.log('⚠️  No admin users found! Creating default admin...');
      await User.create({
        name: 'Admin User',
        email: 'admin@printingpress.com',
        password: 'admin123', // Should be changed on first login
        role: 'admin'
      });
      console.log('✅ Default admin created: admin@printingpress.com / admin123');
    }
    
    console.log('\n🎉 Production database reset complete!');
    console.log('\n⚠️  IMPORTANT: Change default admin password on first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
};

resetForProduction();

