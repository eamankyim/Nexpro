const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Ensures 'quote' is valid for invoices.sourceType on all known Postgres enum types.
 * - Sequelize-managed DBs use enum_invoices_sourceType
 * - add-invoice-source-types migration uses invoice_source_type_enum
 *
 * Idempotent: safe to run when 'quote' already exists.
 * Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction on some PostgreSQL versions.
 */
const addQuoteToInvoiceSourceTypeEnum = async () => {
  console.log('🔄 Ensuring quote is in invoice sourceType enum(s)...');

  await sequelize.query(`
    DO $$
    DECLARE
      type_rec RECORD;
    BEGIN
      FOR type_rec IN
        SELECT oid, typname FROM pg_type
        WHERE typname IN ('enum_invoices_sourceType', 'invoice_source_type_enum')
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'quote' AND enumtypid = type_rec.oid
        ) THEN
          EXECUTE format('ALTER TYPE %I ADD VALUE %L', type_rec.typname, 'quote');
          RAISE NOTICE 'Added quote to %', type_rec.typname;
        ELSE
          RAISE NOTICE 'quote already exists on %', type_rec.typname;
        END IF;
      END LOOP;
    END $$;
  `);

  console.log('✅ Invoice sourceType enum(s) include quote');
};

if (require.main === module) {
  addQuoteToInvoiceSourceTypeEnum()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = addQuoteToInvoiceSourceTypeEnum;
