const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Add typed file attachments JSONB on quotes (proposal / requirements / agreement / other).
 */
const addAttachmentsToQuotes = async () => {
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query(
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;`,
      { transaction }
    );
    await transaction.commit();
    console.log('[addAttachmentsToQuotes] Done');
  } catch (e) {
    await transaction.rollback();
    console.error('[addAttachmentsToQuotes] Failed', e);
    throw e;
  }
};

module.exports = addAttachmentsToQuotes;
