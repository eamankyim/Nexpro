#!/usr/bin/env node
/**
 * Mark an existing user's email as verified (sets email_verified_at) and clear
 * pending email verification tokens.
 *
 * Usage (from Backend/):
 *   node scripts/verify-user-email.js --email gilbertceyram@gmail.com --dry-run
 *   node scripts/verify-user-email.js --email gilbertceyram@gmail.com
 *
 * VPS:
 *   ssh root@62.169.22.3 'cd ~/nexpro/Backend && node scripts/verify-user-email.js --email gilbertceyram@gmail.com --dry-run'
 *   ssh root@62.169.22.3 'cd ~/nexpro/Backend && node scripts/verify-user-email.js --email gilbertceyram@gmail.com'
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { col, fn, where } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const User = require('../models/User');
const EmailVerificationToken = require('../models/EmailVerificationToken');

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

const formatVerifiedAt = (value) => (value ? new Date(value).toISOString() : 'null');

const printUsage = () => {
  console.error('Usage: node scripts/verify-user-email.js --email <address> [--dry-run]');
  console.error('Example: node scripts/verify-user-email.js --email gilbertceyram@gmail.com --dry-run');
};

const verifyUserEmail = async () => {
  const email = normalizeEmail(getArgValue('--email'));
  const isDryRun = process.argv.includes('--dry-run');

  if (!email) {
    console.error('Error: --email is required.');
    printUsage();
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

  console.log(isDryRun ? 'Dry run: looking up user email verification status' : 'Verifying user email');
  console.log(`Email: ${email}`);

  await testConnection();

  const user = await User.unscoped().findOne({
    where: where(fn('lower', col('email')), email),
  });

  if (!user) {
    console.log(`No user found with email ${email}. No changes were made.`);
    return;
  }

  const previousEmailVerifiedAt = user.emailVerifiedAt;
  const pendingTokenCount = await EmailVerificationToken.count({ where: { userId: user.id } });

  console.log('');
  console.log('User found:');
  console.log(`  ID:              ${user.id}`);
  console.log(`  Name:            ${user.name}`);
  console.log(`  Email:           ${user.email}`);
  console.log(`  emailVerifiedAt: ${formatVerifiedAt(previousEmailVerifiedAt)}`);
  console.log(`  Pending tokens:  ${pendingTokenCount}`);

  if (isDryRun) {
    console.log('');
    console.log('Dry run complete. No database changes were made.');
    return;
  }

  const verifiedAt = new Date();
  const transaction = await sequelize.transaction();

  try {
    await user.update({ emailVerifiedAt: verifiedAt }, { transaction });
    const deletedTokenCount = await EmailVerificationToken.destroy({
      where: { userId: user.id },
      transaction,
    });

    await transaction.commit();

    console.log('');
    console.log('Email verification updated successfully.');
    console.log(`  User ID:         ${user.id}`);
    console.log(`  Name:            ${user.name}`);
    console.log(`  Email:           ${user.email}`);
    console.log(`  emailVerifiedAt: ${formatVerifiedAt(previousEmailVerifiedAt)} -> ${verifiedAt.toISOString()}`);
    console.log(`  Tokens cleared:  ${deletedTokenCount}`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

verifyUserEmail()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Email verification failed:', error.message);
    await sequelize.close();
    process.exit(1);
  });
