const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Adds support for shop quote → invoice → sale flow:
 * - quoteId on invoices, sourceType 'quote'
 * - productId on quote_items for product-based quote lines
 */
const run = async () => {
  // Ensure invoice source type enum exists and includes 'quote'
  const [rows] = await sequelize.query(`
    SELECT 1 FROM pg_type WHERE typname = 'invoice_source_type_enum' LIMIT 1;
  `);
  if (rows && rows.length > 0) {
    try {
      await sequelize.query(`ALTER TYPE invoice_source_type_enum ADD VALUE 'quote';`);
    } catch (e) {
      if (!/already exists/.test(e?.message || '')) throw e;
    }
  } else {
    await sequelize.query(`
      CREATE TYPE invoice_source_type_enum AS ENUM ('job', 'sale', 'prescription', 'quote');
    `);
  }

  const transaction = await sequelize.transaction();
  try {
    // Add quoteId to invoices
    await sequelize.query(`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS "quoteId" UUID REFERENCES quotes(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_quote_id_idx ON invoices("quoteId");
    `, { transaction });

    // Add productId to quote_items (optional – for product-based quote lines)
    await sequelize.query(`
      ALTER TABLE quote_items
      ADD COLUMN IF NOT EXISTS "productId" UUID REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS quote_items_product_id_idx ON quote_items("productId");
    `, { transaction });

    await transaction.commit();
    console.log('add-quote-invoice-sale-flow migration completed');
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

if (require.main === module) {
  run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = run;
