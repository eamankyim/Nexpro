const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addPaymentTokenToInvoices = async () => {
  console.log('🚀 Starting payment token migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🔐 Ensuring pgcrypto extension is available...');
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`, { transaction });

    // Add paymentToken column
    console.log('➕ Adding paymentToken column...');
    await sequelize.query(`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS "paymentToken" VARCHAR(255) UNIQUE;
    `, { transaction });

    // Create index for faster lookups
    console.log('📊 Creating index on paymentToken...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_payment_token_idx ON invoices("paymentToken");
    `, { transaction });

    // Generate tokens for existing invoices
    console.log('🔄 Generating payment tokens for existing invoices...');
    const invoices = await sequelize.query(`
      SELECT id FROM invoices WHERE "paymentToken" IS NULL;
    `, { type: sequelize.QueryTypes.SELECT, transaction });

    console.log(`Found ${invoices.length} invoices without payment tokens`);

    for (const invoice of invoices) {
      const token = require('crypto').randomBytes(32).toString('hex');
      await sequelize.query(`
        UPDATE invoices
        SET "paymentToken" = :token
        WHERE id = :id;
      `, {
        replacements: { token, id: invoice.id },
        transaction
      });
    }

    await transaction.commit();
    console.log('✅ Payment token migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error during migration:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  addPaymentTokenToInvoices()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addPaymentTokenToInvoices;
