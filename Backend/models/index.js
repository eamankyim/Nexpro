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
const PasswordResetToken = require('./PasswordResetToken');
const EmailVerificationToken = require('./EmailVerificationToken');
const Notification = require('./Notification');
const MaterialCategory = require('./MaterialCategory');
const MaterialItem = require('./MaterialItem');
const MaterialMovement = require('./MaterialMovement');
const EquipmentCategory = require('./EquipmentCategory');
const Equipment = require('./Equipment');
const Lead = require('./Lead');
const LeadActivity = require('./LeadActivity');
const CustomerActivity = require('./CustomerActivity');
const QuoteActivity = require('./QuoteActivity');
const SaleActivity = require('./SaleActivity');
const ExpenseActivity = require('./ExpenseActivity');
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
const RecurringJournal = require('./RecurringJournal');
const RecurringJournalRun = require('./RecurringJournalRun');
const SubscriptionPlan = require('./SubscriptionPlan');
const CustomDropdownOption = require('./CustomDropdownOption');
const SabitoTenantMapping = require('./SabitoTenantMapping');
// Shop Management Models
const Shop = require('./Shop');
const Product = require('./Product');
const Sale = require('./Sale');
const SaleItem = require('./SaleItem');
const ProductVariant = require('./ProductVariant');
const Barcode = require('./Barcode');
const ProductCategory = require('./ProductCategory');
// Pharmacy Management Models
const Pharmacy = require('./Pharmacy');
const Drug = require('./Drug');
const Prescription = require('./Prescription');
const PrescriptionItem = require('./PrescriptionItem');
const DrugInteraction = require('./DrugInteraction');
const ExpiryAlert = require('./ExpiryAlert');
// Retail Intelligence Models
const FootTraffic = require('./FootTraffic');
const StockCount = require('./StockCount');
const StockCountItem = require('./StockCountItem');
// Platform Admin Roles
const PlatformAdminRole = require('./PlatformAdminRole');
const PlatformAdminPermission = require('./PlatformAdminPermission');
const PlatformAdminRolePermission = require('./PlatformAdminRolePermission');
const PlatformAdminUserRole = require('./PlatformAdminUserRole');
const UserTodo = require('./UserTodo');
const UserWeekFocus = require('./UserWeekFocus');
const UserTask = require('./UserTask');
const UserChecklist = require('./UserChecklist');
const UserChecklistItem = require('./UserChecklistItem');
const TenantAccessAudit = require('./TenantAccessAudit');
const AutomationRule = require('./AutomationRule');
const AutomationRun = require('./AutomationRun');

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

Tenant.hasMany(CustomerActivity, { foreignKey: 'tenantId', as: 'customerActivities' });
CustomerActivity.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(QuoteActivity, { foreignKey: 'tenantId', as: 'quoteActivities' });
QuoteActivity.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(SaleActivity, { foreignKey: 'tenantId', as: 'saleActivities' });
SaleActivity.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

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

Tenant.hasMany(RecurringJournal, { foreignKey: 'tenantId', as: 'recurringJournals' });
RecurringJournal.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Tenant.hasMany(RecurringJournalRun, { foreignKey: 'tenantId', as: 'recurringJournalRuns' });
RecurringJournalRun.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
RecurringJournal.belongsTo(Account, { foreignKey: 'debitAccountId', as: 'debitAccount' });
RecurringJournal.belongsTo(Account, { foreignKey: 'creditAccountId', as: 'creditAccount' });
RecurringJournal.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
RecurringJournal.hasMany(RecurringJournalRun, { foreignKey: 'recurringJournalId', as: 'runs' });
RecurringJournalRun.belongsTo(RecurringJournal, { foreignKey: 'recurringJournalId', as: 'recurringJournal' });
RecurringJournalRun.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'journalEntry' });

