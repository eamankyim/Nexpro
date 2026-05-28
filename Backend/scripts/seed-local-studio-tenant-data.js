/**
 * Seed a local studio tenant with demo records and about 5MB of job attachment storage.
 *
 * Usage:
 *   cd Backend && node scripts/seed-local-studio-tenant-data.js eamankyim4@gmail.com
 *
 * Optional env:
 *   SEED_CUSTOMERS=80 SEED_JOBS=25 SEED_QUOTES=20 SEED_INVOICES=15 SEED_UPLOAD_MB=5
 */
require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  User,
  UserTenant,
  Tenant,
  Customer,
  CustomerActivity,
  StudioLocation,
  ProductCategory,
  Product,
  Job,
  JobItem,
  JobStatusHistory,
  Quote,
  QuoteItem,
  Invoice,
  Payment,
  Vendor,
  Lead,
  UserTask,
  PricingTemplate,
} = require('../models');
const { getStorageUsageSummary } = require('../utils/storageLimitHelper');

const DEFAULT_OWNER_EMAIL = 'eamankyim4@gmail.com';

const counts = {
  customers: parseInt(process.env.SEED_CUSTOMERS || '80', 10),
  jobs: parseInt(process.env.SEED_JOBS || '25', 10),
  quotes: parseInt(process.env.SEED_QUOTES || '20', 10),
  invoices: parseInt(process.env.SEED_INVOICES || '15', 10),
  uploadMB: parseInt(process.env.SEED_UPLOAD_MB || '5', 10),
};

const firstNames = ['Kwame', 'Ama', 'Kofi', 'Akosua', 'Yaw', 'Efua', 'Kojo', 'Abena', 'Nana', 'Esi'];
const lastNames = ['Mensah', 'Osei', 'Asante', 'Boateng', 'Owusu', 'Appiah', 'Darko', 'Agyeman'];
const jobTypes = ['Business cards', 'Banner print', 'Brochure', 'Sticker labels', 'Wedding program', 'Invoice books'];
const statuses = ['new', 'in_progress', 'on_hold', 'completed'];
const studioServices = [
  { name: 'Business cards', unitPrice: 45, category: 'Stationery', paperSize: 'A6' },
  { name: 'Banner print', unitPrice: 120, category: 'Large format', paperSize: 'Custom' },
  { name: 'Brochure', unitPrice: 180, category: 'Marketing', paperSize: 'A4' },
  { name: 'Sticker labels', unitPrice: 65, category: 'Labels', paperSize: 'A5' },
  { name: 'Wedding program', unitPrice: 95, category: 'Events', paperSize: 'A5' },
  { name: 'Invoice books', unitPrice: 75, category: 'Business forms', paperSize: 'A5' },
];

function pick(items, index) {
  return items[index % items.length];
}

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function money(value) {
  return Number(value).toFixed(2);
}

async function resolveTenant(ownerEmail) {
  const user = await User.findOne({ where: { email: ownerEmail } });
  if (!user) throw new Error(`No user with email: ${ownerEmail}`);

  const userTenant = await UserTenant.findOne({
    where: { userId: user.id, status: 'active' },
    include: [{ model: Tenant, as: 'tenant' }],
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });

  if (!userTenant?.tenant) throw new Error(`No active tenant for ${ownerEmail}`);
  return { user, tenant: userTenant.tenant };
}

async function ensureStudioLocation(tenant, user) {
  const existing = await StudioLocation.findOne({
    where: { tenantId: tenant.id, isActive: true },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });

  if (existing) return existing;

  return StudioLocation.create({
    tenantId: tenant.id,
    name: `${tenant.name || 'Main'} Studio`,
    studioType: tenant.businessType || 'printing_press',
    code: `STU-${Date.now()}`,
    address: 'Local demo studio, Accra',
    city: 'Accra',
    state: 'Greater Accra',
    country: 'Ghana',
    phone: '+233241000000',
    email: user.email,
    managerUserId: user.id,
    isDefault: true,
    isActive: true,
    metadata: { seeded: true },
  });
}

