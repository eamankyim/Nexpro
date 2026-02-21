/**
 * Add performance indexes for notifications queries
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addNotificationsPerformanceIndexes = async () => {
  console.log('Adding notifications performance indexes...');
  try {
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS notifications_tenant_user_created_idx 
      ON notifications("tenantId", "userId", "createdAt" DESC);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS notifications_tenant_user_read_idx 
      ON notifications("tenantId", "userId", "isRead");
    `);
    console.log('Notifications indexes created');
  } catch (error) {
    if (error.message && error.message.includes('does not exist')) {
      console.log('Notifications table may not exist, skipping');
    } else {
      throw error;
    }
  }
};

if (require.main === module) {
  addNotificationsPerformanceIndexes()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = addNotificationsPerformanceIndexes;
