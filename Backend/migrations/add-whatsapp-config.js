const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addWhatsAppConfig = async () => {
  console.log('🚀 Starting WhatsApp configuration migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🔐 Ensuring pgcrypto extension is available...');
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`, { transaction });

    // WhatsApp configuration will be stored in settings table with key 'whatsapp'
    // No schema changes needed - settings table already supports JSONB values
    // We'll just ensure the structure is documented

    console.log('✅ WhatsApp configuration can be stored in settings table');
    console.log('📝 Structure: { enabled: boolean, phoneNumberId: string, accessToken: string, businessAccountId: string, webhookVerifyToken: string, templateNamespace: string }');

    await transaction.commit();
    console.log('✅ WhatsApp configuration migration completed!');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  addWhatsAppConfig()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addWhatsAppConfig;
