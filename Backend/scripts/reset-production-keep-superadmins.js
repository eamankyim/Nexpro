#!/usr/bin/env node
/**
 * Reset all business/tenant data while preserving only platform admin accounts.
 *
 * Usage from Backend/:
 *   # Preview counts only; does not delete data.
 *   NODE_ENV=production node scripts/reset-production-keep-superadmins.js \
 *     --dry-run \
 *     --confirm-delete-all-business-data \
 *     --keep-superadmins
 *
 *   # Execute intentionally. Take and verify a production backup first.
 *   NODE_ENV=production node scripts/reset-production-keep-superadmins.js \
 *     --execute \
 *     --confirm-delete-all-business-data \
 *     --keep-superadmins
 *
 *   # Non-production testing only.
 *   NODE_ENV=development node scripts/reset-production-keep-superadmins.js \
 *     --dry-run \
 *     --confirm-delete-all-business-data \
 *     --keep-superadmins \
 *     --allow-non-production
 *
 * Safety rails:
 * - Refuses to run unless NODE_ENV=production, except with --allow-non-production.
 * - Refuses to run unless --confirm-delete-all-business-data and --keep-superadmins are present.
 * - Requires exactly one mode: --dry-run or --execute.
 * - Refuses real deletion if no platform admins are detected.
 * - Uses existing Sequelize configuration; no credentials are hardcoded here.
 * - Real deletion runs in one transaction and makes tenant deletion strict so failures roll back.
 */
require('dotenv').config();

const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const models = require('../models');
const { deleteTenantData } = require('../utils/deleteTenantData');

const {
  User,
  Tenant,
  InviteToken,
  PasswordResetToken,
  EmailVerificationToken,
  PlatformAdminUserRole,
  UserTodo,
  UserWeekFocus,
  UserTask,
  UserChecklist,
  UserChecklistItem,
  UserTenant,
  UserShop,
  UserStudioLocation,
  TenantAccessAudit,
} = models;

const USAGE = `
Usage from Backend/:
  NODE_ENV=production node scripts/reset-production-keep-superadmins.js \\
    --dry-run \\
    --confirm-delete-all-business-data \\
    --keep-superadmins

  NODE_ENV=production node scripts/reset-production-keep-superadmins.js \\
    --execute \\
    --confirm-delete-all-business-data \\
    --keep-superadmins

Required flags:
  --dry-run                         Print counts only and exit.
  --execute                         Perform the destructive reset.
  --confirm-delete-all-business-data Confirm tenant/business data deletion intent.
  --keep-superadmins                Confirm platform admins must be preserved.

Optional:
  --allow-non-production             Permit NODE_ENV values other than production.
  --help                             Show this help.
`;

const argv = new Set(process.argv.slice(2));
const has = (flag) => argv.has(flag);
const isDryRun = has('--dry-run');
const isExecute = has('--execute');
const allowNonProduction = has('--allow-non-production');

function fail(message) {
  console.error(`\nRefusing to continue: ${message}`);
  console.error(USAGE);
  process.exit(1);
}

function validateFlags() {
  if (has('--help')) {
    console.log(USAGE);
    process.exit(0);
  }

  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is not set.');
  }

  if (process.env.NODE_ENV !== 'production' && !allowNonProduction) {
    fail('NODE_ENV must be production, or pass --allow-non-production for testing.');
  }

  if (!has('--confirm-delete-all-business-data')) {
    fail('missing --confirm-delete-all-business-data.');
  }

  if (!has('--keep-superadmins')) {
    fail('missing --keep-superadmins.');
  }

  if (isDryRun === isExecute) {
    fail('provide exactly one of --dry-run or --execute.');
  }
}

function databaseLabel() {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch (_error) {
    return '<unparseable DATABASE_URL>';
  }
}

function printTable(title, rows) {
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log('  (none)');
    return;
  }

  const nameWidth = Math.max('Target'.length, ...rows.map((row) => row.target.length));
  const countWidth = Math.max('Count'.length, ...rows.map((row) => String(row.count).length));
  console.log(`  ${'Target'.padEnd(nameWidth)}  ${'Count'.padStart(countWidth)}  Notes`);
  console.log(`  ${'-'.repeat(nameWidth)}  ${'-'.repeat(countWidth)}  -----`);
  for (const row of rows) {
    console.log(`  ${row.target.padEnd(nameWidth)}  ${String(row.count).padStart(countWidth)}  ${row.notes || ''}`);
  }
}

async function findIds(Model, where) {
  if (!Model?.findAll) return [];
  const rows = await Model.findAll({ where, attributes: ['id'], raw: true });
  return rows.map((row) => row.id);
}

async function countWhere(Model, where) {
  if (!Model?.count) return 0;
  return Model.count({ where });
}

