const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('Adding customer date of birth field...');
    await sequelize.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE NULL;`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_customers_tenant_date_of_birth ON customers ("tenantId", "dateOfBirth");`);
    console.log('[Migration] customer date of birth field ready');
  } catch (error) {
    console.error('add-customer-date-of-birth failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query('DROP INDEX IF EXISTS idx_customers_tenant_date_of_birth;');
  await sequelize.query(`ALTER TABLE customers DROP COLUMN IF EXISTS "dateOfBirth";`);
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
