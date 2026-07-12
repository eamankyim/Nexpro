const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Adds branch scope columns (shopId, studioLocationId) to automation_rules.
 * No backfill: existing rules keep both columns NULL, which means "applies to
 * all branches" — this preserves current behavior for every pre-existing rule.
 */
const addBranchFieldsToAutomationRules = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 add-branch-fields-to-automation-rules...\n');
    if (isDirect) await testConnection();

    const rows = await sequelize.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'automation_rules' LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    if (!rows.length) {
      console.log('  ⏭️  Skipping automation_rules (table does not exist)');
      if (isDirect) process.exit(0);
      return;
    }

    console.log('  ➡️  Adding automation_rules.shopId and .studioLocationId (nullable = all branches)...');
    await sequelize.query(`
      ALTER TABLE automation_rules
      ADD COLUMN IF NOT EXISTS "shopId" UUID REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `);
    await sequelize.query(`
      ALTER TABLE automation_rules
      ADD COLUMN IF NOT EXISTS "studioLocationId" UUID REFERENCES studio_locations(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_automation_rules_shop ON automation_rules ("shopId");
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_automation_rules_studio_location ON automation_rules ("studioLocationId");
    `);

    console.log('✅ add-branch-fields-to-automation-rules completed.\n');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('❌ add-branch-fields-to-automation-rules failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  addBranchFieldsToAutomationRules();
}

module.exports = addBranchFieldsToAutomationRules;
