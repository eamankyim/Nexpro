const User = require('./User');
const Tenant = require('./Tenant');
const UserTenant = require('./UserTenant');
const Customer = require('./Customer');
const Vendor = require('./Vendor');
const Job = require('./Job');
const Payment = require('./Payment');
const Expense = require('./Expense');
const PricingTemplate = require('./PricingTemplate');
const VendorPriceList = require('./VendorPriceList');
const JobItem = require('./JobItem');
const Quote = require('./Quote');
const QuoteItem = require('./QuoteItem');
const JobStatusHistory = require('./JobStatusHistory');
const Invoice = require('./Invoice');
const InviteToken = require('./InviteToken');
const Notification = require('./Notification');
const InventoryCategory = require('./InventoryCategory');
const InventoryItem = require('./InventoryItem');
const InventoryMovement = require('./InventoryMovement');
const Lead = require('./Lead');
const LeadActivity = require('./LeadActivity');
const Setting = require('./Setting');
const Employee = require('./Employee');
const EmployeeDocument = require('./EmployeeDocument');
const EmploymentHistory = require('./EmploymentHistory');
const PayrollRun = require('./PayrollRun');
const PayrollEntry = require('./PayrollEntry');
const Account = require('./Account');
const JournalEntry = require('./JournalEntry');
const JournalEntryLine = require('./JournalEntryLine');
const AccountBalance = require('./AccountBalance');
const SubscriptionPlan = require('./SubscriptionPlan');
const CustomDropdownOption = require('./CustomDropdownOption');

// Define relationships
Tenant.hasMany(Customer, { foreignKey: 'tenantId', as: 'customers' });
Customer.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Vendor, { foreignKey: 'tenantId', as: 'vendors' });
Vendor.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Quote, { foreignKey: 'tenantId', as: 'quotes' });
Quote.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(QuoteItem, { foreignKey: 'tenantId', as: 'quoteItems' });
QuoteItem.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Job, { foreignKey: 'tenantId', as: 'jobs' });
Job.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(JobItem, { foreignKey: 'tenantId', as: 'jobItems' });
JobItem.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(JobStatusHistory, { foreignKey: 'tenantId', as: 'jobStatusHistory' });
JobStatusHistory.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Invoice, { foreignKey: 'tenantId', as: 'invoices' });
Invoice.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Payment, { foreignKey: 'tenantId', as: 'payments' });
Payment.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Expense, { foreignKey: 'tenantId', as: 'expenses' });
Expense.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Lead, { foreignKey: 'tenantId', as: 'leads' });
Lead.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(LeadActivity, { foreignKey: 'tenantId', as: 'leadActivities' });
LeadActivity.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Setting, { foreignKey: 'tenantId', as: 'settings' });
Setting.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Employee, { foreignKey: 'tenantId', as: 'employees' });
Employee.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(EmployeeDocument, { foreignKey: 'tenantId', as: 'employeeDocuments' });
EmployeeDocument.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(EmploymentHistory, { foreignKey: 'tenantId', as: 'employmentHistories' });
EmploymentHistory.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(PayrollRun, { foreignKey: 'tenantId', as: 'payrollRuns' });
PayrollRun.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(PayrollEntry, { foreignKey: 'tenantId', as: 'payrollEntries' });
PayrollEntry.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Account, { foreignKey: 'tenantId', as: 'accounts' });
Account.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(JournalEntry, { foreignKey: 'tenantId', as: 'journalEntries' });
JournalEntry.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(JournalEntryLine, { foreignKey: 'tenantId', as: 'journalEntryLines' });
JournalEntryLine.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(AccountBalance, { foreignKey: 'tenantId', as: 'accountBalances' });
AccountBalance.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(PricingTemplate, { foreignKey: 'tenantId', as: 'pricingTemplates' });
PricingTemplate.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(VendorPriceList, { foreignKey: 'tenantId', as: 'vendorPriceLists' });
VendorPriceList.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(CustomDropdownOption, { foreignKey: 'tenantId', as: 'customDropdownOptions' });
CustomDropdownOption.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(InventoryCategory, { foreignKey: 'tenantId', as: 'inventoryCategories' });
InventoryCategory.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(InventoryItem, { foreignKey: 'tenantId', as: 'inventoryItems' });
InventoryItem.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(InventoryMovement, { foreignKey: 'tenantId', as: 'inventoryMovements' });
InventoryMovement.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Customer.hasMany(Job, { foreignKey: 'customerId', as: 'jobs' });
Job.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

User.hasMany(Job, { foreignKey: 'assignedTo', as: 'assignedJobs' });
Job.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignedUser' });

User.hasMany(Job, { foreignKey: 'createdBy', as: 'jobsCreated' });
Job.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Customer.hasMany(Quote, { foreignKey: 'customerId', as: 'quotes' });
Quote.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

User.hasMany(Quote, { foreignKey: 'createdBy', as: 'quotesCreated' });
Quote.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Quote.hasMany(QuoteItem, { foreignKey: 'quoteId', as: 'items' });
QuoteItem.belongsTo(Quote, { foreignKey: 'quoteId', as: 'quote' });

Quote.hasMany(Job, { foreignKey: 'quoteId', as: 'jobs' });
Job.belongsTo(Quote, { foreignKey: 'quoteId', as: 'quote' });

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

User.hasMany(Expense, { foreignKey: 'submittedBy', as: 'submittedExpenses' });
Expense.belongsTo(User, { foreignKey: 'submittedBy', as: 'submitter' });

User.hasMany(Expense, { foreignKey: 'approvedBy', as: 'approvedExpenses' });
Expense.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });

