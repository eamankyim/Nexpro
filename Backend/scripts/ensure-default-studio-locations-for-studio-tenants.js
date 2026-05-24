/**
 * Ensure every studio tenant has one reusable default studio location.
 * Safe to run multiple times.
 *
 * Usage:
 *   node scripts/ensure-default-studio-locations-for-studio-tenants.js --dry-run
 *   node scripts/ensure-default-studio-locations-for-studio-tenants.js --apply
 *   node scripts/ensure-default-studio-locations-for-studio-tenants.js --dry-run --tenant-email owner@example.com
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { QueryTypes } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { Tenant, StudioLocation } = require('../models');
const { resolveBusinessType } = require('../config/businessTypes');
const { ensureDefaultStudioLocation } = require('../utils/studioLocationUtils');

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

const requestedTenantEmail = getArgValue('--tenant-email', null)?.trim().toLowerCase() || null;
const requestedTenantId = getArgValue('--tenant-id', null)?.trim() || null;
if (requestedTenantEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedTenantEmail)) {
  throw new Error(`Invalid --tenant-email "${requestedTenantEmail}"`);
}

const getLocationState = async (tenantId, transaction = null) => {
  const opts = transaction ? { transaction } : {};
  const count = await StudioLocation.count({ where: { tenantId }, ...opts });
  const defaultCount = await StudioLocation.count({ where: { tenantId, isDefault: true }, ...opts });
  return { count, defaultCount };
};

const actionFor = ({ count, defaultCount }) => {
  if (defaultCount > 0) return 'reuse';
  if (count > 0) return 'promote';
  return 'create';
};

const getExistingDefaultOrFirstLocation = async (tenantId, transaction = null) => {
  const opts = transaction ? { transaction } : {};
  return StudioLocation.findOne({
    where: { tenantId },
    attributes: ['id', 'name', 'isDefault'],
    order: [
      ['isDefault', 'DESC'],
      ['isActive', 'DESC'],
      ['createdAt', 'ASC'],
    ],
    ...opts,
  });
};

const getTenantsForRun = async () => {
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

  const studioRows = rows.filter((tenant) => resolveBusinessType(tenant.businessType) === 'studio');
  if (!studioRows.length) {
    throw new Error(
      `No studio tenant found for owner/admin email ${requestedTenantEmail}. Matched tenants: ${rows
        .map((tenant) => `${tenant.name} (${tenant.id}, type=${resolveBusinessType(tenant.businessType)})`)
        .join('; ')}`
    );
  }

  if (studioRows.length > 1 && !requestedTenantId) {
    throw new Error(
      `Owner/admin email ${requestedTenantEmail} matches multiple studio tenants. Re-run with --tenant-id. Matches: ${studioRows
        .map((tenant) => `${tenant.name} (${tenant.id})`)
        .join('; ')}`
    );
  }

  return studioRows;
};

async function main() {
  await testConnection();
  console.log(`Mode: ${isApply ? 'APPLY' : 'DRY RUN'}\n`);
  if (requestedTenantEmail) {
    console.log(`Tenant email filter: ${requestedTenantEmail} (${TENANT_EMAIL_ROLES.join('/')} memberships only)`);
  }
  if (requestedTenantId) {
    console.log(`Tenant id filter: ${requestedTenantId}`);
  }
  if (requestedTenantEmail || requestedTenantId) {
    console.log('');
  }

  const tenants = await getTenantsForRun();

  const summary = { create: 0, promote: 0, reuse: 0, skipped: 0 };

  for (const tenant of tenants) {
    if (resolveBusinessType(tenant.businessType) !== 'studio') {
      summary.skipped += 1;
      continue;
    }

    const before = await getLocationState(tenant.id);
    const plannedAction = actionFor(before);
    summary[plannedAction] += 1;

    if (isDryRun) {
      const location = await getExistingDefaultOrFirstLocation(tenant.id);
      console.log(
        `[dry-run] ${tenant.name} (${tenant.id}) locations=${before.count} defaults=${before.defaultCount} action=${plannedAction} defaultStudioLocationId=${location?.id || 'missing'} defaultStudioLocationName=${location?.name || tenant.name || 'Main studio'}`
      );
      continue;
    }

    await sequelize.transaction(async (transaction) => {
      const location = await ensureDefaultStudioLocation(
        tenant.id,
        { name: tenant.name || 'Main studio', source: 'default-studio-location-backfill' },
        transaction
      );
      const after = await getLocationState(tenant.id, transaction);
      console.log(
        `[apply] ${tenant.name} (${tenant.id}) action=${plannedAction} defaultStudioLocationId=${location?.id || 'none'} defaultStudioLocationName=${location?.name || 'none'} locations=${after.count} defaults=${after.defaultCount}`
      );
    });
  }

  console.log('Done.');
  console.log('  would/create default studio locations:', summary.create);
  console.log('  would/promote existing locations:', summary.promote);
  console.log('  reused existing defaults:', summary.reuse);
  console.log('  skipped non-studio tenants:', summary.skipped);

  await sequelize.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