Tenant.hasMany(PricingTemplate, { foreignKey: 'tenantId', as: 'pricingTemplates' });
PricingTemplate.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(VendorPriceList, { foreignKey: 'tenantId', as: 'vendorPriceLists' });
VendorPriceList.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(CustomDropdownOption, { foreignKey: 'tenantId', as: 'customDropdownOptions' });
CustomDropdownOption.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(MaterialCategory, { foreignKey: 'tenantId', as: 'materialCategories' });
MaterialCategory.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(MaterialItem, { foreignKey: 'tenantId', as: 'materialItems' });
MaterialItem.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(MaterialMovement, { foreignKey: 'tenantId', as: 'materialMovements' });
MaterialMovement.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

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

Sale.hasMany(Invoice, { foreignKey: 'saleId', as: 'invoices' });
Invoice.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale' });

Prescription.hasMany(Invoice, { foreignKey: 'prescriptionId', as: 'invoices' });
Invoice.belongsTo(Prescription, { foreignKey: 'prescriptionId', as: 'prescription' });

Job.hasMany(JobStatusHistory, { foreignKey: 'jobId', as: 'statusHistory' });
JobStatusHistory.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });
JobStatusHistory.belongsTo(User, { foreignKey: 'changedBy', as: 'changedByUser' });

// Invite token relationships
User.hasMany(InviteToken, { foreignKey: 'createdBy', as: 'invitesCreated' });
InviteToken.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasOne(InviteToken, { foreignKey: 'usedBy', as: 'inviteUsed' });
InviteToken.belongsTo(User, { foreignKey: 'usedBy', as: 'user' });
InviteToken.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

User.hasMany(PasswordResetToken, { foreignKey: 'userId', as: 'passwordResetTokens' });
PasswordResetToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(EmailVerificationToken, { foreignKey: 'userId', as: 'emailVerificationTokens' });
EmailVerificationToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'recipient' });

User.hasMany(UserTodo, { foreignKey: 'userId', as: 'todos' });
UserTodo.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(UserWeekFocus, { foreignKey: 'userId', as: 'weekFocus' });
UserWeekFocus.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Tenant.hasMany(UserTask, { foreignKey: 'tenantId', as: 'workspaceTasks' });
UserTask.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
User.hasMany(UserTask, { foreignKey: 'userId', as: 'workspaceTasks' });
UserTask.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(UserTask, { foreignKey: 'assigneeId', as: 'assignedWorkspaceTasks' });
UserTask.belongsTo(User, { foreignKey: 'assigneeId', as: 'assignee' });

Tenant.hasMany(UserChecklist, { foreignKey: 'tenantId', as: 'workspaceChecklists' });
UserChecklist.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
User.hasMany(UserChecklist, { foreignKey: 'userId', as: 'workspaceChecklists' });
UserChecklist.belongsTo(User, { foreignKey: 'userId', as: 'user' });

UserChecklist.hasMany(UserChecklistItem, { foreignKey: 'checklistId', as: 'items' });
UserChecklistItem.belongsTo(UserChecklist, { foreignKey: 'checklistId', as: 'checklist' });
User.hasMany(UserChecklistItem, { foreignKey: 'userId', as: 'workspaceChecklistItems' });
UserChecklistItem.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Notification.belongsTo(User, { foreignKey: 'triggeredBy', as: 'actor' });
Notification.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

MaterialCategory.hasMany(MaterialItem, { foreignKey: 'categoryId', as: 'items' });
MaterialItem.belongsTo(MaterialCategory, { foreignKey: 'categoryId', as: 'category' });

Vendor.hasMany(MaterialItem, { foreignKey: 'preferredVendorId', as: 'materialItems' });
MaterialItem.belongsTo(Vendor, { foreignKey: 'preferredVendorId', as: 'preferredVendor' });

MaterialItem.hasMany(MaterialMovement, { foreignKey: 'itemId', as: 'movements' });
MaterialMovement.belongsTo(MaterialItem, { foreignKey: 'itemId', as: 'item' });

Tenant.hasMany(EquipmentCategory, { foreignKey: 'tenantId', as: 'equipmentCategories' });
EquipmentCategory.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Equipment, { foreignKey: 'tenantId', as: 'equipment' });
Equipment.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

EquipmentCategory.hasMany(Equipment, { foreignKey: 'categoryId', as: 'equipment' });
Equipment.belongsTo(EquipmentCategory, { foreignKey: 'categoryId', as: 'category' });