Vendor.hasMany(VendorPriceList, { foreignKey: 'vendorId', as: 'priceList' });
VendorPriceList.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });

Job.hasMany(JobItem, { foreignKey: 'jobId', as: 'items' });
JobItem.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });
QuoteItem.hasMany(JobItem, { foreignKey: 'quoteItemId', as: 'jobItems' });
JobItem.belongsTo(QuoteItem, { foreignKey: 'quoteItemId', as: 'quoteItem' });

// Invoice relationships
Customer.hasMany(Invoice, { foreignKey: 'customerId', as: 'invoices' });
Invoice.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

Job.hasMany(Invoice, { foreignKey: 'jobId', as: 'invoices' });
Invoice.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

Job.hasMany(JobStatusHistory, { foreignKey: 'jobId', as: 'statusHistory' });
JobStatusHistory.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });
JobStatusHistory.belongsTo(User, { foreignKey: 'changedBy', as: 'changedByUser' });

// Invite token relationships
User.hasMany(InviteToken, { foreignKey: 'createdBy', as: 'invitesCreated' });
InviteToken.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasOne(InviteToken, { foreignKey: 'usedBy', as: 'inviteUsed' });
InviteToken.belongsTo(User, { foreignKey: 'usedBy', as: 'user' });
InviteToken.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'recipient' });
Notification.belongsTo(User, { foreignKey: 'triggeredBy', as: 'actor' });
Notification.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

InventoryCategory.hasMany(InventoryItem, { foreignKey: 'categoryId', as: 'items' });
InventoryItem.belongsTo(InventoryCategory, { foreignKey: 'categoryId', as: 'category' });

Vendor.hasMany(InventoryItem, { foreignKey: 'preferredVendorId', as: 'inventoryItems' });
InventoryItem.belongsTo(Vendor, { foreignKey: 'preferredVendorId', as: 'preferredVendor' });

InventoryItem.hasMany(InventoryMovement, { foreignKey: 'itemId', as: 'movements' });
InventoryMovement.belongsTo(InventoryItem, { foreignKey: 'itemId', as: 'item' });

Job.hasMany(InventoryMovement, { foreignKey: 'jobId', as: 'inventoryMovements' });
InventoryMovement.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

User.hasMany(InventoryMovement, { foreignKey: 'createdBy', as: 'inventoryMovementsCreated' });
InventoryMovement.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

User.hasMany(Lead, { foreignKey: 'assignedTo', as: 'assignedLeads' });
Lead.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignee' });

Lead.hasMany(LeadActivity, { foreignKey: 'leadId', as: 'activities' });
LeadActivity.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
LeadActivity.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

Customer.hasMany(Lead, { foreignKey: 'convertedCustomerId', as: 'relatedLeads' });
Lead.belongsTo(Customer, { foreignKey: 'convertedCustomerId', as: 'convertedCustomer' });
Job.hasMany(Lead, { foreignKey: 'convertedJobId', as: 'linkedLeads' });
Lead.belongsTo(Job, { foreignKey: 'convertedJobId', as: 'convertedJob' });

User.hasMany(Employee, { foreignKey: 'userId', as: 'linkedEmployee' });
Employee.belongsTo(User, { foreignKey: 'userId', as: 'userAccount' });

Employee.hasMany(EmployeeDocument, { foreignKey: 'employeeId', as: 'documents' });
EmployeeDocument.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });
EmployeeDocument.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });

Employee.hasMany(EmploymentHistory, { foreignKey: 'employeeId', as: 'history' });
EmploymentHistory.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });

PayrollRun.hasMany(PayrollEntry, { foreignKey: 'payrollRunId', as: 'entries' });
PayrollEntry.belongsTo(PayrollRun, { foreignKey: 'payrollRunId', as: 'run' });
PayrollEntry.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });
Employee.hasMany(PayrollEntry, { foreignKey: 'employeeId', as: 'payrollEntries' });

JournalEntry.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
JournalEntry.belongsTo(User, { foreignKey: 'approvedBy', as: 'approver' });

JournalEntry.hasMany(JournalEntryLine, { foreignKey: 'journalEntryId', as: 'lines' });
JournalEntryLine.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'journalEntry' });

Account.hasMany(JournalEntryLine, { foreignKey: 'accountId', as: 'journalLines' });
JournalEntryLine.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

Account.hasMany(AccountBalance, { foreignKey: 'accountId', as: 'balances' });
AccountBalance.belongsTo(Account, { foreignKey: 'accountId', as: 'account' });

Account.hasMany(Account, { foreignKey: 'parentId', as: 'children' });
Account.belongsTo(Account, { foreignKey: 'parentId', as: 'parent' });

// Tenant relationships
Tenant.hasMany(UserTenant, { foreignKey: 'tenantId', as: 'memberships' });
UserTenant.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

User.hasMany(UserTenant, { foreignKey: 'userId', as: 'tenantMemberships' });
UserTenant.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Tenant.belongsToMany(User, {
  through: UserTenant,
  foreignKey: 'tenantId',
  otherKey: 'userId',
  as: 'users'
});

User.belongsToMany(Tenant, {
  through: UserTenant,
  foreignKey: 'userId',
  otherKey: 'tenantId',
  as: 'tenants'
});

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
  Quote,
  QuoteItem,
  JobStatusHistory,
  Invoice,
  InviteToken,
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
  JournalEntry,
  JournalEntryLine,
  AccountBalance,
  Tenant,
  UserTenant,
  SubscriptionPlan,
  CustomDropdownOption
};


