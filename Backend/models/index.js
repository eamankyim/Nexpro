const User = require('./User');
const Customer = require('./Customer');
const Vendor = require('./Vendor');
const Job = require('./Job');
const Payment = require('./Payment');
const Expense = require('./Expense');
const PricingTemplate = require('./PricingTemplate');
const VendorPriceList = require('./VendorPriceList');
const JobItem = require('./JobItem');
const Invoice = require('./Invoice');
const InviteToken = require('./InviteToken');

// Define relationships
Customer.hasMany(Job, { foreignKey: 'customerId', as: 'jobs' });
Job.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

User.hasMany(Job, { foreignKey: 'assignedTo', as: 'assignedJobs' });
Job.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignedUser' });

Customer.hasMany(Payment, { foreignKey: 'customerId', as: 'payments' });
Payment.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Vendor.hasMany(Payment, { foreignKey: 'vendorId', as: 'payments' });
Payment.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });

Job.hasMany(Payment, { foreignKey: 'jobId', as: 'payments' });
Payment.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

Vendor.hasMany(Expense, { foreignKey: 'vendorId', as: 'expenses' });
Expense.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });

Job.hasMany(Expense, { foreignKey: 'jobId', as: 'expenses' });
Expense.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

Vendor.hasMany(VendorPriceList, { foreignKey: 'vendorId', as: 'priceList' });
VendorPriceList.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });

Job.hasMany(JobItem, { foreignKey: 'jobId', as: 'items' });
JobItem.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

// Invoice relationships
Customer.hasMany(Invoice, { foreignKey: 'customerId', as: 'invoices' });
Invoice.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Job.hasMany(Invoice, { foreignKey: 'jobId', as: 'invoices' });
Invoice.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

// Invite token relationships
User.hasMany(InviteToken, { foreignKey: 'createdBy', as: 'invitesCreated' });
InviteToken.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasOne(InviteToken, { foreignKey: 'usedBy', as: 'inviteUsed' });
InviteToken.belongsTo(User, { foreignKey: 'usedBy', as: 'user' });

module.exports = {
  User,
  Customer,
  Vendor,
  Job,
  Payment,
  Expense,
  PricingTemplate,
  VendorPriceList,
  JobItem,
  Invoice,
  InviteToken
};