function inIds(ids) {
  return { [Op.in]: ids };
}

async function getPlatformAdminUsers() {
  const roleRows = await PlatformAdminUserRole.findAll({
    attributes: ['userId'],
    raw: true,
  });
  const roleUserIds = [...new Set(roleRows.map((row) => row.userId).filter(Boolean))];

  const orConditions = [{ isPlatformAdmin: true }];
  if (roleUserIds.length) {
    orConditions.push({ id: inIds(roleUserIds) });
  }

  const userModel = User.unscoped ? User.unscoped() : User;
  return userModel.findAll({
    where: { [Op.or]: orConditions },
    attributes: ['id', 'email', 'name', 'isPlatformAdmin'],
    order: [['createdAt', 'ASC']],
    raw: true,
  });
}

async function getNonPlatformAdminUsers(keepUserIds) {
  const userModel = User.unscoped ? User.unscoped() : User;
  const where = keepUserIds.length ? { id: { [Op.notIn]: keepUserIds } } : {};
  return userModel.findAll({
    where,
    attributes: ['id', 'email', 'name', 'isPlatformAdmin'],
    order: [['createdAt', 'ASC']],
    raw: true,
  });
}

async function collectTenantRelatedIds(tenantIds) {
  if (!tenantIds.length) {
    return {
      productIds: [],
      saleIds: [],
      prescriptionIds: [],
      checklistIds: [],
    };
  }

  const where = { tenantId: inIds(tenantIds) };
  const [productIds, saleIds, prescriptionIds, checklistIds] = await Promise.all([
    findIds(models.Product, where),
    findIds(models.Sale, where),
    findIds(models.Prescription, where),
    findIds(models.UserChecklist, where),
  ]);

  return { productIds, saleIds, prescriptionIds, checklistIds };
}

async function buildDeletionPlan(tenants, platformAdmins, nonPlatformAdmins) {
  const tenantIds = tenants.map((tenant) => tenant.id);
  const nonPlatformAdminIds = nonPlatformAdmins.map((user) => user.id);
  const rows = [
    {
      target: 'tenants',
      count: tenants.length,
      notes: 'all business/workspace records',
    },
    {
      target: 'users',
      count: nonPlatformAdmins.length,
      notes: 'non-platform-admin users only',
    },
  ];

  if (tenantIds.length) {
    for (const [name, Model] of Object.entries(models)) {
      if (!Model?.rawAttributes?.tenantId || name === 'Tenant') continue;
      rows.push({
        target: Model.getTableName ? String(Model.getTableName()) : name,
        count: await countWhere(Model, { tenantId: inIds(tenantIds) }),
        notes: 'tenant-scoped',
      });
    }

    const relatedIds = await collectTenantRelatedIds(tenantIds);
    const dependentCounts = [
      ['product_variants', models.ProductVariant, 'productId', relatedIds.productIds],
      ['sale_items', models.SaleItem, 'saleId', relatedIds.saleIds],
      ['prescription_items', models.PrescriptionItem, 'prescriptionId', relatedIds.prescriptionIds],
      ['user_checklist_items', models.UserChecklistItem, 'checklistId', relatedIds.checklistIds],
    ];

    for (const [target, Model, foreignKey, ids] of dependentCounts) {
      rows.push({
        target,
        count: ids.length ? await countWhere(Model, { [foreignKey]: inIds(ids) }) : 0,
        notes: `dependent ${foreignKey}`,
      });
    }
  }

  rows.push({
    target: 'invite_tokens',
    count: await countWhere(InviteToken, {}),
    notes: 'all pending/used invites, including platform invites',
  });

  if (nonPlatformAdminIds.length) {
    const userScopedCounts = [
      ['password_reset_tokens', PasswordResetToken, { userId: inIds(nonPlatformAdminIds) }],
      ['email_verification_tokens', EmailVerificationToken, { userId: inIds(nonPlatformAdminIds) }],
      ['platform_admin_user_roles', PlatformAdminUserRole, { userId: inIds(nonPlatformAdminIds) }],
      ['user_todos', UserTodo, { userId: inIds(nonPlatformAdminIds) }],
      ['user_week_focus', UserWeekFocus, { userId: inIds(nonPlatformAdminIds) }],
      ['user_tasks', UserTask, { [Op.or]: [{ userId: inIds(nonPlatformAdminIds) }, { assigneeId: inIds(nonPlatformAdminIds) }] }],
      ['user_checklists', UserChecklist, { userId: inIds(nonPlatformAdminIds) }],
      ['user_checklist_items', UserChecklistItem, { userId: inIds(nonPlatformAdminIds) }],
      ['user_tenants', UserTenant, { userId: inIds(nonPlatformAdminIds) }],
      ['user_shops', UserShop, { userId: inIds(nonPlatformAdminIds) }],
      ['user_studio_locations', UserStudioLocation, { userId: inIds(nonPlatformAdminIds) }],
      ['tenant_access_audits', TenantAccessAudit, { actorUserId: inIds(nonPlatformAdminIds) }],
    ];

    for (const [target, Model, where] of userScopedCounts) {
      rows.push({
        target,
        count: await countWhere(Model, where),
        notes: 'non-platform-admin user-scoped cleanup',
      });
    }
  }

  return {
    rows,
    preservedRows: platformAdmins.map((admin) => ({
      target: admin.email || admin.id,
      count: 1,
      notes: admin.isPlatformAdmin ? 'isPlatformAdmin=true' : 'platform admin role assignment',
    })),
  };
}

