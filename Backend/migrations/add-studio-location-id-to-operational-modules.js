const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');

const TARGETS = [
  { table: 'expenses', index: 'expenses_studio_location_idx' },
  // customer_feedback: column + index handled in create-customer-feedback-table.js
  { table: 'user_tasks', index: 'user_tasks_studio_location_idx' },
  { table: 'materials_items', index: 'materials_items_studio_location_idx' },
  { table: 'equipment', index: 'equipment_studio_location_idx' },
];

const quoteIdent = (identifier) => {
  if (!/^[a-z][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
};

const addStudioLocationIdToOperationalModules = async () => {
  const isDirect = require.main === module;
  try {
    console.log('add-studio-location-id-to-operational-modules...');
    if (isDirect) await testConnection();

    for (const { table, index } of TARGETS) {
      await sequelize.query(`
        ALTER TABLE ${quoteIdent(table)}
        ADD COLUMN IF NOT EXISTS "studioLocationId" UUID
        REFERENCES studio_locations(id) ON UPDATE CASCADE ON DELETE SET NULL;
      `);
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS ${quoteIdent(index)}
        ON ${quoteIdent(table)} ("studioLocationId");
      `);
    }

    console.log('add-studio-location-id-to-operational-modules completed.');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('add-studio-location-id-to-operational-modules failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  addStudioLocationIdToOperationalModules();
}

module.exports = addStudioLocationIdToOperationalModules;
