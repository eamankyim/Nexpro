#!/usr/bin/env node
/**
 * Update a user's tenant membership role (and matching users.role when applicable).
 *
 * Usage (from Backend/):
 *   node scripts/set-user-tenant-role.js --email campbellkevin459@gmail.com --role manager --dry-run
 *   node scripts/set-user-tenant-role.js --email campbellkevin459@gmail.com --role manager
 *   node scripts/set-user-tenant-role.js --email user@example.com --role admin --tenant-name "Acme Shop"
 *   node scripts/set-user-tenant-role.js --email user@example.com --role staff --tenant-id <uuid>
 *
 * VPS:
 *   ssh root@62.169.22.3 'cd ~/nexpro/Backend && node scripts/set-user-tenant-role.js --email campbellkevin459@gmail.com --role manager --dry-run'
 *   ssh root@62.169.22.3 'cd ~/nexpro/Backend && node scripts/set-user-tenant-role.js --email campbellkevin459@gmail.com --role manager'
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Op, col, fn, where } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { User, UserTenant, Tenant } = require('../models');

const ALLOWED_ROLES = ['admin', 'manager', 'staff', 'driver'];

const getArgValue = (name) => {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }
  return null;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeText = (value) => String(value || '').trim().toLowerCase();

const formatTenant = (tenant) => {
  if (!tenant) return 'Unknown tenant';
  return `${tenant.name} (${tenant.id})`;
};

const printUsage = () => {
  console.error('Usage: node scripts/set-user-tenant-role.js --email <address> --role <role> [--tenant-name <name> | --tenant-id <uuid>] [--dry-run]');
  console.error(`Roles: ${ALLOWED_ROLES.join(', ')}`);
  console.error('Example: node scripts/set-user-tenant-role.js --email campbellkevin459@gmail.com --role manager --dry-run');
};

const resolveMembership = async ({ email, tenantId, tenantName }) => {
  const user = await User.unscoped().findOne({
    where: where(fn('lower', col('email')), email),
    attributes: ['id', 'name', 'email', 'role'],
  });

  if (!user) {
    return { user: null, membership: null, tenant: null };
  }

  const memberships = await UserTenant.findAll({
    where: {
      userId: user.id,
      status: { [Op.in]: ['active', 'invited'] },
      ...(tenantId ? { tenantId } : {}),
    },
    include: [{
      model: Tenant,
      as: 'tenant',
      attributes: ['id', 'name', 'slug', 'status'],
    }],
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });

  let matches = memberships.filter((membership) => membership.tenant);

  if (tenantName) {
    const searchName = normalizeText(tenantName);
    matches = matches.filter(
      (membership) => normalizeText(membership.tenant.name) === searchName
        || normalizeText(membership.tenant.name).includes(searchName),
    );
  }

  if (!matches.length) {
    const suffix = tenantId
      ? ` for tenant id ${tenantId}`
      : tenantName
        ? ` for tenant name "${tenantName}"`
        : '';
    throw new Error(`No active tenant membership found for ${email}${suffix}.`);
  }

  if (matches.length > 1 && !tenantId && !tenantName) {
    console.error('\nUser belongs to multiple tenants. Re-run with --tenant-id or --tenant-name:');
    matches.forEach((membership) => {
      console.error(`- ${formatTenant(membership.tenant)} role=${membership.role} status=${membership.status}`);
    });
    process.exit(1);
  }

  if (matches.length > 1) {
    console.error('\nMultiple memberships matched the tenant filter. Re-run with --tenant-id:');
    matches.forEach((membership) => {
      console.error(`- ${formatTenant(membership.tenant)} role=${membership.role} status=${membership.status}`);
    });
    process.exit(1);
  }

  const membership = matches[0];
  return {
    user,
    membership,
    tenant: membership.tenant,
  };
};

const setUserTenantRole = async () => {
  const email = normalizeEmail(getArgValue('--email'));
  const role = String(getArgValue('--role') || '').trim().toLowerCase();
  const tenantId = String(getArgValue('--tenant-id') || '').trim() || null;
  const tenantName = String(getArgValue('--tenant-name') || '').trim() || null;
  const isDryRun = process.argv.includes('--dry-run');

  if (!email) {
    console.error('Error: --email is required.');
    printUsage();
    process.exit(1);
  }

  if (!role) {
    console.error('Error: --role is required.');
    printUsage();
    process.exit(1);
  }

  if (!ALLOWED_ROLES.includes(role)) {
    console.error(`Error: invalid role "${role}". Expected one of: ${ALLOWED_ROLES.join(', ')}`);
    process.exit(1);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`Error: invalid email address "${email}".`);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL is not set. Add it to Backend/.env or export it before running.');
    process.exit(1);
  }

  console.log(isDryRun ? 'Dry run: looking up tenant membership role' : 'Updating tenant membership role');
  console.log(`Email: ${email}`);
  console.log(`Role:  ${role}`);
  if (tenantId) console.log(`Tenant ID: ${tenantId}`);
  if (tenantName) console.log(`Tenant name: ${tenantName}`);

  await testConnection();

  const { user, membership, tenant } = await resolveMembership({ email, tenantId, tenantName });

  if (!user) {
    console.log(`No user found with email ${email}. No changes were made.`);
    return;
  }

  const previousMembershipRole = membership.role;
  const previousUserRole = user.role;
  const shouldUpdateUserRole = previousUserRole !== role;

  console.log('');
  console.log('User found:');
  console.log(`  ID:                 ${user.id}`);
  console.log(`  Name:               ${user.name}`);
  console.log(`  Email:              ${user.email}`);
  console.log(`  users.role:         ${previousUserRole}`);
  console.log('');
  console.log('Membership:');
  console.log(`  Tenant:             ${formatTenant(tenant)}`);
  console.log(`  Membership ID:      ${membership.id}`);
  console.log(`  user_tenants.role:  ${previousMembershipRole}`);
  console.log(`  Status:             ${membership.status}`);
  console.log(`  Default workspace:  ${membership.isDefault ? 'yes' : 'no'}`);

  if (previousMembershipRole === role && previousUserRole === role) {
    console.log('');
    console.log('No changes needed. Role is already set to the requested value.');
    return;
  }

  console.log('');
  console.log('Planned changes:');
  console.log(`  user_tenants.role: ${previousMembershipRole} -> ${role}`);
  if (shouldUpdateUserRole) {
    console.log(`  users.role:        ${previousUserRole} -> ${role}`);
  } else {
    console.log(`  users.role:        ${previousUserRole} (unchanged)`);
  }

  if (isDryRun) {
    console.log('');
    console.log('Dry run complete. No database changes were made.');
    return;
  }

  const transaction = await sequelize.transaction();

  try {
    await membership.update({ role }, { transaction });

    if (shouldUpdateUserRole) {
      await user.update({ role }, { transaction });
    }

    await transaction.commit();

    console.log('');
    console.log('Role updated successfully.');
    console.log(`  User:               ${user.email}`);
    console.log(`  Tenant:             ${formatTenant(tenant)}`);
    console.log(`  user_tenants.role:  ${previousMembershipRole} -> ${role}`);
    if (shouldUpdateUserRole) {
      console.log(`  users.role:         ${previousUserRole} -> ${role}`);
    }
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

setUserTenantRole()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Role update failed:', error.message);
    await sequelize.close();
    process.exit(1);
  });
