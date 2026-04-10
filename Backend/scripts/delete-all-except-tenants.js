/**
 * Deletes users, tenants, and business data for all tenants EXCEPT a keep-list.
 *
 * Usage (from Backend directory):
 *   KEEP_TENANT_SLUGS=my-business-zhfssm,my-business-3 DRY_RUN=true node scripts/delete-all-except-tenants.js
 *   KEEP_TENANT_SLUGS=my-business-zhfssm,my-business-3 CONFIRM_DELETE=yes node scripts/delete-all-except-tenants.js
 */
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

function parseKeepSlugs() {
  const raw = process.env.KEEP_TENANT_SLUGS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isDryRun() {
  return String(process.env.DRY_RUN || '').toLowerCase() === 'true';
}

async function del(Model, where, opts = {}) {
  try {
    if (!Model || !Model.destroy) {
      return;
    }
    await Model.destroy({ where, ...opts });
  } catch (e) {
    const modelName = Model && Model.name ? Model.name : 'UnknownModel';
    console.warn('  ', modelName, e.message);
  }
}

async function deleteTenantData(tenantId, tx) {
  const options = { transaction: tx };
  const id = tenantId;

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
  await del(UserTenant, { tenantId: id }, options);
  await del(Tenant, { id }, options);
}

async function run() {
  const keepSlugs = parseKeepSlugs();
  const dryRun = isDryRun();

  if (!keepSlugs.length) {
    console.error('No keep-list provided. Set KEEP_TENANT_SLUGS=slug1,slug2');
    process.exit(1);
  }

  if (!dryRun && process.env.CONFIRM_DELETE !== 'yes') {
    console.error('This script deletes data permanently.');
    console.error('Set CONFIRM_DELETE=yes to run a real delete, or DRY_RUN=true for preview.');
    process.exit(1);
  }

  try {
    await testConnection();

    const tenants = await Tenant.findAll({
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'name', 'slug']
    });

    const keepSet = new Set(keepSlugs);
    const keepTenants = tenants.filter((t) => keepSet.has(t.slug));
    const deleteTenants = tenants.filter((t) => !keepSet.has(t.slug));

    const missing = keepSlugs.filter((slug) => !keepTenants.some((t) => t.slug === slug));
    if (missing.length) {
      console.error('These keep slugs were not found:', missing.join(', '));
      process.exit(1);
    }

    console.log(`Total tenants: ${tenants.length}`);
    console.log(`Keeping (${keepTenants.length}): ${keepTenants.map((t) => t.slug).join(', ')}`);
    console.log(`Deleting (${deleteTenants.length}): ${deleteTenants.map((t) => t.slug).join(', ')}`);

    if (dryRun) {
      console.log('DRY_RUN=true, no data deleted.');
      await sequelize.close();
      process.exit(0);
    }

    await sequelize.transaction(async (tx) => {
      for (const t of deleteTenants) {
        console.log(`Deleting tenant data: ${t.slug} (${t.id})...`);
        await deleteTenantData(t.id, tx);
      }

      // Remove users that no longer belong to any tenant.
      const users = await User.findAll({ attributes: ['id'], transaction: tx });
      for (const u of users) {
        const membershipCount = await UserTenant.count({ where: { userId: u.id }, transaction: tx });
        if (membershipCount === 0) {
          await del(PlatformAdminUserRole, { userId: u.id }, { transaction: tx });
          await del(Notification, { userId: u.id }, { transaction: tx });
          await del(UserTodo, { userId: u.id }, { transaction: tx });
          await del(UserWeekFocus, { userId: u.id }, { transaction: tx });
          await del(User, { id: u.id }, { transaction: tx });
        }
      }
    });

    console.log('Done. All non-keep tenants and their data were deleted.');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

run();
