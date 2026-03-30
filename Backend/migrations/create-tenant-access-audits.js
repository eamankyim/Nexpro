const { sequelize } = require('../config/database');

async function up() {
  try {
    console.log('🔄 Creating tenant_access_audits table...');
    // Fail fast if DB is unreachable (prevents hanging forever on bad network/DB state).
    await sequelize.query(`SET statement_timeout TO 15000;`);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS tenant_access_audits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "actorUserId" UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(80) NOT NULL DEFAULT 'tenant_access_updated',
        "before" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "after" JSONB NOT NULL DEFAULT '{}'::jsonb,
        reason TEXT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_tenant_access_audits_tenant ON tenant_access_audits ("tenantId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_tenant_access_audits_actor ON tenant_access_audits ("actorUserId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_tenant_access_audits_created_at ON tenant_access_audits ("createdAt");`);
    console.log('✅ tenant_access_audits ready');
    await sequelize.query(`SET statement_timeout TO 0;`);
  } catch (error) {
    console.error('❌ create-tenant-access-audits failed:', error);
    throw error;
  } finally {
    try {
      await sequelize.close();
    } catch (_) {
      // ignore close errors on script exit
    }
  }
}

async function down() {
  try {
    await sequelize.query(`DROP TABLE IF EXISTS tenant_access_audits CASCADE;`);
  } catch (error) {
    console.error('❌ create-tenant-access-audits down failed:', error);
    throw error;
  }
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { up, down };
