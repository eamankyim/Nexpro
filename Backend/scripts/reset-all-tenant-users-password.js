/**
 * Reset passwords for all users with at least one workspace (tenant) membership.
 *
 * Usage (from Backend directory):
 *   node scripts/reset-all-tenant-users-password.js
 *   CONFIRM_RESET=yes node scripts/reset-all-tenant-users-password.js
 *
 * Optional env:
 *   NEW_PASSWORD=111111@1A   (default shown below)
 *   INCLUDE_PLATFORM_ADMINS=yes  — also reset users with no tenant membership
 */

require('dotenv').config();

const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { User, UserTenant, Tenant } = require('../models');

const NEW_PASSWORD = process.env.NEW_PASSWORD || '111111@1A';
const confirmReset = process.env.CONFIRM_RESET === 'yes';
const includePlatformAdmins = process.env.INCLUDE_PLATFORM_ADMINS === 'yes';

async function main() {
  await testConnection();

  const tenantUserIds = await UserTenant.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('userId')), 'userId']],
    raw: true,
  }).then((rows) => rows.map((r) => r.userId).filter(Boolean));

  const where = includePlatformAdmins
    ? {}
    : { id: { [Op.in]: tenantUserIds.length ? tenantUserIds : ['00000000-0000-0000-0000-000000000000'] } };

  const users = await User.unscoped().findAll({
    where,
    attributes: ['id', 'email', 'name', 'isPlatformAdmin'],
    include: includePlatformAdmins
      ? []
      : [
          {
            model: UserTenant,
            as: 'tenantMemberships',
            attributes: ['tenantId', 'role'],
            include: [{ model: Tenant, as: 'tenant', attributes: ['slug', 'name'] }],
          },
        ],
    order: [['email', 'ASC']],
  });

  const targets = includePlatformAdmins
    ? users
    : users.filter((u) => tenantUserIds.includes(u.id));

  console.log(`\n🔐 Reset tenant user passwords → ${NEW_PASSWORD}`);
  console.log(`   Users to update: ${targets.length}`);
  console.log(`   Include platform-only admins: ${includePlatformAdmins ? 'yes' : 'no'}\n`);

  if (targets.length === 0) {
    console.log('No users matched. Nothing to do.\n');
    await sequelize.close();
    process.exit(0);
  }

  targets.forEach((u) => {
    const tenants =
      u.tenantMemberships?.map((m) => m.tenant?.slug || m.tenantId).filter(Boolean).join(', ') ||
      '(no tenant)';
    console.log(`  - ${u.email} (${u.name})${u.isPlatformAdmin ? ' [platform admin]' : ''} → ${tenants}`);
  });

  if (!confirmReset) {
    console.log('\n⚠️  Dry run only. To apply:');
    console.log('   CONFIRM_RESET=yes node scripts/reset-all-tenant-users-password.js\n');
    await sequelize.close();
    process.exit(0);
  }

  let updated = 0;
  for (const user of targets) {
    user.password = NEW_PASSWORD;
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    await user.save();
    updated += 1;
  }

  console.log(`\n✅ Updated ${updated} user password(s).\n`);
  await sequelize.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Error:', err.message || err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
