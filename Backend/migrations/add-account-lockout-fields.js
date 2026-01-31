/**
 * Migration: Add account lockout fields to users table
 * 
 * Adds failedLoginAttempts and lockoutUntil columns for brute force protection.
 */

const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

async function up() {
  console.log('[Migration] Adding account lockout fields to users table...');
  
  try {
    // Check if columns already exist
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('failed_login_attempts', 'lockout_until')
    `, { type: QueryTypes.SELECT });
    
    if (results && results.length > 0) {
      console.log('[Migration] Columns already exist, skipping...');
      return;
    }
    
    // Add failed_login_attempts column
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0
    `);
    console.log('[Migration] Added failed_login_attempts column');
    
    // Add lockout_until column
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP WITH TIME ZONE DEFAULT NULL
    `);
    console.log('[Migration] Added lockout_until column');
    
    console.log('[Migration] Account lockout fields added successfully');
  } catch (error) {
    console.error('[Migration] Error adding account lockout fields:', error);
    throw error;
  }
}

async function down() {
  console.log('[Migration] Removing account lockout fields from users table...');
  
  try {
    await sequelize.query(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS failed_login_attempts,
      DROP COLUMN IF EXISTS lockout_until
    `);
    console.log('[Migration] Account lockout fields removed successfully');
  } catch (error) {
    console.error('[Migration] Error removing account lockout fields:', error);
    throw error;
  }
}

module.exports = { up, down };
