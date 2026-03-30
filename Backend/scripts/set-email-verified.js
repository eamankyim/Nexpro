/**
 * Set a user's email as verified (email_verified_at = now).
 * Usage: node scripts/set-email-verified.js [email]
 * Example: node scripts/set-email-verified.js sabitoapp2@gmail.com
 */
require('dotenv').config();

const { sequelize, testConnection } = require('../config/database');
const { User } = require('../models');

const email = process.argv[2] || 'sabitoapp2@gmail.com';

const run = async () => {
  try {
    await testConnection();
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      console.error('User not found:', email);
      process.exit(1);
    }
    user.emailVerifiedAt = new Date();
    await user.save();
    console.log('Email set as verified for:', email);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

run();
