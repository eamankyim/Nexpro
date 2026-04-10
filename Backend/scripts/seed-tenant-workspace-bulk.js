/**
 * Seed tasks, leads, vendors, employees, and pricing templates for a tenant (by owner email).
 *
 * Default counts: 10 tasks, 30 leads, 10 vendors, 5 employees, 10 pricing templates.
 *
 * Usage:
 *   cd Backend && node scripts/seed-tenant-workspace-bulk.js
 *   node scripts/seed-tenant-workspace-bulk.js nexuscreativestudios@gmail.com
 *
 * Env overrides (optional): SEED_TASKS, SEED_LEADS, SEED_VENDORS, SEED_EMPLOYEES, SEED_PRICING
 * Requires DATABASE_URL in .env
 */
require('dotenv').config();

const { sequelize } = require('../config/database');
const {
  User,
  UserTenant,
  Tenant,
  UserTask,
  Lead,
  Vendor,
  Employee,
  PricingTemplate
} = require('../models');

const DEFAULT_EMAIL = 'nexuscreativestudios@gmail.com';

const COUNTS = {
  tasks: parseInt(process.env.SEED_TASKS || '10', 10),
  leads: parseInt(process.env.SEED_LEADS || '30', 10),
  vendors: parseInt(process.env.SEED_VENDORS || '10', 10),
  employees: parseInt(process.env.SEED_EMPLOYEES || '5', 10),
  pricing: parseInt(process.env.SEED_PRICING || '10', 10)
};

const TASK_TITLES = [
  'Follow up print proof with client',
  'Reorder A3 paper stock',
  'Service wide-format printer',
  'Update pricing sheet for Q2',
  'Prepare quote for corporate brochure',
  'Schedule laminator maintenance',
  'Review open jobs backlog',
  'Train new staff on cutter',
  'Audit vendor invoices — March',
  'Backup design files to archive'
];

const TASK_STATUSES = ['todo', 'in_progress', 'on_hold', 'completed'];
const TASK_PRIORITIES = ['low', 'medium', 'high'];

const LEAD_FIRST = ['Kwesi', 'Aba', 'Yaw', 'Esi', 'Kojo', 'Afua', 'Nana', 'Adwoa', 'Fiifi', 'Lydia'];
const LEAD_LAST = ['Boateng', 'Owusu', 'Mensah', 'Appiah', 'Tetteh', 'Sarpong', 'Antwi', 'Quaye', 'Darko', 'Osei'];
const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'new', 'contacted', 'lost', 'qualified', 'new'];
const LEAD_SOURCES = ['Website', 'Walk-in', 'Referral', 'Social Media', 'Cold call', 'Trade show'];

const VENDOR_NAMES = [
  'Accra Paper Wholesale',
  'Tema Ink & Supplies',
  'Kumasi Binding Solutions',
  'Spintex Packaging Ltd',
  'Osu Office Depot',
  'East Legon Equipment Hire',
  'Madina Fasteners Co',
  'Takoradi Logistics Hub',
  'Ashaiman Chemical Supplies',
  'Labone Design Materials'
];

const EMP_FIRST = ['Samuel', 'Grace', 'Isaac', 'Ruth', 'Daniel'];
const EMP_LAST = ['Ofori', 'Mensah', 'Boadi', 'Agyei', 'Tawiah'];
const EMP_TITLES = ['Print operator', 'Graphic designer', 'Finishing specialist', 'Sales coordinator', 'Studio manager'];

