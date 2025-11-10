const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createNotificationsTable = async () => {
  console.log('🚀 Starting notifications schema migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🔐 Ensuring pgcrypto extension is available...');
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`, { transaction });

    console.log('🗂️ Creating notifications table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        type VARCHAR(50) NOT NULL DEFAULT 'info',
        priority VARCHAR(50) NOT NULL DEFAULT 'normal',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        channels TEXT[] NOT NULL DEFAULT ARRAY['in_app'],
        icon VARCHAR(100),
        link VARCHAR(500),
        "triggeredBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "readAt" TIMESTAMPTZ,
        "expiresAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    console.log('📊 Creating indexes for notifications table...');
    await sequelize.query(`CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications("userId");`, { transaction });
    await sequelize.query(`CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications("isRead");`, { transaction });
    await sequelize.query(`CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications("createdAt");`, { transaction });

    await transaction.commit();
    console.log('✅ Notifications schema migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Notifications schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createNotificationsTable()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = createNotificationsTable;



