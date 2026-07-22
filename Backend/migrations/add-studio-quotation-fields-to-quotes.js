const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Add studio quotation fields: payment schedule, scope, terms, client acceptance flag.
 */
const addStudioQuotationFieldsToQuotes = async () => {
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query(
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS "paymentSchedule" JSONB NOT NULL DEFAULT '[]'::jsonb;`,
      { transaction }
    );
    await sequelize.query(
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS "scopeOfWork" TEXT;`,
      { transaction }
    );
    await sequelize.query(
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;`,
      { transaction }
    );
    await sequelize.query(
      `ALTER TABLE quotes ADD COLUMN IF NOT EXISTS "showClientAcceptance" BOOLEAN NOT NULL DEFAULT true;`,
      { transaction }
    );
    await transaction.commit();
    console.log('[addStudioQuotationFieldsToQuotes] Done');
  } catch (e) {
    await transaction.rollback();
    console.error('[addStudioQuotationFieldsToQuotes] Failed', e);
    throw e;
  }
};

module.exports = addStudioQuotationFieldsToQuotes;

if (require.main === module) {
  addStudioQuotationFieldsToQuotes()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
