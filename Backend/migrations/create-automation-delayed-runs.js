const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Creating automation_delayed_runs table...');
    await sequelize.query(`SET statement_timeout TO 15000;`);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS automation_delayed_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "ruleId" UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
        "triggerContext" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "runAt" TIMESTAMPTZ NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'pending',
        "subjectKey" VARCHAR(255) NULL,
        error TEXT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_automation_delayed_runs_due
      ON automation_delayed_runs (status, "runAt")
      WHERE status = 'pending';
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_automation_delayed_runs_tenant
      ON automation_delayed_runs ("tenantId", "createdAt" DESC);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_automation_delayed_runs_rule
      ON automation_delayed_runs ("ruleId");
    `);
    // One pending delayed run per rule + subject (NULL subjectKey allowed multiple times).
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_delayed_runs_pending_subject
      ON automation_delayed_runs ("tenantId", "ruleId", "subjectKey")
      WHERE status = 'pending' AND "subjectKey" IS NOT NULL;
    `);
    await sequelize.query(`SET statement_timeout TO 0;`);
    console.log('✅ automation_delayed_runs ready');
  } catch (error) {
    console.error('❌ create-automation-delayed-runs failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query('DROP TABLE IF EXISTS automation_delayed_runs CASCADE;');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