Vendor.hasMany(Equipment, { foreignKey: 'vendorId', as: 'equipment' });
Equipment.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });

Job.hasMany(MaterialMovement, { foreignKey: 'jobId', as: 'materialMovements' });
MaterialMovement.belongsTo(Job, { foreignKey: 'jobId', as: 'job' });

User.hasMany(MaterialMovement, { foreignKey: 'createdBy', as: 'materialMovementsCreated' });
MaterialMovement.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

User.hasMany(Lead, { foreignKey: 'assignedTo', as: 'assignedLeads' });
Lead.belongsTo(User, { foreignKey: 'assignedTo', as: 'assignee' });
User.hasMany(Lead, { foreignKey: 'createdBy', as: 'createdLeads' });
Lead.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

Lead.hasMany(LeadActivity, { foreignKey: 'leadId', as: 'activities' });
LeadActivity.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
LeadActivity.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

Customer.hasMany(CustomerActivity, { foreignKey: 'customerId', as: 'activities' });
CustomerActivity.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
CustomerActivity.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

Quote.hasMany(QuoteActivity, { foreignKey: 'quoteId', as: 'activities' });
QuoteActivity.belongsTo(Quote, { foreignKey: 'quoteId', as: 'quote' });
QuoteActivity.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

Sale.hasMany(SaleActivity, { foreignKey: 'saleId', as: 'activities' });
SaleActivity.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale' });
SaleActivity.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

Expense.hasMany(ExpenseActivity, { foreignKey: 'expenseId', as: 'activities' });
ExpenseActivity.belongsTo(Expense, { foreignKey: 'expenseId', as: 'expense' });
ExpenseActivity.belongsTo(User, { foreignKey: 'createdBy', as: 'createdByUser' });

Customer.hasMany(Lead, { foreignKey: 'convertedCustomerId', as: 'relatedLeads' });
Lead.belongsTo(Customer, { foreignKey: 'convertedCustomerId', as: 'convertedCustomer' });
Job.hasMany(Lead, { foreignKey: 'convertedJobId', as: 'linkedLeads' });
Lead.belongsTo(Job, { foreignKey: 'convertedJobId', as: 'convertedJob' });

// Admin job to admin lead relationship
Lead.hasMany(Job, { foreignKey: 'adminLeadId', as: 'adminJobs' });
Job.belongsTo(Lead, { foreignKey: 'adminLeadId', as: 'adminLead' });

// Platform Admin Roles relationships
PlatformAdminRole.belongsToMany(PlatformAdminPermission, {
  through: PlatformAdminRolePermission,
  foreignKey: 'roleId',
  otherKey: 'permissionId',
  as: 'permissions'
});

PlatformAdminPermission.belongsToMany(PlatformAdminRole, {
  through: PlatformAdminRolePermission,
  foreignKey: 'permissionId',
  otherKey: 'roleId',
  as: 'roles'
});

// Platform Admin User Roles relationships
User.hasMany(PlatformAdminUserRole, { foreignKey: 'userId', as: 'platformAdminUserRoles' });
PlatformAdminUserRole.belongsTo(User, { foreignKey: 'userId', as: 'user' });

PlatformAdminRole.hasMany(PlatformAdminUserRole, { foreignKey: 'roleId', as: 'userRoles' });
PlatformAdminUserRole.belongsTo(PlatformAdminRole, { foreignKey: 'roleId', as: 'role' });

User.belongsToMany(PlatformAdminRole, {
  through: PlatformAdminUserRole,
  foreignKey: 'userId',
  otherKey: 'roleId',
  as: 'platformAdminRoles'
});

PlatformAdminRole.belongsToMany(User, {
  through: PlatformAdminUserRole,
  foreignKey: 'roleId',
  otherKey: 'userId',
  as: 'users'
});

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

// Sabito tenant mapping relationships
SabitoTenantMapping.belongsTo(Tenant, { 
  foreignKey: 'nexproTenantId', 
  as: 'tenant' 
});

