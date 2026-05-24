const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Adding communication consent and WhatsApp event tables...');
    await sequelize.query(`SET statement_timeout TO 15000;`);
    await sequelize.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS "whatsappConsent" BOOLEAN NULL;`);
    await sequelize.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS "smsConsent" BOOLEAN NULL;`);
    await sequelize.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NULL;`);
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_message_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NULL REFERENCES tenants(id) ON DELETE SET NULL,
        "phoneNumberId" VARCHAR(80) NULL,
        "messageId" VARCHAR(160) NULL,
        direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
        "eventType" VARCHAR(40) NOT NULL,
        status VARCHAR(40) NULL,
        "recipientPhone" VARCHAR(40) NULL,
        "senderPhone" VARCHAR(40) NULL,
        "templateName" VARCHAR(120) NULL,
        error TEXT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_events_tenant_created ON whatsapp_message_events ("tenantId", "createdAt" DESC);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_events_phone_number ON whatsapp_message_events ("phoneNumberId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_events_message ON whatsapp_message_events ("messageId");`);
    await sequelize.query(`SET statement_timeout TO 0;`);
    console.log('✅ communication consent and WhatsApp events ready');
  } catch (error) {
    console.error('❌ add-communication-consent-and-whatsapp-events failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query('DROP TABLE IF EXISTS whatsapp_message_events CASCADE;');
  await sequelize.query(`ALTER TABLE customers DROP COLUMN IF EXISTS "marketingConsent";`);
  await sequelize.query(`ALTER TABLE customers DROP COLUMN IF EXISTS "smsConsent";`);
  await sequelize.query(`ALTER TABLE customers DROP COLUMN IF EXISTS "whatsappConsent";`);
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