async function destroyWhere(Model, where, transaction) {
  if (!Model?.destroy) return 0;
  return Model.destroy({ where, transaction });
}

async function deleteNonPlatformAdminUsers(userIds, transaction) {
  await destroyWhere(InviteToken, {}, transaction);

  if (!userIds.length) {
    return;
  }

  const userIdWhere = { userId: inIds(userIds) };
  await destroyWhere(PasswordResetToken, userIdWhere, transaction);
  await destroyWhere(EmailVerificationToken, userIdWhere, transaction);
  await destroyWhere(PlatformAdminUserRole, userIdWhere, transaction);
  await destroyWhere(UserTodo, userIdWhere, transaction);
  await destroyWhere(UserWeekFocus, userIdWhere, transaction);
  await destroyWhere(UserTask, { [Op.or]: [userIdWhere, { assigneeId: inIds(userIds) }] }, transaction);
  await destroyWhere(UserChecklistItem, userIdWhere, transaction);
  await destroyWhere(UserChecklist, userIdWhere, transaction);
  await destroyWhere(UserShop, userIdWhere, transaction);
  await destroyWhere(UserStudioLocation, userIdWhere, transaction);
  await destroyWhere(UserTenant, userIdWhere, transaction);
  await destroyWhere(TenantAccessAudit, { actorUserId: inIds(userIds) }, transaction);
  await destroyWhere(User, { id: inIds(userIds) }, transaction);
}

async function verifyFinalState(keepUserIds) {
  const remainingTenants = await Tenant.count();
  const remainingUsers = await User.count();
  const remainingNonPlatformAdmins = keepUserIds.length
    ? await User.count({ where: { id: { [Op.notIn]: keepUserIds } } })
    : await User.count();

  printTable('Post-run verification', [
    { target: 'tenants', count: remainingTenants, notes: 'expected 0 after execute' },
    { target: 'users', count: remainingUsers, notes: 'expected preserved platform admins only' },
    { target: 'non-platform-admin users', count: remainingNonPlatformAdmins, notes: 'expected 0 after execute' },
  ]);
}

async function run() {
  validateFlags();

  console.log(USAGE);
  console.log(`Mode: ${isDryRun ? 'DRY RUN - no data will be deleted' : 'EXECUTE - destructive reset'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || '<unset>'}`);
  console.log(`Database: ${databaseLabel()}`);

  await testConnection();

  const tenants = await Tenant.findAll({
    attributes: ['id', 'name', 'slug', 'createdAt'],
    order: [['createdAt', 'ASC']],
    raw: true,
  });
  const platformAdmins = await getPlatformAdminUsers();
  const keepUserIds = platformAdmins.map((admin) => admin.id);
  const nonPlatformAdmins = await getNonPlatformAdminUsers(keepUserIds);
  const plan = await buildDeletionPlan(tenants, platformAdmins, nonPlatformAdmins);

  printTable('Preserved platform admin accounts', plan.preservedRows);
  printTable('Rows selected for deletion', plan.rows);

  if (!platformAdmins.length) {
    throw new Error('No platform admin users were detected; create or repair a superadmin before executing.');
  }

  if (isDryRun) {
    console.log('\nDry run complete. No data was deleted.');
    return;
  }

  process.env.DELETE_TENANT_DATA_STRICT = 'true';

  await sequelize.transaction(async (transaction) => {
    for (const tenant of tenants) {
      console.log(`Deleting tenant data: ${tenant.slug || tenant.name || tenant.id} (${tenant.id})`);
      await deleteTenantData(tenant.id, transaction);
    }

    await deleteNonPlatformAdminUsers(nonPlatformAdmins.map((user) => user.id), transaction);
  });

  console.log('\nReset complete. Tenant/business data and non-platform-admin users were deleted.');
  await verifyFinalState(keepUserIds);
}

run()
  .catch((error) => {
    console.error('\nReset failed. No committed changes should remain if the transaction rolled back.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