Tenant.hasMany(SabitoTenantMapping, { 
  foreignKey: 'nexproTenantId', 
  as: 'sabitoMappings' 
});

// Shop Management Relationships
Tenant.hasMany(Shop, { foreignKey: 'tenantId', as: 'shops' });
Shop.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(ProductCategory, { foreignKey: 'tenantId', as: 'productCategories' });
ProductCategory.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Product, { foreignKey: 'tenantId', as: 'products' });
Product.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Product.belongsTo(Shop, { foreignKey: 'shopId', as: 'shop' });
Shop.hasMany(Product, { foreignKey: 'shopId', as: 'products' });
Product.belongsTo(ProductCategory, { foreignKey: 'categoryId', as: 'category' });
ProductCategory.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });

Product.hasMany(ProductVariant, { foreignKey: 'productId', as: 'variants' });
ProductVariant.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

Tenant.hasMany(Barcode, { foreignKey: 'tenantId', as: 'barcodes' });
Barcode.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Barcode.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(Barcode, { foreignKey: 'productId', as: 'barcodes' });
Barcode.belongsTo(ProductVariant, { foreignKey: 'productVariantId', as: 'productVariant' });
ProductVariant.hasMany(Barcode, { foreignKey: 'productVariantId', as: 'barcodes' });

Tenant.hasMany(Sale, { foreignKey: 'tenantId', as: 'sales' });
Sale.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Sale.belongsTo(Shop, { foreignKey: 'shopId', as: 'shop' });
Shop.hasMany(Sale, { foreignKey: 'shopId', as: 'sales' });
Sale.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Sale, { foreignKey: 'customerId', as: 'sales' });
Sale.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
// Note: Invoice.belongsTo(Sale) is already defined above with alias 'sale', so we don't need Invoice.hasOne(Sale)
Sale.belongsTo(User, { foreignKey: 'soldBy', as: 'seller' });
User.hasMany(Sale, { foreignKey: 'soldBy', as: 'sales' });