const PRICING_BLUEPRINTS = [
  { name: 'Digital A4 B&W — per page', category: 'Digital printing', jobType: 'Copy', paperSize: 'A4', colorType: 'black_white', pricingMethod: 'unit', basePrice: 0, pricePerUnit: 0.5 },
  { name: 'Digital A4 Color — per page', category: 'Digital printing', jobType: 'Copy', paperSize: 'A4', colorType: 'color', pricingMethod: 'unit', basePrice: 0, pricePerUnit: 2.5 },
  { name: 'Large format poster — sq ft', category: 'Large format', jobType: 'Poster', paperSize: 'Custom', pricingMethod: 'square_foot', pricePerSquareFoot: 8, customUnit: 'feet' },
  { name: 'Business cards — box (250)', category: 'Stationery', jobType: 'Cards', paperType: '350gsm', pricingMethod: 'unit', basePrice: 45, pricePerUnit: 0, minimumQuantity: 1 },
  { name: 'Flyer A5 — 500 qty', category: 'Marketing', jobType: 'Flyer', paperSize: 'A5', colorType: 'color', pricingMethod: 'unit', basePrice: 120, pricePerUnit: 0 },
  { name: 'Brochure tri-fold — design + print', category: 'Marketing', jobType: 'Brochure', pricingMethod: 'unit', basePrice: 200, pricePerUnit: 0, setupFee: 50 },
  { name: 'Spiral binding — per book', category: 'Finishing', jobType: 'Binding', pricingMethod: 'unit', basePrice: 0, pricePerUnit: 15, setupFee: 5 },
  { name: 'Lamination — A3 sheet', category: 'Finishing', jobType: 'Lamination', paperSize: 'A3', pricingMethod: 'unit', basePrice: 0, pricePerUnit: 8 },
  { name: 'Canvas print — sq ft', category: 'Large format', jobType: 'Canvas', pricingMethod: 'square_foot', pricePerSquareFoot: 12 },
  { name: 'Sticker sheet — vinyl', category: 'Labels', jobType: 'Stickers', materialType: 'Vinyl', pricingMethod: 'unit', basePrice: 35, pricePerUnit: 0 }
];

async function resolveTenant(ownerEmail) {
  const user = await User.findOne({ where: { email: ownerEmail } });
  if (!user) throw new Error(`No user with email: ${ownerEmail}`);
  const userTenant = await UserTenant.findOne({
    where: { userId: user.id, status: 'active' },
    include: [{ model: Tenant, as: 'tenant' }],
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']]
  });
  if (!userTenant?.tenant) throw new Error(`No active tenant for ${ownerEmail}`);
  return { user, tenant: userTenant.tenant };
}

function parseEmailArg() {
  const a = process.argv[2];
  if (a && !a.startsWith('--')) return String(a).trim().toLowerCase();
  return DEFAULT_EMAIL;
}

