/**
 * Deletes the 5 most recently created businesses (tenants) and all their data.
 * Run from Backend: node scripts/delete-last-five-businesses.js
 */
require('dotenv').config();
const { sequelize, testConnection } = require('../config/database');
const {
  Tenant,
  UserTenant,
  JobStatusHistory,
  JobItem,
  Payment,
  Expense,
  Invoice,
  LeadActivity,
  Job,
  QuoteItem,
  Quote,
  Lead,
  SaleItem,
  Sale,
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
  Customer,
  Vendor,
  Setting,
  PricingTemplate,
  VendorPriceList,
  CustomDropdownOption,
  InviteToken,
  Notification,
  SabitoTenantMapping
} = require('../models');

async function run() {
  try {
    await testConnection();
    const tenants = await Tenant.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'name', 'createdAt']
    });
    if (tenants.length === 0) {
      console.log('No tenants found.');
      await sequelize.close();
      process.exit(0);
      return;
    }
    console.log('Deleting last 5 businesses:');
    tenants.forEach((t, i) => console.log(`  ${i + 1}. ${t.name} (${t.id})`));
    console.log('');

    for (const t of tenants) {
      console.log(`Deleting tenant: ${t.name} (${t.id})...`);
      await sequelize.transaction(async (tx) => {
        const options = { transaction: tx };
        const id = t.id;

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

        const del = async (Model, w) => { try { await Model.destroy({ where: w, ...options }); } catch (e) { console.warn('  ', Model.name, e.message); } };

        if (jobIds.length) await del(JobStatusHistory, { jobId: jobIds });
        if (jobIds.length) await del(JobItem, { jobId: jobIds });
        await del(Payment, { tenantId: id });
        await del(Expense, { tenantId: id });
        await del(Invoice, { tenantId: id });
        if (leadIds.length) await del(LeadActivity, { leadId: leadIds });
        await del(Job, { tenantId: id });
        if (quoteIds.length) await del(QuoteItem, { quoteId: quoteIds });
        await del(Quote, { tenantId: id });
        await del(Lead, { tenantId: id });
        if (saleIds.length) await del(SaleItem, { saleId: saleIds });
        await del(Sale, { tenantId: id });
        if (productIds.length) await del(ProductVariant, { productId: productIds });
        await del(Barcode, { tenantId: id });
        await del(Product, { tenantId: id });
        await del(Shop, { tenantId: id });
        if (prescriptionIds.length) await del(PrescriptionItem, { prescriptionId: prescriptionIds });
        await del(DrugInteraction, { tenantId: id });
        if (drugIds.length) await del(ExpiryAlert, { drugId: drugIds });
        await del(Prescription, { tenantId: id });
        await del(Drug, { tenantId: id });
        await del(Pharmacy, { tenantId: id });
        if (employeeIds.length) await del(EmployeeDocument, { employeeId: employeeIds });
        if (employeeIds.length) await del(EmploymentHistory, { employeeId: employeeIds });
        if (payrollRunIds.length) await del(PayrollEntry, { payrollRunId: payrollRunIds });
        await del(PayrollRun, { tenantId: id });
        await del(Employee, { tenantId: id });
        if (journalEntryIds.length) await del(JournalEntryLine, { journalEntryId: journalEntryIds });
        await del(JournalEntry, { tenantId: id });
        await del(AccountBalance, { tenantId: id });
        await Account.update({ parentId: null }, { where: { tenantId: id }, ...options });
        await del(Account, { tenantId: id });
        await del(InventoryMovement, { tenantId: id });
        await del(InventoryItem, { tenantId: id });
        await del(InventoryCategory, { tenantId: id });
        await del(Customer, { tenantId: id });
        await del(Vendor, { tenantId: id });
        await del(Setting, { tenantId: id });
        await del(PricingTemplate, { tenantId: id });
        await del(VendorPriceList, { tenantId: id });
        await del(CustomDropdownOption, { tenantId: id });
        await del(InviteToken, { tenantId: id });
        await del(Notification, { tenantId: id });
        await del(SabitoTenantMapping, { nexproTenantId: id });
        await del(UserTenant, { tenantId: id });
        await del(Tenant, { id });
      });
      console.log(`  Deleted: ${t.name}`);
    }

    console.log('\nDone. Last 5 businesses deleted.');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

run();
