const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addInviteEmailStatusFields = async () => {
  console.log('Starting invite email status fields migration...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`
      ALTER TABLE invite_tokens
      ADD COLUMN IF NOT EXISTS "emailStatus" VARCHAR(20) NOT NULL DEFAULT 'pending';
    `, { transaction });

    await sequelize.query(`
      ALTER TABLE invite_tokens
      ADD COLUMN IF NOT EXISTS "emailLastError" TEXT;
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invite_tokens_email_status_idx ON invite_tokens("emailStatus");
    `, { transaction });

    await transaction.commit();
    console.log('Invite email status fields migration completed.');
  } catch (error) {
    await transaction.rollback();
    console.error('Invite email status fields migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  addInviteEmailStatusFields()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = addInviteEmailStatusFields;
