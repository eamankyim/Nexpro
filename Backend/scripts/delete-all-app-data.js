/**
 * Deletes ALL users, tenants, and transaction/business data from the app.
 * Platform configuration (subscription plans, platform admin roles/permissions) is NOT deleted.
 *
 * Usage (from Backend directory):
 *   CONFIRM_DELETE_ALL=yes node scripts/delete-all-app-data.js
 *
 * After running, create a superadmin again with:
 *   node scripts/create-superadmin.js
 */
if (process.env.CONFIRM_DELETE_ALL !== 'yes') {
  console.error('This script deletes ALL users, tenants, and business data.');
  console.error('Set CONFIRM_DELETE_ALL=yes to run it.');
  process.exit(1);
}

require('dotenv').config();
const { sequelize, testConnection } = require('../config/database');
const {
  Tenant,
  UserTenant,
  User,
  JobStatusHistory,
  JobItem,
  Payment,
  Expense,
  ExpenseActivity,
  Invoice,
  LeadActivity,
  Job,
  QuoteItem,
  Quote,
  QuoteActivity,
  Lead,
  SaleItem,
  Sale,
  SaleActivity,
  ProductVariant,
  Barcode,
  Product,
  Shop,
  PrescriptionItem,
  DrugInteraction,
  ExpiryAlert,
  Prescription,
  Drug,
  Pharmacy,
  EmployeeDocument,
  EmploymentHistory,
  PayrollEntry,
  PayrollRun,
  Employee,
  JournalEntryLine,
  JournalEntry,
  AccountBalance,
  Account,
  InventoryMovement,
  InventoryItem,
  InventoryCategory,
  CustomerActivity,
  Customer,
  Vendor,
  Setting,
  PricingTemplate,
  VendorPriceList,
  CustomDropdownOption,
  InviteToken,
  Notification,
  SabitoTenantMapping,
  StockCount,
  StockCountItem,
  FootTraffic,
  PlatformAdminUserRole,
  UserTodo,
  UserWeekFocus
} = require('../models');

/**
 * Destroy records; on error log and continue (avoid failing whole run).
 * @param {Model} Model - Sequelize model
 * @param {object} where - Where clause
 * @param {object} opts - Options (e.g. { transaction })
 */
async function del(Model, where, opts = {}) {
  try {
    await Model.destroy({ where, ...opts });
  } catch (e) {
    console.warn('  ', Model.name, e.message);
  }
}

