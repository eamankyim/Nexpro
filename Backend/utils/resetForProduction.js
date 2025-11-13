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
  VendorPriceList,
  Notification,
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
  Lead,
  LeadActivity,
  Setting,
  Employee,
  EmployeeDocument,
  EmploymentHistory,
  PayrollRun,
  PayrollEntry,
  Account,
  AccountBalance,
  JournalEntry,
  JournalEntryLine,
  Quote,
  QuoteItem,
  JobStatusHistory,
  Tenant,
  UserTenant
} = require('../models');
require('dotenv').config();

const resetForProduction = async () => {
  try {
    console.log('🗑️  Clearing all data for production deployment...');
    
    // Delete all data in the correct order (respecting foreign keys)
    await JournalEntryLine.destroy({ where: {}, force: true });
    console.log('✅ Journal Entry Lines cleared');

    await JournalEntry.destroy({ where: {}, force: true });
    console.log('✅ Journal Entries cleared');

    await AccountBalance.destroy({ where: {}, force: true });
    console.log('✅ Account Balances cleared');

    await Account.destroy({ where: {}, force: true });
    console.log('✅ Accounts cleared');

    await PayrollEntry.destroy({ where: {}, force: true });
    console.log('✅ Payroll Entries cleared');

    await PayrollRun.destroy({ where: {}, force: true });
    console.log('✅ Payroll Runs cleared');

    await EmploymentHistory.destroy({ where: {}, force: true });
    console.log('✅ Employment History cleared');

    await EmployeeDocument.destroy({ where: {}, force: true });
    console.log('✅ Employee Documents cleared');

    await Employee.destroy({ where: {}, force: true });
    console.log('✅ Employees cleared');

    await LeadActivity.destroy({ where: {}, force: true });
    console.log('✅ Lead Activities cleared');

    await Lead.destroy({ where: {}, force: true });
    console.log('✅ Leads cleared');

    await InventoryMovement.destroy({ where: {}, force: true });
    console.log('✅ Inventory Movements cleared');

    await InventoryItem.destroy({ where: {}, force: true });
    console.log('✅ Inventory Items cleared');

    await InventoryCategory.destroy({ where: {}, force: true });
    console.log('✅ Inventory Categories cleared');

    await Notification.destroy({ where: {}, force: true });
    console.log('✅ Notifications cleared');

    await Setting.destroy({ where: {}, force: true });
    console.log('✅ Settings cleared');

    await JobStatusHistory.destroy({ where: {}, force: true });
    console.log('✅ Job Status History cleared');

    await QuoteItem.destroy({ where: {}, force: true });
    console.log('✅ Quote Items cleared');

    await Quote.destroy({ where: {}, force: true });
    console.log('✅ Quotes cleared');

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

    await UserTenant.destroy({ where: {}, force: true });
    console.log('✅ User-Tenant memberships cleared');

    await Tenant.destroy({ where: {}, force: true });
    console.log('✅ Tenants cleared');
    
    // Delete all users
    const deletedUsers = await User.destroy({
      where: {},
      force: true
    });
    console.log(`✅ Users cleared (${deletedUsers} deleted)`);

    // Delete residual tenants (already removed earlier) and ensure clean slate
    await Tenant.destroy({ where: {}, force: true });
    console.log('✅ Tenants cleared');
    
    console.log('\n🎉 Production database reset complete!');
    console.log('\nℹ️  No platform admin exists. Use POST /api/admin/bootstrap to create one.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
};

resetForProduction();

