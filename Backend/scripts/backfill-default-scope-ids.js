/**
 * Backfill legacy rows with each tenant's default shopId or studioLocationId.
 * Safe to run multiple times; only rows with NULL scope ids are updated.
 *
 * Usage:
 *   node scripts/backfill-default-scope-ids.js --dry-run
 *   node scripts/backfill-default-scope-ids.js --apply
 *   node scripts/backfill-default-scope-ids.js --dry-run --scope shop
 *   node scripts/backfill-default-scope-ids.js --apply --scope studio
 *   node scripts/backfill-default-scope-ids.js --dry-run --scope studio --tenant-email owner@example.com
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { QueryTypes } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { Tenant, Shop, StudioLocation } = require('../models');
const { resolveBusinessType } = require('../config/businessTypes');
const { ensureDefaultShop } = require('../utils/shopUtils');
const { ensureDefaultStudioLocation } = require('../utils/studioLocationUtils');

const SHOP_TABLES = [
  'customers',
  'products',
  'sales',
  'expenses',
  'invoices',
  'vendors',
  'equipment',
  'quotes',
  'materials_items',
  'foot_traffic',
  'stock_counts',
];

const STUDIO_TABLES = [
  'customers',
  'jobs',
  'quotes',
  'invoices',
  'leads',
  'expenses',
  'customer_feedback',
  'user_tasks',
  'materials_items',
  'equipment',
];
const VALID_SCOPES = ['all', 'shop', 'studio'];
const TENANT_EMAIL_ROLES = ['owner', 'admin'];
const isApply = process.argv.includes('--apply');
const isDryRun = process.argv.includes('--dry-run') || !isApply;

const getArgValue = (name, fallback) => {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
};

const requestedScope = getArgValue('--scope', 'all');
const requestedTenantEmail = getArgValue('--tenant-email', null)?.trim().toLowerCase() || null;
const requestedTenantId = getArgValue('--tenant-id', null)?.trim() || null;
if (!VALID_SCOPES.includes(requestedScope)) {
  throw new Error(`Invalid --scope "${requestedScope}". Expected one of: ${VALID_SCOPES.join(', ')}`);
}
if (requestedTenantEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedTenantEmail)) {
  throw new Error(`Invalid --tenant-email "${requestedTenantEmail}"`);
}

const quoteIdent = (identifier) => {
  if (!/^[a-z][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
};

const tableExists = async (tableName) => {
  const rows = await sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = :tableName
     LIMIT 1`,
    { replacements: { tableName }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
};

const columnExists = async (tableName, columnName) => {
  const rows = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = :tableName AND column_name = :columnName
     LIMIT 1`,
    { replacements: { tableName, columnName }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
};

const getAvailableTargets = async (tables, columnName) => {
  const targets = [];
  for (const tableName of tables) {
    const exists = await tableExists(tableName);
    if (!exists) {
      console.log(`  skipping ${tableName}.${columnName}: table missing`);
      continue;
    }
    const hasTenantId = await columnExists(tableName, 'tenantId');
    const hasScopeColumn = await columnExists(tableName, columnName);
    if (!hasTenantId || !hasScopeColumn) {
      console.log(`  skipping ${tableName}.${columnName}: required column missing`);
      continue;
    }
    targets.push({ tableName, columnName });
  }
  return targets;
};

const countNullRows = async ({ tableName, columnName }, tenantId, transaction = null) => {
  const rows = await sequelize.query(
    `SELECT COUNT(*)::int AS count
     FROM ${quoteIdent(tableName)}
     WHERE "tenantId" = :tenantId AND ${quoteIdent(columnName)} IS NULL`,
    {
      replacements: { tenantId },
      transaction,
      type: QueryTypes.SELECT,
    }
  );
  return Number(rows[0]?.count || 0);
};

const updateNullRows = async ({ tableName, columnName }, tenantId, scopeId, transaction) => {
  const [, metadata] = await sequelize.query(
    `UPDATE ${quoteIdent(tableName)}
     SET ${quoteIdent(columnName)} = :scopeId
     WHERE "tenantId" = :tenantId AND ${quoteIdent(columnName)} IS NULL`,
    {
      replacements: { tenantId, scopeId },
      transaction,
    }
  );
  return Number(metadata?.rowCount || 0);
};

const getDefaultState = async (model, tenantId, transaction = null) => {
  const opts = transaction ? { transaction } : {};
  const count = await model.count({ where: { tenantId }, ...opts });
  const defaultCount = await model.count({ where: { tenantId, isDefault: true }, ...opts });
  return { count, defaultCount };
};

const defaultActionFor = ({ count, defaultCount }) => {
  if (defaultCount > 0) return 'reuse';
  if (count > 0) return 'promote';
  return 'create';
};

const findExistingScopeRow = async (tableName, tenantId, transaction = null) => {
  const rows = await sequelize.query(
    `SELECT id, name
     FROM ${quoteIdent(tableName)}
     WHERE "tenantId" = :tenantId
     ORDER BY "isDefault" DESC, "isActive" DESC, "createdAt" ASC
     LIMIT 1`,
    {
      replacements: { tenantId },
      transaction,
      type: QueryTypes.SELECT,
    }
  );
  return rows[0] || null;
};

const formatTableCounts = (tables) =>
  tables
    .filter((table) => table.nullCount > 0 || table.updated > 0)
    .map((table) => `${table.tableName}:${isApply ? table.updated : table.nullCount}`)
    .join(', ') || 'none';

const getTenantsForRun = async (scopes) => {
  if (requestedTenantId && !requestedTenantEmail) {
    const tenant = await Tenant.findByPk(requestedTenantId, {
      attributes: ['id', 'name', 'businessType', 'metadata'],
    });
    if (!tenant) {
      throw new Error(`No tenant found for --tenant-id ${requestedTenantId}`);
    }
    return [tenant];
  }

  if (!requestedTenantEmail) {
    return Tenant.findAll({
      attributes: ['id', 'name', 'businessType', 'metadata'],
      order: [['createdAt', 'ASC']],
    });
  }

  const rows = await sequelize.query(
    `SELECT DISTINCT t.id, t.name, t."businessType", t.metadata, t."createdAt"
     FROM tenants t
     INNER JOIN user_tenants ut ON ut."tenantId" = t.id
     INNER JOIN users u ON u.id = ut."userId"
     WHERE LOWER(u.email) = :email
       AND ut.role IN (:roles)
       AND ut.status = 'active'
       AND (:tenantId IS NULL OR t.id = :tenantId)
     ORDER BY t."createdAt" ASC`,
    {
      replacements: {
        email: requestedTenantEmail,
        roles: TENANT_EMAIL_ROLES,
        tenantId: requestedTenantId,
      },
      type: QueryTypes.SELECT,
    }
  );

  if (!rows.length) {
    throw new Error(
      `No tenant found for owner/admin email ${requestedTenantEmail}${requestedTenantId ? ` and tenant ${requestedTenantId}` : ''}`
    );
  }

  const matchingScopeRows = rows.filter((tenant) => scopes.includes(resolveBusinessType(tenant.businessType)));
  if (!matchingScopeRows.length) {
    throw new Error(
      `No ${scopes.join('/')} tenant found for owner/admin email ${requestedTenantEmail}. Matched tenants: ${rows
        .map((tenant) => `${tenant.name} (${tenant.id}, type=${resolveBusinessType(tenant.businessType)})`)
        .join('; ')}`
    );
  }

  if (matchingScopeRows.length > 1 && !requestedTenantId) {
    throw new Error(
      `Owner/admin email ${requestedTenantEmail} matches multiple ${scopes.join('/')} tenants. Re-run with --tenant-id. Matches: ${matchingScopeRows
        .map((tenant) => `${tenant.name} (${tenant.id})`)
        .join('; ')}`
    );
  }

  return matchingScopeRows;
};

const processTenantScope = async ({ tenant, scope, targets }) => {
  const model = scope === 'shop' ? Shop : StudioLocation;
  const columnName = scope === 'shop' ? 'shopId' : 'studioLocationId';
  const scopeTable = scope === 'shop' ? 'shops' : 'studio_locations';
  const ensureDefault =
    scope === 'shop'
      ? (transaction) => ensureDefaultShop(tenant.id, { name: tenant.name, source: 'scope-id-backfill' }, transaction)
      : (transaction) =>
          ensureDefaultStudioLocation(
            tenant.id,
            { name: tenant.name || 'Main studio', source: 'scope-id-backfill' },
            transaction
          );

  const run = async (transaction = null) => {
    const before = await getDefaultState(model, tenant.id, transaction);
    const action = defaultActionFor(before);
    const existingScopeRow = isApply ? null : await findExistingScopeRow(scopeTable, tenant.id, transaction);
    const scopeRow = isApply
      ? await ensureDefault(transaction)
      : existingScopeRow || { id: null, name: tenant.name || (scope === 'shop' ? 'Main shop' : 'Main studio') };

    const tables = [];
    for (const target of targets) {
      const nullCount = await countNullRows(target, tenant.id, transaction);
      let updated = 0;
      if (isApply && nullCount > 0 && scopeRow?.id) {
        updated = await updateNullRows(target, tenant.id, scopeRow.id, transaction);
      }
      tables.push({ ...target, columnName, nullCount, updated });
    }

    return { action, scopeId: scopeRow?.id || null, scopeName: scopeRow?.name || null, tables };
  };

  const result = isApply ? await sequelize.transaction(run) : await run();
  const total = result.tables.reduce(
    (sum, table) => sum + (isApply ? table.updated : table.nullCount),
    0
  );
  console.log(
    `[${isApply ? 'apply' : 'dry-run'}] ${tenant.name} (${tenant.id}) ${scope} action=${result.action} ${scope}Id=${result.scopeId || 'missing'} scopeName=${result.scopeName || 'missing'} rows=${total} tables=${formatTableCounts(result.tables)}`
  );
  for (const table of result.tables) {
    console.log(
      `  ${table.tableName}.${table.columnName}: ${isApply ? 'updated' : 'would update'}=${isApply ? table.updated : table.nullCount}`
    );
  }
  return { total, action: result.action };
};

async function main() {
  await testConnection();
  console.log(`Mode: ${isApply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Scope: ${requestedScope}\n`);
  if (requestedTenantEmail) {
    console.log(`Tenant email filter: ${requestedTenantEmail} (${TENANT_EMAIL_ROLES.join('/')} memberships only)`);
  }
  if (requestedTenantId) {
    console.log(`Tenant id filter: ${requestedTenantId}`);
  }
  if (requestedTenantEmail || requestedTenantId) {
    console.log('');
  }

  const scopes = requestedScope === 'all' ? ['shop', 'studio'] : [requestedScope];
  const targetByScope = {};

  if (scopes.includes('shop')) {
    console.log('Checking shop-scoped tables...');
    targetByScope.shop = await getAvailableTargets(SHOP_TABLES, 'shopId');
  }
  if (scopes.includes('studio')) {
    console.log('Checking studio-scoped tables...');
    targetByScope.studio = await getAvailableTargets(STUDIO_TABLES, 'studioLocationId');
  }
  console.log('');

  const tenants = await getTenantsForRun(scopes);

  const totals = {
    shop: { tenants: 0, rows: 0, create: 0, promote: 0, reuse: 0 },
    studio: { tenants: 0, rows: 0, create: 0, promote: 0, reuse: 0 },
  };

  for (const tenant of tenants) {
    const resolvedType = resolveBusinessType(tenant.businessType);
    for (const scope of scopes) {
      if (resolvedType !== scope) continue;
      const targets = targetByScope[scope] || [];
      if (!targets.length) continue;

      const result = await processTenantScope({ tenant, scope, targets });
      totals[scope].tenants += 1;
      totals[scope].rows += result.total;
      totals[scope][result.action] += 1;
    }
  }

  console.log('\nDone.');
  for (const scope of scopes) {
    const total = totals[scope];
    console.log(
      `  ${scope}: tenants=${total.tenants}, ${isApply ? 'updated' : 'would update'} rows=${total.rows}, create=${total.create}, promote=${total.promote}, reuse=${total.reuse}`
    );
  }

  await sequelize.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
