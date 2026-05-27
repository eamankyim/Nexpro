const { sequelize } = require('../config/database');

async function up() {
  console.log('Creating support_tickets and support_access_sessions tables...');

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'open',
      priority VARCHAR(50) NOT NULL DEFAULT 'medium',
      category VARCHAR(100) NULL,
      source VARCHAR(50) NOT NULL DEFAULT 'admin_manual',
      "createdBy" UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      "assignedTo" UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      "resolvedAt" TIMESTAMPTZ NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON support_tickets ("tenantId");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status);
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets ("assignedTo");
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS support_access_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      "adminUserId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "supportTicketId" UUID NULL REFERENCES support_tickets(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      mode VARCHAR(30) NOT NULL DEFAULT 'read_only',
      "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "endedAt" TIMESTAMPTZ NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_support_access_sessions_tenant ON support_access_sessions ("tenantId");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_support_access_sessions_admin ON support_access_sessions ("adminUserId");
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_support_access_sessions_active ON support_access_sessions ("adminUserId", "endedAt", "expiresAt");
  `);

  console.log('support_tickets and support_access_sessions ready');
}

async function down() {
  await sequelize.query('DROP TABLE IF EXISTS support_access_sessions CASCADE;');
  await sequelize.query('DROP TABLE IF EXISTS support_tickets CASCADE;');
}

if (require.main === module) {
  up()
    .then(async () => {
      await sequelize.close().catch(() => {});
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await sequelize.close().catch(() => {});
      process.exit(1);
    });
}

module.exports = { up, down };
