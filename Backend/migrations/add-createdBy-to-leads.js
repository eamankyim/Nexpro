'use strict';

const { sequelize } = require('../config/database');

const addCreatedByToLeads = async () => {
  try {
    console.log('🔄 Adding createdBy column to leads table...');
    
    // Add createdBy field
    await sequelize.query(`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS "createdBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `);
    
    console.log('✅ Added createdBy column to leads table');
  } catch (error) {
    console.error('❌ Error adding createdBy column:', error);
    throw error;
  }
};

module.exports = addCreatedByToLeads;
