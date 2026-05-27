#!/usr/bin/env node
/**
 * Import Sulas Enterprise product catalog into one tenant's products.
 *
 * Safety model:
 * - Dry run by default
 * - Requires --execute and --confirm-import for real writes
 * - Resolves tenant from user email membership
 * - Uses product code as barcode when available
 * - Imports products without codes so barcodes can be added later in the UI
 *
 * Usage (from Backend/):
 *   # Preview only
 *   node scripts/import-sulas-products.js --email michaeltshribi17@gmail.com
 *
 *   # Execute against selected tenant
 *   node scripts/import-sulas-products.js \
 *     --email michaeltshribi17@gmail.com \
 *     --tenant-id <tenant-uuid-if-user-has-multiple> \
 *     --execute \
 *     --confirm-import
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { User, UserTenant, Tenant, Product } = require('../models');
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
const explicitTenantId = (getArgValue('--tenant-id', '') || '').trim() || null;
const sourcePath = path.resolve(
  process.cwd(),
  getArgValue('--source', DEFAULT_SOURCE)
);

const USAGE = `
Usage:
  node scripts/import-sulas-products.js --email <user-email> [--source <path-to-txt>] [--tenant-id <uuid>] [--execute --confirm-import]

Examples:
  node scripts/import-sulas-products.js --email michaeltshribi17@gmail.com

  node scripts/import-sulas-products.js \\
    --email michaeltshribi17@gmail.com \\
    --tenant-id 00000000-0000-0000-0000-000000000000 \\
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
  if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(trimmed)) return null;
  if (/^(TOTAL|INGCO|WADFOW)$/i.test(trimmed)) return null;

  const parts = trimmed.split(/\t+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  let quantityRaw = parts[parts.length - 1];
  if (!/^\d+(\.\d+)?$/.test(quantityRaw)) return null;

  const quantityOnHand = Number(quantityRaw);
  if (!Number.isFinite(quantityOnHand)) return null;

  let code = null;
  let name = null;
  if (parts.length >= 3) {
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
      quantityOnHand: Number(prev.quantityOnHand || 0) + Number(row.quantityOnHand || 0),
    });
  }

  return {
    merged: [...Array.from(byKey.values()), ...noBarcodeRows],
    duplicateInputCount: rows.length - byKey.size - noBarcodeRows.length,
    noBarcodeRows,
  };
}

async function resolveTenantByEmail(targetEmail, tenantIdOverride) {
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

function printSummary(label, value) {
  console.log(`${String(label).padEnd(28)} ${value}`);
}

async function main() {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required');
  if (!email) fail('Missing --email');
  if (isExecute && !shouldConfirm) fail('Execute mode requires --confirm-import');

  console.log('\n=== Sulas Product Import ===');
  printSummary('Mode', isDryRun ? 'DRY RUN' : 'EXECUTE');
  printSummary('Source', sourcePath);
  printSummary('Email', email);
  if (explicitTenantId) printSummary('Tenant override', explicitTenantId);

  await testConnection();

  const { user, tenant, tenantId, membershipRole } = await resolveTenantByEmail(email, explicitTenantId);
  const defaultShop = await ensureDefaultShop(tenantId);
  if (!defaultShop) {
    fail(`No default shop could be resolved/created for tenant ${tenantId}`);
  }

  console.log('\nTarget:');
  printSummary('User', `${user.name || 'Unknown'} <${user.email}>`);
  printSummary('Tenant', `${tenant?.name || 'Unknown'} (${tenantId})`);
  printSummary('Membership role', membershipRole || 'unknown');
  printSummary('Default shop', `${defaultShop.name} (${defaultShop.id})`);

  const rows = loadCatalogRows(sourcePath);
  const { merged, duplicateInputCount, noBarcodeRows } = mergeCatalogRows(rows);

  const barcodes = merged.map((r) => r.barcode).filter(Boolean);
  const existing = barcodes.length
    ? await Product.findAll({
        where: {
          tenantId,
          [Op.or]: [
            { barcode: { [Op.in]: barcodes } },
            { sku: { [Op.in]: barcodes } },
          ],
        },
        attributes: ['id', 'barcode', 'sku', 'name'],
        raw: true,
      })
    : [];

  const existingByCode = new Map();
  for (const p of existing) {
    if (p.barcode) existingByCode.set(p.barcode, p);
    if (p.sku) existingByCode.set(p.sku, p);
  }

  const toCreate = [];
  const skippedExisting = [];
  for (const row of merged) {
    const hit = row.barcode ? existingByCode.get(row.barcode) : null;
    if (hit) {
      skippedExisting.push({ row, product: hit });
      continue;
    }

    toCreate.push({
      tenantId,
      shopId: defaultShop.id,
      name: row.name,
      sku: null,
      barcode: row.barcode,
      description: null,
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
