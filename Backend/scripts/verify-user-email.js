/**
 * Mark an existing user's email as verified and remove pending verification tokens.
 *
 * Usage:
 *   node scripts/verify-user-email.js eamankyim5@gmail.com
 *   USER_EMAIL=eamankyim5@gmail.com node scripts/verify-user-email.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { col, fn, where } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const User = require('../models/User');
const EmailVerificationToken = require('../models/EmailVerificationToken');

const DEFAULT_EMAIL = 'eamankyim5@gmail.com';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const fail = (message) => {
  throw new Error(message);
};

const verifyUserEmail = async () => {
  const email = normalizeEmail(process.argv[2] || process.env.USER_EMAIL || DEFAULT_EMAIL);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('Provide a valid email address as an argument or USER_EMAIL environment variable.');
  }

  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is not set. Add it to Backend/.env or export it before running this script.');
  }

  console.log('Verifying existing user email');
  console.log(`Email: ${email}`);

  await testConnection();

  const transaction = await sequelize.transaction();
  try {
    const user = await User.unscoped().findOne({
      where: where(fn('lower', col('email')), email),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user) {
      fail(`No user found with email ${email}. No account was created or modified.`);
    }

    const previousEmailVerifiedAt = user.emailVerifiedAt;
    const verifiedAt = new Date();

    await user.update({ emailVerifiedAt: verifiedAt }, { transaction });
    const deletedTokenCount = await EmailVerificationToken.destroy({
      where: { userId: user.id },
      transaction,
    });

    await transaction.commit();

    console.log('Email verification updated successfully.');
    console.log(`User ID: ${user.id}`);
    console.log(`emailVerifiedAt: ${previousEmailVerifiedAt ? previousEmailVerifiedAt.toISOString() : 'null'} -> ${verifiedAt.toISOString()}`);
    console.log(`Pending email verification tokens cleared: ${deletedTokenCount}`);
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
