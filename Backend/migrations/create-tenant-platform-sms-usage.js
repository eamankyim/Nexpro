const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Creating tenant_platform_sms_usage table...');
    await sequelize.query(`SET statement_timeout TO 15000;`);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS tenant_platform_sms_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        year_month VARCHAR(7) NOT NULL,
        sent_count INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT tenant_platform_sms_usage_unique UNIQUE (tenant_id, year_month)
      );
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_platform_sms_usage_tenant_month
      ON tenant_platform_sms_usage (tenant_id, year_month);
    `);
    await sequelize.query(`SET statement_timeout TO 0;`);
    console.log('✅ tenant_platform_sms_usage ready');
  } catch (error) {
    console.error('❌ create-tenant-platform-sms-usage failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query('DROP TABLE IF EXISTS tenant_platform_sms_usage CASCADE;');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
