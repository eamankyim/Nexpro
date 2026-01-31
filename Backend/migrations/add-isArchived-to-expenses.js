const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addIsArchivedToExpenses = async () => {
  console.log('🚀 Starting add isArchived to expenses migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('📦 Adding isArchived column to expenses table...');
    await sequelize.query(`
      ALTER TABLE expenses
      ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
    `, { transaction });

    console.log('📊 Creating index for isArchived...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_isArchived_idx ON expenses("isArchived");
    `, { transaction });

    await transaction.commit();
    console.log('✅ Add isArchived to expenses migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Add isArchived to expenses migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  addIsArchivedToExpenses()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addIsArchivedToExpenses;
