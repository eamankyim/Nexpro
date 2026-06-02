/**
 * Update the existing superadmin/platform admin email without creating a new account.
 *
 * Usage:
 *   OLD_SUPER_ADMIN_EMAIL=superadmin@gmail.com NEW_SUPER_ADMIN_EMAIL=info@absghana.com \
 *     node scripts/update-superadmin-email.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { User } = require('../models');

const DEFAULT_OLD_EMAIL = 'superadmin@gmail.com';
const DEFAULT_NEW_EMAIL = 'info@absghana.com';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const fail = (message) => {
  throw new Error(message);
};

const updateSuperadminEmail = async () => {
  const oldEmail = normalizeEmail(process.env.OLD_SUPER_ADMIN_EMAIL || DEFAULT_OLD_EMAIL);
  const newEmail = normalizeEmail(process.env.NEW_SUPER_ADMIN_EMAIL || DEFAULT_NEW_EMAIL);

  if (!oldEmail || !newEmail) {
    fail('OLD_SUPER_ADMIN_EMAIL and NEW_SUPER_ADMIN_EMAIL must be valid email values.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(oldEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    fail('OLD_SUPER_ADMIN_EMAIL and NEW_SUPER_ADMIN_EMAIL must be valid email addresses.');
  }

  console.log('🔎 Updating existing superadmin email only');
  console.log(`   From: ${oldEmail}`);
  console.log(`   To:   ${newEmail}\n`);

  await testConnection();

  const transaction = await sequelize.transaction();
  try {
    const superadmin = await User.unscoped().findOne({
      where: {
        email: oldEmail,
        isPlatformAdmin: true,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!superadmin) {
      fail(`No existing platform admin user found with email ${oldEmail}. No account was created or modified.`);
    }

    const conflictingUser = await User.unscoped().findOne({
      where: {
        email: newEmail,
        id: { [Op.ne]: superadmin.id },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (conflictingUser) {
      fail(`Cannot update superadmin email: ${newEmail} is already used by another user (${conflictingUser.id}).`);
    }

    if (oldEmail === newEmail) {
      await transaction.commit();
      console.log('✅ Superadmin email already matches target. No changes made.');
      return;
    }

    superadmin.email = newEmail;
    await superadmin.save({ transaction });

    await transaction.commit();
    console.log('✅ Superadmin email updated successfully.');
    console.log(`   User ID: ${superadmin.id}`);
    console.log('   Password, role, active status, and tenant memberships were left unchanged.');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

updateSuperadminEmail()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Superadmin email update failed:', error.message);
    await sequelize.close();
    process.exit(1);
  });