Sale.hasMany(SaleItem, { foreignKey: 'saleId', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale' });
SaleItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(SaleItem, { foreignKey: 'productId', as: 'saleItems' });
SaleItem.belongsTo(ProductVariant, { foreignKey: 'productVariantId', as: 'variant' });
ProductVariant.hasMany(SaleItem, { foreignKey: 'productVariantId', as: 'saleItems' });

// Pharmacy Management Relationships
Tenant.hasMany(Pharmacy, { foreignKey: 'tenantId', as: 'pharmacies' });
Pharmacy.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

Tenant.hasMany(Drug, { foreignKey: 'tenantId', as: 'drugs' });
Drug.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Drug.belongsTo(Pharmacy, { foreignKey: 'pharmacyId', as: 'pharmacy' });
Pharmacy.hasMany(Drug, { foreignKey: 'pharmacyId', as: 'drugs' });
Drug.belongsTo(MaterialCategory, { foreignKey: 'categoryId', as: 'category' });
MaterialCategory.hasMany(Drug, { foreignKey: 'categoryId', as: 'drugs' });

Tenant.hasMany(Prescription, { foreignKey: 'tenantId', as: 'prescriptions' });
Prescription.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
Prescription.belongsTo(Pharmacy, { foreignKey: 'pharmacyId', as: 'pharmacy' });
Pharmacy.hasMany(Prescription, { foreignKey: 'pharmacyId', as: 'prescriptions' });
Prescription.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Prescription, { foreignKey: 'customerId', as: 'prescriptions' });
Prescription.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
// Note: Invoice.belongsTo(Prescription) is already defined above with alias 'prescription', so we don't need Invoice.hasOne(Prescription)
Prescription.belongsTo(User, { foreignKey: 'filledBy', as: 'filler' });
User.hasMany(Prescription, { foreignKey: 'filledBy', as: 'prescriptions' });

Prescription.hasMany(PrescriptionItem, { foreignKey: 'prescriptionId', as: 'items' });
PrescriptionItem.belongsTo(Prescription, { foreignKey: 'prescriptionId', as: 'prescription' });
PrescriptionItem.belongsTo(Drug, { foreignKey: 'drugId', as: 'drug' });
Drug.hasMany(PrescriptionItem, { foreignKey: 'drugId', as: 'prescriptionItems' });

Tenant.hasMany(DrugInteraction, { foreignKey: 'tenantId', as: 'drugInteractions' });
DrugInteraction.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
DrugInteraction.belongsTo(Drug, { foreignKey: 'drug1Id', as: 'drug1' });
DrugInteraction.belongsTo(Drug, { foreignKey: 'drug2Id', as: 'drug2' });
Drug.hasMany(DrugInteraction, { foreignKey: 'drug1Id', as: 'interactionsAsDrug1' });
Drug.hasMany(DrugInteraction, { foreignKey: 'drug2Id', as: 'interactionsAsDrug2' });

Tenant.hasMany(ExpiryAlert, { foreignKey: 'tenantId', as: 'expiryAlerts' });
ExpiryAlert.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
ExpiryAlert.belongsTo(Drug, { foreignKey: 'drugId', as: 'drug' });
Drug.hasMany(ExpiryAlert, { foreignKey: 'drugId', as: 'expiryAlerts' });
ExpiryAlert.belongsTo(User, { foreignKey: 'acknowledgedBy', as: 'acknowledger' });
User.hasMany(ExpiryAlert, { foreignKey: 'acknowledgedBy', as: 'acknowledgedAlerts' });

// Foot Traffic Relationships
Tenant.hasMany(FootTraffic, { foreignKey: 'tenantId', as: 'footTraffic' });
FootTraffic.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
FootTraffic.belongsTo(Shop, { foreignKey: 'shopId', as: 'shop' });
Shop.hasMany(FootTraffic, { foreignKey: 'shopId', as: 'footTraffic' });
FootTraffic.belongsTo(User, { foreignKey: 'recordedBy', as: 'recorder' });
User.hasMany(FootTraffic, { foreignKey: 'recordedBy', as: 'recordedTraffic' });

// Tenant access audit relationships
Tenant.hasMany(TenantAccessAudit, { foreignKey: 'tenantId', as: 'accessAuditLogs' });
TenantAccessAudit.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
User.hasMany(TenantAccessAudit, { foreignKey: 'actorUserId', as: 'tenantAccessAuditEntries' });
TenantAccessAudit.belongsTo(User, { foreignKey: 'actorUserId', as: 'actor' });

Tenant.hasMany(AutomationRule, { foreignKey: 'tenantId', as: 'automationRules' });
AutomationRule.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });
AutomationRule.hasMany(AutomationRun, { foreignKey: 'ruleId', as: 'runs' });
AutomationRun.belongsTo(AutomationRule, { foreignKey: 'ruleId', as: 'rule' });
Tenant.hasMany(AutomationRun, { foreignKey: 'tenantId', as: 'automationRuns' });
AutomationRun.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

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
  PasswordResetToken,
  EmailVerificationToken,
  Notification,
  MaterialCategory,
  MaterialItem,
  MaterialMovement,
  EquipmentCategory,
  Equipment,
  Lead,
  LeadActivity,
  CustomerActivity,
  QuoteActivity,
  SaleActivity,
  ExpenseActivity,
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
  RecurringJournal,
  RecurringJournalRun,
  Tenant,
  UserTenant,
  SubscriptionPlan,
  CustomDropdownOption,
  SabitoTenantMapping,
  // Shop Management
  Shop,
  ProductCategory,
  Product,
  Sale,
  SaleItem,
  ProductVariant,
  Barcode,
  // Pharmacy Management
  Pharmacy,
  Drug,
  Prescription,
  PrescriptionItem,
  DrugInteraction,
  ExpiryAlert,
  // Retail Intelligence
  FootTraffic,
  StockCount,
  StockCountItem,
  // Platform Admin Roles
  PlatformAdminRole,
  PlatformAdminPermission,
  PlatformAdminRolePermission,
  PlatformAdminUserRole,
  UserTodo,
  UserWeekFocus,
  UserTask,
  UserChecklist,
  UserChecklistItem,
  TenantAccessAudit,
  AutomationRule,
  AutomationRun
};


