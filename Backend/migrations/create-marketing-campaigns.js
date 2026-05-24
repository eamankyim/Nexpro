const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Creating marketing campaigns table...');
    await sequelize.query(`SET statement_timeout TO 15000;`);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(180) NOT NULL,
        goal VARCHAR(120) NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'draft',
        channels JSONB NOT NULL DEFAULT '[]'::jsonb,
        "audienceFilter" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "audienceSnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "messageContent" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "scheduledAt" TIMESTAMPTZ NULL,
        "sentAt" TIMESTAMPTZ NULL,
        stats JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        "updatedBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_tenant_created ON marketing_campaigns ("tenantId", "createdAt" DESC);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_tenant_status ON marketing_campaigns ("tenantId", status);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_scheduled ON marketing_campaigns ("tenantId", "scheduledAt") WHERE status = 'scheduled';`);
    await sequelize.query(`
      DO $$
      BEGIN
        IF to_regclass('public.whatsapp_message_events') IS NOT NULL THEN
          ALTER TABLE whatsapp_message_events ADD COLUMN IF NOT EXISTS "campaignId" UUID NULL REFERENCES marketing_campaigns(id) ON DELETE SET NULL;
          CREATE INDEX IF NOT EXISTS idx_whatsapp_events_campaign ON whatsapp_message_events ("campaignId");
        END IF;
      END $$;
    `);
    await sequelize.query(`SET statement_timeout TO 0;`);
    console.log('✅ marketing campaigns ready');
  } catch (error) {
    console.error('❌ create-marketing-campaigns failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query(`ALTER TABLE whatsapp_message_events DROP COLUMN IF EXISTS "campaignId";`);
  await sequelize.query('DROP TABLE IF EXISTS marketing_campaigns CASCADE;');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
