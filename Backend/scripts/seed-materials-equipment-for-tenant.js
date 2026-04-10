/**
 * Insert demo material items and equipment for the workspace of a user email.
 *
 * Usage:
 *   cd Backend && node scripts/seed-materials-equipment-for-tenant.js
 *   node scripts/seed-materials-equipment-for-tenant.js nexuscreativestudios@gmail.com 5
 *
 * Default: 5 materials + 5 equipment. Third arg overrides count for each.
 * Requires DATABASE_URL in .env
 */
require('dotenv').config();

const { sequelize } = require('../config/database');
const {
  User,
  UserTenant,
  Tenant,
  Vendor,
  MaterialCategory,
  MaterialItem,
  EquipmentCategory,
  Equipment
} = require('../models');

const DEFAULT_OWNER_EMAIL = 'nexuscreativestudios@gmail.com';
const DEFAULT_EACH = 5;

const MATERIAL_SEEDS = [
  { name: 'A3 Matte Paper (ream)', unit: 'ream', qty: 24, reorder: 6, unitCost: 85.0, skuSuffix: 'A3-PAP' },
  { name: 'CMYK Toner Set — Wide format', unit: 'set', qty: 8, reorder: 2, unitCost: 1200.0, skuSuffix: 'TONER-CMYK' },
  { name: 'Lamination film roll 305mm', unit: 'roll', qty: 15, reorder: 4, unitCost: 220.0, skuSuffix: 'LAM-FILM' },
  { name: 'Spiral binding coils 14mm', unit: 'box', qty: 40, reorder: 10, unitCost: 45.0, skuSuffix: 'BIND-COIL' },
  { name: 'Rigid mailers A4', unit: 'pack', qty: 200, reorder: 50, unitCost: 1.2, skuSuffix: 'MAIL-A4' }
];

const EQUIPMENT_SEEDS = [
  { name: 'Wide-format inkjet printer', value: 18500.0, serial: 'WF-PR-001', location: 'Print floor' },
  { name: 'Digital vinyl cutter', value: 6200.0, serial: 'CUT-DV-002', location: 'Finishing bay' },
  { name: 'Heated roll laminator', value: 3400.0, serial: 'LAM-HR-003', location: 'Finishing bay' },
  { name: 'Electric perfect binder', value: 2800.0, serial: 'BIND-PB-004', location: 'Bindery' },
  { name: 'Guillotine paper trimmer', value: 1500.0, serial: 'TRIM-GQ-005', location: 'Cut room' }
];

function parseArgs() {
  const a2 = process.argv[2];
  const a3 = process.argv[3];
  let email = DEFAULT_OWNER_EMAIL;
  let each = DEFAULT_EACH;
  if (a2 && !/^\d+$/.test(a2)) email = String(a2).trim().toLowerCase();
  if (a3 && /^\d+$/.test(a3)) each = Math.min(50, Math.max(1, parseInt(a3, 10)));
  else if (a2 && /^\d+$/.test(a2)) each = Math.min(50, Math.max(1, parseInt(a2, 10)));
  return { email, each };
}

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

function materialCategoryTypesFromTenant(tenant) {
  const bt = tenant.businessType;
  if (['printing_press', 'mechanic', 'barber', 'salon'].includes(bt)) {
    return { businessType: 'studio', studioType: bt };
  }
  if (bt === 'shop' || bt === 'studio' || bt === 'pharmacy') {
    return { businessType: bt, studioType: null };
  }
  return { businessType: 'studio', studioType: 'printing_press' };
}

async function ensureMaterialCategory(tenantId, tenant) {
  let cat = await MaterialCategory.findOne({
    where: { tenantId, isActive: true },
    order: [['createdAt', 'ASC']]
  });
  if (!cat) {
    const { businessType, studioType } = materialCategoryTypesFromTenant(tenant);
    cat = await MaterialCategory.create({
      tenantId,
      name: 'Company assets (seed)',
      description: 'Auto-created for seeded material items',
      businessType,
      studioType,
      isActive: true
    });
    console.log(`Created material category: ${cat.name}`);
  }
  return cat;
}

async function ensureEquipmentCategory(tenantId) {
  let cat = await EquipmentCategory.findOne({
    where: { tenantId, isActive: true },
    order: [['createdAt', 'ASC']]
  });
  if (!cat) {
    cat = await EquipmentCategory.create({
      tenantId,
      name: 'Company assets (seed)',
      description: 'Auto-created for seeded equipment',
      isActive: true
    });
    console.log(`Created equipment category: ${cat.name}`);
  }
  return cat;
}

async function main() {
  const { email: ownerEmail, each } = parseArgs();

  await sequelize.authenticate();
  console.log('Database connected.\n');

  const { tenant } = await resolveTenant(ownerEmail);
  const tenantId = tenant.id;

  const vendor = await Vendor.findOne({ where: { tenantId }, order: [['createdAt', 'ASC']] });

  console.log(`Tenant: ${tenant.name} (${tenantId})`);
  console.log(`Materials: ${each}, Equipment: ${each}\n`);

  const matCategory = await ensureMaterialCategory(tenantId, tenant);
  const eqCategory = await ensureEquipmentCategory(tenantId);

  const stamp = Date.now();
  const materialsCreated = [];
  const equipmentCreated = [];

  for (let i = 0; i < each; i++) {
    const seed = MATERIAL_SEEDS[i % MATERIAL_SEEDS.length];
    const sku = `NXS-${stamp}-${seed.skuSuffix}-${i + 1}`;
    const item = await MaterialItem.create({
      tenantId,
      categoryId: matCategory.id,
      name: `${seed.name} (seed ${i + 1})`,
      sku,
      description: 'Seeded company material asset',
      unit: seed.unit,
      quantityOnHand: seed.qty + i * 2,
      reorderLevel: seed.reorder,
      unitCost: seed.unitCost,
      preferredVendorId: vendor?.id || null,
      location: 'Main store',
      isActive: true
    });
    materialsCreated.push(item.name);
  }

  const purchaseBase = new Date();
  purchaseBase.setMonth(purchaseBase.getMonth() - 18);

  for (let i = 0; i < each; i++) {
    const seed = EQUIPMENT_SEEDS[i % EQUIPMENT_SEEDS.length];
    const purchaseDate = new Date(purchaseBase);
    purchaseDate.setMonth(purchaseDate.getMonth() + i * 3);
    const d = purchaseDate.toISOString().slice(0, 10);
    const eq = await Equipment.create({
      tenantId,
      categoryId: eqCategory.id,
      name: `${seed.name} (seed ${i + 1})`,
      description: 'Seeded company equipment asset',
      purchaseDate: d,
      purchaseValue: seed.value + i * 100,
      location: seed.location,
      serialNumber: `${seed.serial}-S${stamp}-${i + 1}`,
      status: 'active',
      vendorId: vendor?.id || null,
      notes: 'Seeded for testing',
      isActive: true
    });
    equipmentCreated.push(eq.name);
  }

  console.log('Materials created:');
  materialsCreated.forEach((n) => console.log(`  - ${n}`));
  console.log('\nEquipment created:');
  equipmentCreated.forEach((n) => console.log(`  - ${n}`));
  console.log(`\nDone (${materialsCreated.length} materials, ${equipmentCreated.length} equipment).`);
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
