const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Creating automations tables...');
    await sequelize.query(`SET statement_timeout TO 15000;`);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS automation_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(160) NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        "triggerType" VARCHAR(80) NOT NULL,
        "triggerConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "conditionConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "actionConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "scheduleConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        "updatedBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant ON automation_rules ("tenantId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules ("tenantId", enabled);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON automation_rules ("tenantId", "triggerType");`);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS automation_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "ruleId" UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
        status VARCHAR(40) NOT NULL DEFAULT 'success',
        "triggerContext" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "resultSummary" JSONB NOT NULL DEFAULT '{}'::jsonb,
        error TEXT NULL,
        "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "finishedAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant ON automation_runs ("tenantId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_automation_runs_rule ON automation_runs ("ruleId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_automation_runs_created ON automation_runs ("createdAt" DESC);`);
    await sequelize.query(`SET statement_timeout TO 0;`);
    console.log('✅ automations tables ready');
  } catch (error) {
    console.error('❌ create-automations-tables failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query('DROP TABLE IF EXISTS automation_runs CASCADE;');
  await sequelize.query('DROP TABLE IF EXISTS automation_rules CASCADE;');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