async function seedCustomers(tenantId, studioLocationId, stamp) {
  const rows = [];
  for (let i = 0; i < counts.customers; i++) {
    const first = pick(firstNames, i);
    const last = pick(lastNames, i * 2);
    rows.push({
      tenantId,
      studioLocationId,
      name: `${first} ${last}`,
      company: i % 3 === 0 ? `${last} Creative Co` : null,
      email: `local.studio.customer.${stamp}.${i}@seed.local`,
      phone: `024${String((stamp + i) % 9000000).padStart(7, '0')}`,
      address: `House ${(i % 40) + 1}, East Legon`,
      city: 'Accra',
      state: 'Greater Accra',
      country: 'Ghana',
      howDidYouHear: pick(['Walk-in', 'Referral', 'Social Media', 'Signboard'], i),
      balance: i % 9 === 0 ? money(75 + i * 2) : '0.00',
      notes: 'Local seeded studio customer',
      whatsappConsent: i % 2 === 0,
      smsConsent: i % 3 === 0,
      marketingConsent: i % 4 === 0,
      isActive: true,
    });
  }

  return Customer.bulkCreate(rows, { individualHooks: true, validate: true });
}

async function cleanupSeededProductArtifacts(tenantId) {
  const deletedProducts = await Product.destroy({
    where: {
      tenantId,
      [Op.or]: [
        { sku: { [Op.like]: 'LOCAL-%' } },
        { imageUrl: { [Op.like]: `/uploads/products/${tenantId}/seed-%` } },
      ],
    },
  });
  const deletedCategories = await ProductCategory.destroy({
    where: { tenantId, name: 'Studio Seed Products' },
  });
  const productUploadDir = path.join(__dirname, '..', 'uploads', 'products', tenantId);
  await fs.rm(productUploadDir, { recursive: true, force: true });
  return { deletedProducts, deletedCategories };
}

