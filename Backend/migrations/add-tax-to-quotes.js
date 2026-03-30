const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addTaxToQuotes = async () => {
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query(
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0;`,
      { transaction }
    );
    await sequelize.query(
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;`,
      { transaction }
    );
    await transaction.commit();
    console.log('[addTaxToQuotes] Done');
  } catch (e) {
    await transaction.rollback();
    console.error('[addTaxToQuotes] Failed', e);
    throw e;
  }
};

module.exports = addTaxToQuotes;