async function main() {
  const ownerEmail = parseEmailArg();
  await sequelize.authenticate();
  console.log('Database connected.\n');

  const { user, tenant } = await resolveTenant(ownerEmail);
  const tenantId = tenant.id;
  const stamp = Date.now();

  console.log(`Tenant: ${tenant.name} (${tenantId})`);
  console.log(`Owner: ${user.email}`);
  console.log(`Counts: tasks=${COUNTS.tasks} leads=${COUNTS.leads} vendors=${COUNTS.vendors} employees=${COUNTS.employees} pricing=${COUNTS.pricing}\n`);

  const tasks = [];
  for (let i = 0; i < COUNTS.tasks; i++) {
    const d = new Date();
    d.setDate(d.getDate() + (i % 14) + 1);
    const due = d.toISOString().slice(0, 10);
    const t = await UserTask.create({
      tenantId,
      userId: user.id,
      title: `${TASK_TITLES[i % TASK_TITLES.length]} (#${i + 1})`,
      status: TASK_STATUSES[i % TASK_STATUSES.length],
      priority: TASK_PRIORITIES[i % TASK_PRIORITIES.length],
      dueDate: due,
      description: 'Seeded workspace task',
      assigneeId: i % 3 === 0 ? user.id : null,
      isPrivate: false,
      metadata: { seeded: true }
    });
    tasks.push(t.id);
  }
  console.log(`Created ${tasks.length} tasks`);

  const leads = [];
  for (let i = 0; i < COUNTS.leads; i++) {
    const fn = LEAD_FIRST[i % LEAD_FIRST.length];
    const ln = LEAD_LAST[(i * 2) % LEAD_LAST.length];
    const l = await Lead.create({
      tenantId,
      name: `${fn} ${ln}`,
      company: i % 4 === 0 ? `${ln} Holdings` : null,
      email: `seed.lead.${stamp}.${i}@lead.seed.local`,
      phone: `024${String(1000000 + (i % 8999999)).padStart(7, '0')}`,
      source: LEAD_SOURCES[i % LEAD_SOURCES.length],
      status: LEAD_STATUSES[i % LEAD_STATUSES.length],
      priority: ['low', 'medium', 'high'][i % 3],
      createdBy: user.id,
      notes: 'Seeded lead',
      tags: i % 5 === 0 ? ['seed', 'print'] : ['seed'],
      isActive: true
    });
    leads.push(l.id);
  }
  console.log(`Created ${leads.length} leads`);

  const vendors = [];
  for (let i = 0; i < COUNTS.vendors; i++) {
    const base = VENDOR_NAMES[i % VENDOR_NAMES.length];
    const v = await Vendor.create({
      tenantId,
      name: `${base} (seed ${i + 1})`,
      company: base,
      email: `seed.vendor.${stamp}.${i}@vendor.seed.local`,
      phone: `054${String(2000000 + (i % 7999999)).padStart(7, '0')}`,
      address: `${10 + i} Industrial Area, Accra`,
      city: 'Accra',
      country: 'Ghana',
      category: 'Supplies',
      isActive: true,
      notes: 'Seeded vendor'
    });
    vendors.push(v.id);
  }
  console.log(`Created ${vendors.length} vendors`);

  const employees = [];
  for (let i = 0; i < COUNTS.employees; i++) {
    const hd = new Date();
    hd.setMonth(hd.getMonth() - (12 + i * 2));
    const e = await Employee.create({
      tenantId,
      firstName: EMP_FIRST[i % EMP_FIRST.length],
      lastName: `${EMP_LAST[i % EMP_LAST.length]}-Seed${i + 1}`,
      email: `seed.employee.${stamp}.${i}@employee.seed.local`,
      phone: `055${String(3000000 + (i % 6999999)).padStart(7, '0')}`,
      jobTitle: EMP_TITLES[i % EMP_TITLES.length],
      department: 'Operations',
      employmentType: 'full_time',
      status: 'active',
      hireDate: hd.toISOString().slice(0, 10),
      salaryType: 'salary',
      salaryAmount: 2500 + i * 200,
      payFrequency: 'monthly',
      isActive: true,
      notes: 'Seeded employee'
    });
    employees.push(e.id);
  }
  console.log(`Created ${employees.length} employees`);

  const pricing = [];
  for (let i = 0; i < COUNTS.pricing; i++) {
    const bp = PRICING_BLUEPRINTS[i % PRICING_BLUEPRINTS.length];
    const row = {
      tenantId,
      name: `${bp.name} (seed ${i + 1})`,
      category: bp.category,
      jobType: bp.jobType || null,
      paperType: bp.paperType || null,
      paperSize: bp.paperSize || null,
      materialType: bp.materialType || null,
      pricingMethod: bp.pricingMethod || 'unit',
      colorType: bp.colorType || null,
      basePrice: bp.basePrice != null ? bp.basePrice : 0,
      pricePerUnit: bp.pricePerUnit != null ? bp.pricePerUnit : null,
      pricePerSquareFoot: bp.pricePerSquareFoot != null ? bp.pricePerSquareFoot : null,
      customUnit: bp.customUnit || null,
      minimumQuantity: bp.minimumQuantity != null ? bp.minimumQuantity : 1,
      setupFee: bp.setupFee != null ? bp.setupFee : 0,
      description: 'Seeded pricing template',
      isActive: true
    };
    const p = await PricingTemplate.create(row);
    pricing.push(p.id);
  }
  console.log(`Created ${pricing.length} pricing templates`);

  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