async function seedJobAttachmentStorage(tenantId, jobs, stamp) {
  if (!jobs.length || counts.uploadMB <= 0) return 0;

  const targetBytes = counts.uploadMB * 1024 * 1024;
  const filesToCreate = Math.min(jobs.length, Math.max(1, counts.uploadMB));
  const bytesPerFile = Math.ceil(targetBytes / filesToCreate);

  for (let i = 0; i < filesToCreate; i++) {
    const job = jobs[i];
    const filename = `local-artwork-${stamp}-${i + 1}.txt`;
    const storagePath = path.join('jobs', job.id, filename);
    const filePath = path.join(__dirname, '..', 'uploads', storagePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const header = `ABS local studio seed artwork for ${job.jobNumber}\n`;
    const paddingLength = Math.max(0, bytesPerFile - Buffer.byteLength(header));
    await fs.writeFile(filePath, `${header}${'x'.repeat(paddingLength)}`);

    const attachments = Array.isArray(job.attachments) ? [...job.attachments] : [];
    attachments.push({
      id: `seed-${stamp}-${i + 1}`,
      originalName: filename,
      mimeType: 'text/plain',
      size: bytesPerFile,
      storagePath,
      uploadedAt: new Date().toISOString(),
      seeded: true,
    });
    await job.update({ attachments });
  }

  return filesToCreate;
}

async function seedCommercialData({ tenantId, userId, studioLocationId, customers, stamp }) {
  const vendors = await Vendor.bulkCreate(
    ['Accra Paper Wholesale', 'Tema Ink Supplies', 'Spintex Packaging'].map((name, i) => ({
      tenantId,
      name: `${name} ${stamp}`,
      company: name,
      email: `local.vendor.${stamp}.${i}@seed.local`,
      phone: `055${String((stamp + i) % 9000000).padStart(7, '0')}`,
      category: 'Studio supplies',
      isActive: true,
      notes: 'Local seeded vendor',
    })),
    { validate: true }
  );

  const leads = await Lead.bulkCreate(
    Array.from({ length: 15 }, (_, i) => ({
      tenantId,
      name: `${pick(firstNames, i + 3)} ${pick(lastNames, i + 1)}`,
      company: i % 2 === 0 ? `${pick(lastNames, i)} Events` : null,
      email: `local.lead.${stamp}.${i}@seed.local`,
      phone: `054${String((stamp + i) % 9000000).padStart(7, '0')}`,
      source: pick(['Website', 'Referral', 'Walk-in', 'Social Media'], i),
      status: pick(['new', 'contacted', 'qualified'], i),
      priority: pick(['low', 'medium', 'high'], i),
      createdBy: userId,
      notes: 'Local seeded lead',
      tags: ['seed', 'studio'],
      isActive: true,
    })),
    { validate: true }
  );

  const tasks = await UserTask.bulkCreate(
    Array.from({ length: 12 }, (_, i) => ({
      tenantId,
      userId,
      title: `${pick(['Call client', 'Prepare artwork', 'Check stock', 'Send quote'], i)} ${i + 1}`,
      status: pick(['todo', 'in_progress', 'completed'], i),
      priority: pick(['low', 'medium', 'high'], i),
      dueDate: dateOffset((i % 10) + 1).toISOString().slice(0, 10),
      description: 'Local seeded studio task',
      assigneeId: userId,
      isPrivate: false,
      metadata: { seeded: true },
    })),
    { validate: true }
  );

  const pricingTemplates = await PricingTemplate.bulkCreate(
    jobTypes.map((jobType, i) => ({
      tenantId,
      name: `${jobType} Local Seed ${stamp}`,
      category: 'Studio',
      jobType,
      pricingMethod: 'unit',
      basePrice: money(50 + i * 20),
      pricePerUnit: money(1.5 + i),
      minimumQuantity: 1,
      setupFee: money(i % 2 === 0 ? 20 : 0),
      description: 'Local seeded pricing template',
      isActive: true,
    })),
    { validate: true }
  );

  const jobs = [];
  for (let i = 0; i < counts.jobs; i++) {
    const customer = customers[i % customers.length];
    const service = studioServices[i % studioServices.length];
    const quantity = 10 + i * 2;
    const unitPrice = service.unitPrice;
    const total = quantity * unitPrice;
    const status = pick(statuses, i);
    const job = await Job.create({
      tenantId,
      studioLocationId,
      jobNumber: `LOCAL-JOB-${stamp}-${String(i + 1).padStart(3, '0')}`,
      customerId: customer.id,
      title: `${service.name} for ${customer.name}`,
      description: 'Local seeded studio job',
      status,
      createdBy: userId,
      assignedTo: userId,
      priority: pick(['low', 'medium', 'high', 'urgent'], i),
      jobType: service.name,
      quantity,
      paperType: pick(['Matte', 'Glossy', 'Bond', 'Card stock'], i),
      paperSize: service.paperSize,
      colorType: i % 3 === 0 ? 'black_white' : 'color',
      finishingOptions: { lamination: i % 2 === 0, binding: i % 4 === 0 },
      estimatedCost: money(total * 0.55),
      quotedPrice: money(total),
      finalPrice: money(total),
      orderDate: dateOffset(-i),
      startDate: status !== 'new' ? dateOffset(-i + 1) : null,
      dueDate: dateOffset((i % 12) + 1),
      completionDate: status === 'completed' ? dateOffset(-1) : null,
      notes: 'Local seeded job',
    });

    await JobItem.create({
      tenantId,
      jobId: job.id,
      category: service.category,
      description: service.name,
      paperSize: job.paperSize,
      quantity,
      unitPrice: money(unitPrice),
      totalPrice: money(total),
      specifications: { seeded: true },
    });

    await JobStatusHistory.create({
      tenantId,
      jobId: job.id,
      status,
      comment: 'Local seeded status',
      changedBy: userId,
    });
    jobs.push(job);
  }

  const quotes = [];
  for (let i = 0; i < counts.quotes; i++) {
    const customer = customers[(i * 2) % customers.length];
    const service = studioServices[i % studioServices.length];
    const subtotal = 120 + i * 35;
    const taxAmount = subtotal * 0.125;
    const quote = await Quote.create({
      tenantId,
      studioLocationId,
      quoteNumber: `LOCAL-QT-${stamp}-${String(i + 1).padStart(3, '0')}`,
      customerId: customer.id,
      title: `${pick(jobTypes, i)} quote`,
      description: 'Local seeded quote',
      status: pick(['draft', 'sent', 'accepted'], i),
      validUntil: dateOffset(14 + i),
      subtotal: money(subtotal),
      taxRate: '12.50',
      taxAmount: money(taxAmount),
      totalAmount: money(subtotal + taxAmount),
      notes: 'Local seeded quote',
      createdBy: userId,
    });

    await QuoteItem.create({
      tenantId,
      quoteId: quote.id,
      productId: null,
      description: service.name,
      quantity: 1 + (i % 6),
      unitPrice: money(subtotal),
      total: money(subtotal),
      metadata: { seeded: true },
    });
    quotes.push(quote);
  }

  const invoices = [];
  for (let i = 0; i < counts.invoices; i++) {
    const job = jobs[i % jobs.length];
    const customer = customers[i % customers.length];
    const subtotal = Number(job.finalPrice || 150);
    const taxAmount = subtotal * 0.125;
    const totalAmount = subtotal + taxAmount;
    const paid = i % 3 === 0 ? totalAmount : i % 3 === 1 ? totalAmount / 2 : 0;
    const status = paid >= totalAmount ? 'paid' : paid > 0 ? 'partial' : 'sent';

    const invoice = await Invoice.create({
      tenantId,
      studioLocationId,
      invoiceNumber: `LOCAL-INV-${stamp}-${String(i + 1).padStart(3, '0')}`,
      jobId: job.id,
      sourceType: 'job',
      customerId: customer.id,
      invoiceDate: dateOffset(-i),
      dueDate: dateOffset(14 - i),
      subtotal: money(subtotal),
      taxRate: '12.50',
      taxAmount: money(taxAmount),
      totalAmount: money(totalAmount),
      amountPaid: money(paid),
      balance: money(totalAmount - paid),
      status,
      paymentTerms: 'Net 14',
      items: [{ description: job.title, quantity: job.quantity, unitPrice: subtotal, total: subtotal }],
      notes: 'Local seeded invoice',
      sentDate: dateOffset(-i + 1),
      paidDate: status === 'paid' ? dateOffset(-i + 2) : null,
      publicToken: `local-${stamp}-${i}`,
    });
    invoices.push(invoice);

    if (paid > 0) {
      await Payment.create({
        tenantId,
        paymentNumber: `LOCAL-PAY-${stamp}-${String(i + 1).padStart(3, '0')}`,
        type: 'income',
        customerId: customer.id,
        jobId: job.id,
        amount: money(paid),
        paymentMethod: pick(['cash', 'mobile_money', 'bank_transfer'], i),
        paymentDate: dateOffset(-i + 2),
        referenceNumber: `REF-${stamp}-${i}`,
        status: 'completed',
        description: `Payment for ${invoice.invoiceNumber}`,
        notes: 'Local seeded payment',
      });
    }
  }

  const jobAttachmentFiles = await seedJobAttachmentStorage(tenantId, jobs, stamp);

  const activities = await CustomerActivity.bulkCreate(
    customers.slice(0, 25).map((customer, i) => ({
      tenantId,
      customerId: customer.id,
      type: pick(['call', 'email', 'meeting', 'note'], i),
      subject: `Seeded follow-up ${i + 1}`,
      notes: 'Local seeded customer activity',
      createdBy: userId,
      nextStep: i % 2 === 0 ? 'Send updated proof' : 'Confirm pickup date',
      followUpDate: dateOffset((i % 8) + 1),
      metadata: { seeded: true },
    })),
    { validate: true }
  );

  return {
    vendors: vendors.length,
    leads: leads.length,
    tasks: tasks.length,
    pricingTemplates: pricingTemplates.length,
    jobs: jobs.length,
    jobAttachmentFiles,
    quotes: quotes.length,
    invoices: invoices.length,
    activities: activities.length,
  };
}

async function main() {
  const ownerEmail = (process.argv[2] || DEFAULT_OWNER_EMAIL).trim().toLowerCase();
  const stamp = Date.now();

  await sequelize.authenticate();
  const { user, tenant } = await resolveTenant(ownerEmail);
  const studioLocation = await ensureStudioLocation(tenant, user);

  console.log(`Owner: ${user.email}`);
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Business type: ${tenant.businessType || 'unknown'}`);
  console.log(`Studio location: ${studioLocation.name} (${studioLocation.id})`);
  console.log(`Target job attachment storage size: ${counts.uploadMB}MB\n`);

  const productCleanup = await cleanupSeededProductArtifacts(tenant.id);
  if (productCleanup.deletedProducts || productCleanup.deletedCategories) {
    console.log(
      `Removed seeded product artifacts: products=${productCleanup.deletedProducts}, categories=${productCleanup.deletedCategories}\n`
    );
  }

  const customers = await seedCustomers(tenant.id, studioLocation.id, stamp);
  const summary = await seedCommercialData({
    tenantId: tenant.id,
    userId: user.id,
    studioLocationId: studioLocation.id,
    customers,
    stamp,
  });
  const storage = await getStorageUsageSummary(tenant.id);

  console.log('Inserted:');
  console.log(`  customers: ${customers.length}`);
  Object.entries(summary).forEach(([key, value]) => console.log(`  ${key}: ${value}`));
  console.log('\nStorage:');
  console.log(`  currentMB: ${storage.currentMB}`);
  console.log(`  limitMB: ${storage.limitMB ?? 'unlimited'}`);
  console.log(`  percentageUsed: ${storage.percentageUsed}%`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    if (Array.isArray(error.errors)) {
      error.errors.forEach((item) => {
        console.error(`  - ${item.path || item.type}: ${item.message}`);
      });
    }
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
