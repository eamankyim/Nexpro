/**
 * Assign existing shop-tenant members without explicit shop access to the tenant's main shop.
 *
 * Dry-run is the default. Writes require both --execute and --confirm-main-shop-assignment.
 *
 * Usage:
 *   node scripts/assign-users-to-main-shop.js --all
 *   node scripts/assign-users-to-main-shop.js --email user@example.com
 *   node scripts/assign-users-to-main-shop.js --tenant-id <tenant-id>
 *   node scripts/assign-users-to-main-shop.js --all --execute --confirm-main-shop-assignment
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { QueryTypes } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { Tenant, Shop } = require('../models');
const { resolveBusinessType } = require('../config/businessTypes');
const {
  WORKSPACE_WIDE_ROLES,
  ensureDefaultShop,
} = require('../utils/shopUtils');

const isExecute = process.argv.includes('--execute');
const isConfirmed = process.argv.includes('--confirm-main-shop-assignment');
const isDryRun = !isExecute;
const allowNonLocalDb = process.argv.includes('--allow-non-local-db');
const includeWorkspaceWide = process.argv.includes('--include-workspace-wide');
const isAll = process.argv.includes('--all');
const SAMPLE_LIMIT = 10;

const getArgValue = (name, fallback = null) => {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }
  return fallback;
};

const requestedEmail = getArgValue('--email')?.trim().toLowerCase() || null;
const requestedTenantId = getArgValue('--tenant-id')?.trim() || null;

const formatDbTarget = () => {
  try {
    const url = new URL(process.env.DATABASE_URL || '');
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}`;
  } catch {
    return process.env.DATABASE_URL ? '[unparseable DATABASE_URL]' : '[DATABASE_URL not set]';
  }
};

const isLocalDatabaseUrl = () => {
  try {
    const hostname = new URL(process.env.DATABASE_URL || '').hostname;
    return ['localhost', '127.0.0.1', '::1'].includes(hostname);
  } catch {
    return false;
  }
};

const validateFlags = () => {
  if (isExecute && !isConfirmed) {
    throw new Error('Writes require --execute --confirm-main-shop-assignment.');
  }
  if (isExecute && !isLocalDatabaseUrl() && !allowNonLocalDb) {
    throw new Error('Refusing to write to a non-local DATABASE_URL. Set a localhost DATABASE_URL or pass --allow-non-local-db if you intentionally want this.');
  }
  if (!isAll && !requestedEmail && !requestedTenantId) {
    throw new Error('Provide --all, --email, or --tenant-id.');
  }
  if (isAll && (requestedEmail || requestedTenantId)) {
    throw new Error('Use either --all or a selected --email/--tenant-id filter, not both.');
  }
  if (requestedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) {
    throw new Error(`Invalid --email "${requestedEmail}"`);
  }
};

const getShopState = async (tenantId, transaction = null) => {
  const opts = transaction ? { transaction } : {};
  const count = await Shop.count({ where: { tenantId }, ...opts });
  const defaultCount = await Shop.count({ where: { tenantId, isDefault: true }, ...opts });
  return { count, defaultCount };
};

const actionForShopState = ({ count, defaultCount }) => {
  if (defaultCount > 0) return 'reuse';
  if (count > 0) return 'promote';
  return 'create';
};

const previewDefaultShop = async (tenant, transaction = null) => {
  const opts = transaction ? { transaction } : {};
  const shops = await Shop.findAll({
    where: { tenantId: tenant.id },
    attributes: ['id', 'name', 'isActive', 'isDefault', 'createdAt'],
    order: [
      ['isDefault', 'DESC'],
      ['isActive', 'DESC'],
      ['createdAt', 'ASC'],
    ],
    raw: true,
    ...opts,
  });

  const state = {
    count: shops.length,
    defaultCount: shops.filter((shop) => shop.isDefault).length,
  };
  return {
    action: actionForShopState(state),
    state,
    shop: shops[0] || null,
  };
};

const resolveMainShop = async (tenant, transaction = null) => {
  if (isDryRun) {
    return previewDefaultShop(tenant, transaction);
  }

  const before = await getShopState(tenant.id, transaction);
  const shop = await ensureDefaultShop(
    tenant.id,
    { name: tenant.name, source: 'main-shop-assignment-backfill' },
    transaction
  );
  const after = await getShopState(tenant.id, transaction);
  return {
    action: actionForShopState(before),
    state: after,
    shop: shop
      ? {
          id: shop.id,
          name: shop.name,
          isActive: shop.isActive,
          isDefault: shop.isDefault,
          createdAt: shop.createdAt,
        }
      : null,
  };
};

const findTenants = async () => {
  if (isAll) {
    return Tenant.findAll({
      attributes: ['id', 'name', 'businessType', 'status', 'createdAt'],
      order: [['createdAt', 'ASC']],
    });
  }

  if (requestedTenantId && !requestedEmail) {
    const tenant = await Tenant.findByPk(requestedTenantId, {
      attributes: ['id', 'name', 'businessType', 'status', 'createdAt'],
    });
    return tenant ? [tenant] : [];
  }

  const rows = await sequelize.query(
    `SELECT DISTINCT t.id
     FROM tenants t
     INNER JOIN user_tenants ut ON ut."tenantId" = t.id
     INNER JOIN users u ON u.id = ut."userId"
     WHERE LOWER(u.email) = :email
       AND (:tenantId IS NULL OR t.id = :tenantId)
     ORDER BY t.id ASC`,
    {
      replacements: { email: requestedEmail, tenantId: requestedTenantId },
      type: QueryTypes.SELECT,
    }
  );

  if (!rows.length) return [];
  return Tenant.findAll({
    where: { id: rows.map((row) => row.id) },
    attributes: ['id', 'name', 'businessType', 'status', 'createdAt'],
    order: [['createdAt', 'ASC']],
  });
};

const roleFilterSql = () => {
  if (includeWorkspaceWide) return '';
  return 'AND ut.role NOT IN (:workspaceWideRoles)';
};

const countEligibleMembers = async (tenantId, transaction = null) => {
  const rows = await sequelize.query(
    `SELECT COUNT(*)::int AS count
     FROM user_tenants ut
     INNER JOIN users u ON u.id = ut."userId"
     WHERE ut."tenantId" = :tenantId
       AND ut.status = 'active'
       AND COALESCE(u."isActive", true) = true
       ${roleFilterSql()}`,
    {
      replacements: { tenantId, workspaceWideRoles: WORKSPACE_WIDE_ROLES },
      transaction,
      type: QueryTypes.SELECT,
    }
  );
  return Number(rows[0]?.count || 0);
};

const countExistingAssignments = async (tenantId, transaction = null) => {
  const rows = await sequelize.query(
    `SELECT COUNT(DISTINCT us."userId")::int AS count
     FROM user_shops us
     INNER JOIN user_tenants ut
       ON ut."userId" = us."userId" AND ut."tenantId" = us."tenantId"
     INNER JOIN users u ON u.id = ut."userId"
     WHERE us."tenantId" = :tenantId
       AND ut.status = 'active'
       AND COALESCE(u."isActive", true) = true
       ${roleFilterSql()}`,
    {
      replacements: { tenantId, workspaceWideRoles: WORKSPACE_WIDE_ROLES },
      transaction,
      type: QueryTypes.SELECT,
    }
  );
  return Number(rows[0]?.count || 0);
};

const getMissingSamples = async (tenantId, transaction = null) => sequelize.query(
  `SELECT u.id, u.name, u.email, ut.role, ut.status
   FROM user_tenants ut
   INNER JOIN users u ON u.id = ut."userId"
   WHERE ut."tenantId" = :tenantId
     AND ut.status = 'active'
     AND COALESCE(u."isActive", true) = true
     ${roleFilterSql()}
     AND NOT EXISTS (
       SELECT 1 FROM user_shops us
       WHERE us."tenantId" = ut."tenantId" AND us."userId" = ut."userId"
     )
   ORDER BY ut."createdAt" ASC, u.email ASC
   LIMIT :sampleLimit`,
  {
    replacements: {
      tenantId,
      workspaceWideRoles: WORKSPACE_WIDE_ROLES,
      sampleLimit: SAMPLE_LIMIT,
    },
    transaction,
    type: QueryTypes.SELECT,
  }
);

const countMissingMembers = async (tenantId, transaction = null) => {
  const rows = await sequelize.query(
    `SELECT COUNT(*)::int AS count
     FROM user_tenants ut
     INNER JOIN users u ON u.id = ut."userId"
     WHERE ut."tenantId" = :tenantId
       AND ut.status = 'active'
       AND COALESCE(u."isActive", true) = true
       ${roleFilterSql()}
       AND NOT EXISTS (
         SELECT 1 FROM user_shops us
         WHERE us."tenantId" = ut."tenantId" AND us."userId" = ut."userId"
       )`,
    {
      replacements: { tenantId, workspaceWideRoles: WORKSPACE_WIDE_ROLES },
      transaction,
      type: QueryTypes.SELECT,
    }
  );
  return Number(rows[0]?.count || 0);
};

const assignMissingMembers = async (tenantId, shopId, transaction) => {
  const [, metadata] = await sequelize.query(
    `INSERT INTO user_shops ("userId", "tenantId", "shopId", "createdAt", "updatedAt")
     SELECT ut."userId", ut."tenantId", :shopId, NOW(), NOW()
     FROM user_tenants ut
     INNER JOIN users u ON u.id = ut."userId"
     WHERE ut."tenantId" = :tenantId
       AND ut.status = 'active'
       AND COALESCE(u."isActive", true) = true
       ${roleFilterSql()}
       AND NOT EXISTS (
         SELECT 1 FROM user_shops us
         WHERE us."tenantId" = ut."tenantId" AND us."userId" = ut."userId"
       )
     ON CONFLICT ("userId", "shopId") DO NOTHING`,
    {
      replacements: { tenantId, shopId, workspaceWideRoles: WORKSPACE_WIDE_ROLES },
      transaction,
    }
  );
  return Number(metadata?.rowCount || 0);
};

const printSamples = (samples) => {
  if (!samples.length) {
    console.log('    missing assignment examples: none');
    return;
  }

  console.log('    missing assignment examples:');
  for (const sample of samples) {
    console.log(`      - ${sample.email} (${sample.id}) role=${sample.role} name=${sample.name || 'n/a'}`);
  }
};

const processTenant = async (tenant, summary, transaction = null) => {
  const businessType = resolveBusinessType(tenant.businessType);
  if (businessType !== 'shop') {
    summary.skippedNonShop += 1;
    console.log(`[skip] ${tenant.name} (${tenant.id}) businessType=${tenant.businessType || 'unset'} is not a shop tenant`);
    return;
  }

  const shopResult = await resolveMainShop(tenant, transaction);
  const { shop, state, action } = shopResult;
  if (!shop) {
    summary.skippedNoShop += 1;
    console.log(`[skip] ${tenant.name} (${tenant.id}) no main shop could be resolved`);
    return;
  }

  const eligible = await countEligibleMembers(tenant.id, transaction);
  const withAnyAssignment = await countExistingAssignments(tenant.id, transaction);
  const missing = await countMissingMembers(tenant.id, transaction);
  const samples = await getMissingSamples(tenant.id, transaction);
  const updated = isExecute && missing > 0
    ? await assignMissingMembers(tenant.id, shop.id, transaction)
    : 0;

  summary.shopActions[action] += 1;
  summary.tenantsProcessed += 1;
  summary.eligibleMembers += eligible;
  summary.membersWithAssignments += withAnyAssignment;
  summary.missingAssignments += missing;
  summary.updatedAssignments += updated;

  console.log(
    `[${isDryRun ? 'dry-run' : 'execute'}] ${tenant.name} (${tenant.id}) ` +
    `shop=${shop.name} (${shop.id}) action=${action} shops=${state.count} defaults=${state.defaultCount} ` +
    `eligible=${eligible} alreadyAssigned=${withAnyAssignment} ` +
    `${isDryRun ? 'wouldAssign' : 'assigned'}=${isDryRun ? missing : updated}`
  );
  printSamples(samples);
};

async function main() {
  validateFlags();
  await testConnection();

  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`Database: ${formatDbTarget()}`);
  if (!isLocalDatabaseUrl()) {
    console.log('Warning: DATABASE_URL is not localhost. Execute mode is blocked unless --allow-non-local-db is supplied.');
  }
  if (isAll) console.log('Tenant filter: all tenants');
  if (requestedTenantId) console.log(`Tenant filter: ${requestedTenantId}`);
  if (requestedEmail) console.log(`Email filter: ${requestedEmail}`);
  if (includeWorkspaceWide) {
    console.log(`Including workspace-wide roles: ${WORKSPACE_WIDE_ROLES.join(', ')}`);
  } else {
    console.log(`Skipping workspace-wide roles: ${WORKSPACE_WIDE_ROLES.join(', ')}`);
  }
  console.log('');

  const tenants = await findTenants();
  if (!tenants.length) {
    throw new Error('No tenants matched the requested filter.');
  }

  const summary = {
    tenantsMatched: tenants.length,
    tenantsProcessed: 0,
    skippedNonShop: 0,
    skippedNoShop: 0,
    eligibleMembers: 0,
    membersWithAssignments: 0,
    missingAssignments: 0,
    updatedAssignments: 0,
    shopActions: { create: 0, promote: 0, reuse: 0 },
  };

  if (isExecute) {
    await sequelize.transaction(async (transaction) => {
      for (const tenant of tenants) {
        await processTenant(tenant, summary, transaction);
      }
    });
  } else {
    for (const tenant of tenants) {
      await processTenant(tenant, summary);
    }
  }

  console.log('');
  console.log('Done.');
  console.log(`  tenants matched: ${summary.tenantsMatched}`);
  console.log(`  shop tenants processed: ${summary.tenantsProcessed}`);
  console.log(`  skipped non-shop tenants: ${summary.skippedNonShop}`);
  console.log(`  skipped without resolvable shop: ${summary.skippedNoShop}`);
  console.log(`  default shop actions: create=${summary.shopActions.create}, promote=${summary.shopActions.promote}, reuse=${summary.shopActions.reuse}`);
  console.log(`  eligible active members: ${summary.eligibleMembers}`);
  console.log(`  members with existing assignments: ${summary.membersWithAssignments}`);
  console.log(`  ${isDryRun ? 'would assign' : 'assigned'} missing assignments: ${isDryRun ? summary.missingAssignments : summary.updatedAssignments}`);
  if (isDryRun) {
    console.log('Re-run with --execute --confirm-main-shop-assignment to apply the changes.');
  }

  await sequelize.close();
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
