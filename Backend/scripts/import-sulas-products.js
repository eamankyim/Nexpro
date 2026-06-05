#!/usr/bin/env node
/**
 * Import Sulas Enterprise product catalog into one tenant's products.
 *
 * Safety model:
 * - Dry run by default
 * - Requires --execute and --confirm-import for real writes
 * - Resolves tenant from user email membership
 * - Uses product code as barcode when available
 * - Supports either CODE<TAB>PRODUCT NAME<TAB>QUANTITY or
 *   ITEM<TAB>MODEL/HP<TAB>CODE<TAB>QUANTITY source rows
 * - Imports products without codes so barcodes can be added later in the UI
 *
 * Usage (from Backend/):
 *   # Preview only
 *   node scripts/import-sulas-products.js --tenant-name "Sulas Enterprise"
 *
 *   # Execute against selected tenant
 *   node scripts/import-sulas-products.js \
 *     --tenant-name "Sulas Enterprise" \
 *     --execute \
 *     --confirm-import
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { User, UserTenant, Tenant, Product, Shop, Barcode } = require('../models');
const { ensureDefaultShop } = require('../utils/shopUtils');

const DEFAULT_SOURCE = path.resolve(__dirname, 'data', 'sulas-enterprise-products.txt');

const argv = process.argv.slice(2);
const hasFlag = (flag) => argv.includes(flag);
const getArgValue = (flag, fallback = null) => {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
};

const isExecute = hasFlag('--execute');
const isDryRun = !isExecute;
const shouldConfirm = hasFlag('--confirm-import');
const email = (getArgValue('--email', '') || '').trim().toLowerCase();
const tenantName = (getArgValue('--tenant-name', '') || '').trim();
const explicitTenantId = (getArgValue('--tenant-id', '') || '').trim() || null;
const sourcePath = path.resolve(
  process.cwd(),
  getArgValue('--source', DEFAULT_SOURCE)
);

const USAGE = `
Usage:
  node scripts/import-sulas-products.js [--tenant-name <name> | --tenant-id <uuid> | --email <user-email>] [--source <path-to-txt>] [--execute --confirm-import]

Examples:
  node scripts/import-sulas-products.js --tenant-name "Sulas Enterprise"

  node scripts/import-sulas-products.js \\
    --tenant-name "Sulas Enterprise" \\
    --source scripts/data/sulas-enterprise-products-lawn-equipment.txt \\
    --execute --confirm-import
`;

function fail(message) {
  console.error(`\n❌ ${message}`);
  console.error(USAGE);
  process.exit(1);
}

function parseCatalogLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('#')) return null;
  if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(trimmed)) return null;
  if (/^(TOTAL|INGCO|WADFOW)$/i.test(trimmed)) return null;

  const parts = trimmed.includes('\t')
    ? trimmed.split('\t').map((p) => p.trim())
    : trimmed.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  let quantityRaw = parts[parts.length - 1];
  if (!/^\d+(\.\d+)?$/.test(quantityRaw)) return null;

  const quantityOnHand = Number(quantityRaw);
  if (!Number.isFinite(quantityOnHand)) return null;

  let code = null;
  let name = null;

  if (parts.length >= 4) {
    const item = parts[0];
    const model = parts[1];
    code = parts[2];
    name = [item, model].filter(Boolean).join(' ').trim();
  } else if (parts.length >= 3) {
    code = parts[0];
    name = parts.slice(1, -1).join(' ').trim();
  } else {
    name = parts[0];
  }

  if (!name) return null;

  if (code) {
    code = String(code).trim();
    if (!code || /^(TOTAL|INGCO|WADFOW)$/i.test(code)) {
      code = null;
    }
  }

  return {
    code,
    barcode: code || null,
    name: String(name).replace(/\s+/g, ' ').trim(),
    item: parts.length >= 4 ? parts[0] : null,
    model: parts.length >= 4 ? parts[1] : null,
    quantityOnHand,
  };
}

function loadCatalogRows(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Source file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    const parsed = parseCatalogLine(line);
    if (parsed) rows.push(parsed);
  }
  return rows;
}

function mergeCatalogRows(rows) {
  const byKey = new Map();
  const noBarcodeRows = [];

  for (const row of rows) {
    if (!row.barcode) {
      noBarcodeRows.push({ ...row });
      continue;
    }

    const key = row.barcode;
    if (!byKey.has(key)) {
      byKey.set(key, { ...row });
      continue;
    }

    const prev = byKey.get(key);
    byKey.set(key, {
      ...prev,
      name: prev.name || row.name,
      item: prev.item || row.item,
      model: prev.model || row.model,
      quantityOnHand: Number(prev.quantityOnHand || 0) + Number(row.quantityOnHand || 0),
    });
  }

  return {
    merged: [...Array.from(byKey.values()), ...noBarcodeRows],
    duplicateInputCount: rows.length - byKey.size - noBarcodeRows.length,
    noBarcodeRows,
  };
}

async function resolveTenantDirectly({ tenantIdOverride, targetTenantName }) {
  if (tenantIdOverride) {
    const tenant = await Tenant.findByPk(tenantIdOverride, {
      attributes: ['id', 'name', 'status'],
      raw: true,
    });
    if (!tenant) fail(`No tenant found for tenantId: ${tenantIdOverride}`);
    return { user: null, tenant, tenantId: tenant.id, membershipRole: null };
  }

  const tenants = await Tenant.findAll({
    where: { name: { [Op.iLike]: targetTenantName } },
    attributes: ['id', 'name', 'status'],
    raw: true,
  });

  if (!tenants.length) fail(`No tenant found with name: ${targetTenantName}`);
  if (tenants.length > 1) {
    console.error('\nMultiple tenants matched. Re-run with --tenant-id:');
    tenants.forEach((tenant) => {
      console.error(`- ${tenant.id} (${tenant.name}) status=${tenant.status || 'unknown'}`);
    });
    process.exit(1);
  }

  const tenant = tenants[0];
  return { user: null, tenant, tenantId: tenant.id, membershipRole: null };
}

async function resolveTenantByEmail(targetEmail, tenantIdOverride, targetTenantName) {
  const user = await User.findOne({
    where: { email: targetEmail },
    attributes: ['id', 'email', 'name'],
    raw: true,
  });

  if (!user) {
    fail(`No user found for email: ${targetEmail}`);
  }

  const memberships = await UserTenant.findAll({
    where: {
      userId: user.id,
      status: { [Op.in]: ['active', 'invited'] },
    },
    include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name', 'status'] }],
    order: [['createdAt', 'ASC']],
  });

  if (!memberships.length) {
    fail(`User ${targetEmail} has no tenant memberships`);
  }

  const matchedMemberships = tenantIdOverride
    ? memberships.filter((m) => m.tenantId === tenantIdOverride)
    : targetTenantName
      ? memberships.filter((m) => m.tenant?.name?.toLowerCase() === targetTenantName.toLowerCase())
    : memberships;

  if (tenantIdOverride && matchedMemberships.length === 0) {
    fail(`No membership found for tenantId ${tenantIdOverride} and user ${targetEmail}`);
  }

  if (matchedMemberships.length > 1 && !tenantIdOverride) {
    console.error('\nUser belongs to multiple tenants. Re-run with --tenant-id:');
    for (const m of matchedMemberships) {
      console.error(`- ${m.tenantId} (${m.tenant?.name || 'Unknown tenant'}) status=${m.tenant?.status || 'unknown'}`);
    }
    process.exit(1);
  }

  const selected = matchedMemberships[0];
  return {
    user,
    tenant: selected.tenant?.toJSON ? selected.tenant.toJSON() : selected.tenant,
    tenantId: selected.tenantId,
    membershipRole: selected.role,
  };
}

async function resolveTenantTarget({ targetEmail, tenantIdOverride, targetTenantName }) {
  if (targetEmail) {
    return resolveTenantByEmail(targetEmail, tenantIdOverride, targetTenantName);
  }

  return resolveTenantDirectly({ tenantIdOverride, targetTenantName });
}

async function resolveMainShop(tenantId) {
  if (!isDryRun) {
    return ensureDefaultShop(tenantId);
  }

  const defaultShop = await Shop.findOne({
    where: { tenantId, isDefault: true },
    order: [['createdAt', 'ASC']],
  });
  if (defaultShop) return defaultShop;

  return Shop.findOne({
    where: { tenantId },
    order: [['createdAt', 'ASC']],
  });
}

function printSummary(label, value) {
  console.log(`${String(label).padEnd(28)} ${value}`);
}

async function main() {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required');
  if (!email && !explicitTenantId && !tenantName) fail('Missing --tenant-name, --tenant-id, or --email');
  if (isExecute && !shouldConfirm) fail('Execute mode requires --confirm-import');

  console.log('\n=== Sulas Product Import ===');
  printSummary('Mode', isDryRun ? 'DRY RUN' : 'EXECUTE');
  printSummary('Source', sourcePath);
  if (email) printSummary('Email', email);
  if (tenantName) printSummary('Tenant name', tenantName);
  if (explicitTenantId) printSummary('Tenant override', explicitTenantId);

  await testConnection();

  const { user, tenant, tenantId, membershipRole } = await resolveTenantTarget({
    targetEmail: email,
    tenantIdOverride: explicitTenantId,
    targetTenantName: tenantName,
  });
  const defaultShop = await resolveMainShop(tenantId);
  if (!defaultShop) {
    fail(`No main/default shop could be resolved for tenant ${tenantId}`);
  }

  console.log('\nTarget:');
  if (user) printSummary('User', `${user.name || 'Unknown'} <${user.email}>`);
  printSummary('Tenant', `${tenant?.name || 'Unknown'} (${tenantId})`);
  if (membershipRole) printSummary('Membership role', membershipRole);
  printSummary('Default shop', `${defaultShop.name} (${defaultShop.id})`);

  const rows = loadCatalogRows(sourcePath);
  const { merged, duplicateInputCount, noBarcodeRows } = mergeCatalogRows(rows);

  const barcodes = merged.map((r) => r.barcode).filter(Boolean);
  const existing = barcodes.length
    ? await Product.findAll({
        where: {
          tenantId,
          shopId: defaultShop.id,
          [Op.or]: [
            { barcode: { [Op.in]: barcodes } },
            { sku: { [Op.in]: barcodes } },
          ],
        },
        attributes: ['id', 'barcode', 'sku', 'name', 'shopId'],
        raw: true,
      })
    : [];
  const existingAliases = barcodes.length
    ? await Barcode.findAll({
        where: {
          tenantId,
          barcode: { [Op.in]: barcodes },
          productId: { [Op.ne]: null },
        },
        include: [{
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'shopId'],
          where: { shopId: defaultShop.id },
          required: true,
        }],
        attributes: ['barcode', 'productId'],
        raw: true,
        nest: true,
      })
    : [];
  const noBarcodeNames = merged
    .filter((r) => !r.barcode)
    .map((r) => r.name)
    .filter(Boolean);
  const existingNoBarcode = noBarcodeNames.length
    ? await Product.findAll({
        where: {
          tenantId,
          shopId: defaultShop.id,
          barcode: null,
          name: { [Op.in]: noBarcodeNames },
        },
        attributes: ['id', 'barcode', 'sku', 'name', 'shopId'],
        raw: true,
      })
    : [];

  const existingByCode = new Map();
  for (const p of existing) {
    if (p.barcode) existingByCode.set(p.barcode, p);
    if (p.sku) existingByCode.set(p.sku, p);
  }
  for (const alias of existingAliases) {
    if (alias.barcode) {
      existingByCode.set(alias.barcode, {
        id: alias.productId,
        barcode: alias.barcode,
        sku: null,
        name: alias.product?.name,
        shopId: alias.product?.shopId,
      });
    }
  }
  const existingNoBarcodeNames = new Map(existingNoBarcode.map((p) => [p.name, p]));

  const toCreate = [];
  const skippedExisting = [];
  for (const row of merged) {
    const hit = row.barcode ? existingByCode.get(row.barcode) : existingNoBarcodeNames.get(row.name);
    if (hit) {
      skippedExisting.push({ row, product: hit });
      continue;
    }
    const descriptionParts = [];
    if (row.model) descriptionParts.push(`Model/HP: ${row.model}`);
    if (row.code) descriptionParts.push(`Product code: ${row.code}`);

    toCreate.push({
      tenantId,
      shopId: defaultShop.id,
      name: row.name,
      sku: null,
      barcode: row.barcode,
      description: descriptionParts.length ? descriptionParts.join('\n') : null,
      categoryId: null,
      costPrice: 0,
      sellingPrice: 0,
      quantityOnHand: row.quantityOnHand,
      reorderLevel: 0,
      reorderQuantity: 0,
      unit: 'pcs',
      isActive: true,
      trackStock: true,
      hasVariants: false,
      metadata: {
        importSource: 'sulas-enterprise-products',
        importedByScript: 'scripts/import-sulas-products.js',
        item: row.item || null,
        modelOrHp: row.model || null,
        productCode: row.code || null,
        missingBarcode: !row.barcode,
      },
    });
  }

  console.log('\nPlan:');
  printSummary('Parsed rows', rows.length);
  printSummary('Products after merge', merged.length);
  printSummary('Duplicate rows merged', duplicateInputCount);
  printSummary('No barcode rows included', noBarcodeRows.length);
  printSummary('Already exists', skippedExisting.length);
  printSummary('Will create', toCreate.length);

  if (noBarcodeRows.length) {
    console.log('\nExamples included without product code/barcode:');
    noBarcodeRows.slice(0, 10).forEach((r, idx) => {
      console.log(`${idx + 1}. ${r.name} (qty ${r.quantityOnHand})`);
    });
  }

  if (isDryRun) {
    console.log('\nDry run complete. No database changes made.');
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    if (toCreate.length) {
      await Product.bulkCreate(toCreate, { transaction });
    }
    await transaction.commit();
    console.log(`\n✅ Import completed. Created ${toCreate.length} products.`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('\n💥 Import failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (_err) {
      // no-op
    }
  });
