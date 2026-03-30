const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addViewTokenToQuotes = async () => {
  console.log('Starting viewToken migration for quotes...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`
      ALTER TABLE quotes
      ADD COLUMN IF NOT EXISTS "viewToken" VARCHAR(255) UNIQUE;
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS quotes_view_token_idx ON quotes("viewToken");
    `, { transaction });

    const quotes = await sequelize.query(`
      SELECT id FROM quotes WHERE "viewToken" IS NULL;
    `, { type: sequelize.QueryTypes.SELECT, transaction });

    const crypto = require('crypto');
    for (const q of quotes) {
      const token = crypto.randomBytes(32).toString('hex');
      await sequelize.query(`
        UPDATE quotes SET "viewToken" = :token WHERE id = :id;
      `, { replacements: { token, id: q.id }, transaction });
    }

    await transaction.commit();
    console.log('ViewToken migration completed.');
  } catch (error) {
    await transaction.rollback();
    console.error('Migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  addViewTokenToQuotes()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = addViewTokenToQuotes;