async function run() {
  try {
    await testConnection();

    const tenants = await Tenant.findAll({
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'name']
    });

    console.log(`Found ${tenants.length} tenant(s). Deleting all tenant data...`);

    await sequelize.transaction(async (tx) => {
      const options = { transaction: tx };

      for (const t of tenants) {
        const id = t.id;
        console.log(`  Deleting tenant: ${t.name} (${id})...`);

        const jobIds = (await Job.findAll({ where: { tenantId: id }, attributes: ['id'], ...options })).map((r) => r.id);
        const quoteIds = (await Quote.findAll({ where: { tenantId: id }, attributes: ['id'], ...options })).map((r) => r.id);
        const leadIds = (await Lead.findAll({ where: { tenantId: id }, attributes: ['id'], ...options })).map((r) => r.id);
        const saleIds = (await Sale.findAll({ where: { tenantId: id }, attributes: ['id'], ...options })).map((r) => r.id);
        const productIds = (await Product.findAll({ where: { tenantId: id }, attributes: ['id'], ...options })).map((r) => r.id);
        const prescriptionIds = (await Prescription.findAll({ where: { tenantId: id }, attributes: ['id'], ...options })).map((r) => r.id);
        const drugIds = (await Drug.findAll({ where: { tenantId: id }, attributes: ['id'], ...options })).map((r) => r.id);
        const employeeIds = (await Employee.findAll({ where: { tenantId: id }, attributes: ['id'], ...options })).map((r) => r.id);
        const payrollRunIds = (await PayrollRun.findAll({ where: { tenantId: id }, attributes: ['id'], ...options })).map((r) => r.id);
        const journalEntryIds = (await JournalEntry.findAll({ where: { tenantId: id }, attributes: ['id'], ...options })).map((r) => r.id);
        const stockCountIds = (await StockCount.findAll({ where: { tenantId: id }, attributes: ['id'], ...options })).map((r) => r.id);

        if (jobIds.length) await del(JobStatusHistory, { jobId: jobIds }, options);
        if (jobIds.length) await del(JobItem, { jobId: jobIds }, options);
        await del(ExpenseActivity, { tenantId: id }, options);
        await del(Payment, { tenantId: id }, options);
        await del(Expense, { tenantId: id }, options);
        await del(Invoice, { tenantId: id }, options);
        if (leadIds.length) await del(LeadActivity, { leadId: leadIds }, options);
        await del(Job, { tenantId: id }, options);
        if (quoteIds.length) await del(QuoteItem, { quoteId: quoteIds }, options);
        await del(Quote, { tenantId: id }, options);
        await del(QuoteActivity, { tenantId: id }, options);
        await del(Lead, { tenantId: id }, options);
        if (saleIds.length) await del(SaleItem, { saleId: saleIds }, options);
        await del(Sale, { tenantId: id }, options);
        await del(SaleActivity, { tenantId: id }, options);
        if (productIds.length) await del(ProductVariant, { productId: productIds }, options);
        await del(Barcode, { tenantId: id }, options);
        await del(Product, { tenantId: id }, options);
        await del(Shop, { tenantId: id }, options);
        if (prescriptionIds.length) await del(PrescriptionItem, { prescriptionId: prescriptionIds }, options);
        await del(DrugInteraction, { tenantId: id }, options);
        if (drugIds.length) await del(ExpiryAlert, { drugId: drugIds }, options);
        await del(Prescription, { tenantId: id }, options);
        await del(Drug, { tenantId: id }, options);
        await del(Pharmacy, { tenantId: id }, options);
        if (employeeIds.length) await del(EmployeeDocument, { employeeId: employeeIds }, options);
        if (employeeIds.length) await del(EmploymentHistory, { employeeId: employeeIds }, options);
        if (payrollRunIds.length) await del(PayrollEntry, { payrollRunId: payrollRunIds }, options);
        await del(PayrollRun, { tenantId: id }, options);
        await del(Employee, { tenantId: id }, options);
        if (journalEntryIds.length) await del(JournalEntryLine, { journalEntryId: journalEntryIds }, options);
        await del(JournalEntry, { tenantId: id }, options);
        await del(AccountBalance, { tenantId: id }, options);
        await Account.update({ parentId: null }, { where: { tenantId: id }, ...options });
        await del(Account, { tenantId: id }, options);
        await del(InventoryMovement, { tenantId: id }, options);
        await del(InventoryItem, { tenantId: id }, options);
        await del(InventoryCategory, { tenantId: id }, options);
        await del(CustomerActivity, { tenantId: id }, options);
        await del(Customer, { tenantId: id }, options);
        await del(Vendor, { tenantId: id }, options);
        await del(Setting, { tenantId: id }, options);
        await del(PricingTemplate, { tenantId: id }, options);
        await del(VendorPriceList, { tenantId: id }, options);
        await del(CustomDropdownOption, { tenantId: id }, options);
        await del(InviteToken, { tenantId: id }, options);
        await del(Notification, { tenantId: id }, options);
        await del(SabitoTenantMapping, { nexproTenantId: id }, options);
        if (stockCountIds.length) await del(StockCountItem, { stockCountId: stockCountIds }, options);
        await del(StockCount, { tenantId: id }, options);
        await del(FootTraffic, { tenantId: id }, options);
      }

      console.log('Deleting user-tenant memberships and tenants...');
      await del(UserTenant, {}, options);
      await del(Tenant, {}, options);

      console.log('Deleting user-scoped data and users...');
      await del(PlatformAdminUserRole, {}, options);
      await del(Notification, {}, options);
      await del(UserTodo, {}, options);
      await del(UserWeekFocus, {}, options);
      await del(InviteToken, {}, options);
      await del(User, {}, options);
    });

    console.log('Done. All users, tenants, and business data have been deleted.');
    console.log('Run "node scripts/create-superadmin.js" to create a superadmin and default tenant again.');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

run();
