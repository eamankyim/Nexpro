const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const KNOWN_INVOICE_SOURCE_ENUMS = ['enum_invoices_sourceType', 'invoice_source_type_enum'];

/**
 * Resolves Postgres enum type names used by invoices."sourceType".
 * @returns {Promise<string[]>}
 */
const discoverInvoiceSourceEnumTypes = async () => {
  const [columnTypes] = await sequelize.query(`
    SELECT DISTINCT udt_name AS typname
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'sourceType'
      AND udt_name IS NOT NULL;
  `);

  const fromColumn = (columnTypes || []).map((row) => row.typname).filter(Boolean);
  const merged = new Set([...KNOWN_INVOICE_SOURCE_ENUMS, ...fromColumn]);
  return [...merged];
};

/**
 * Ensures 'quote' is valid for invoices.sourceType on all relevant Postgres enum types.
 * Idempotent: safe when 'quote' already exists.
 * Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction on some PostgreSQL versions.
 */
const addQuoteToInvoiceSourceTypeEnum = async () => {
  const enumTypes = await discoverInvoiceSourceEnumTypes();
  console.log('🔄 Ensuring quote is in invoice sourceType enum(s)...');
  console.log(`   Types to check: ${enumTypes.length ? enumTypes.join(', ') : '(none — invoices.sourceType column missing?)'}`);

  if (!enumTypes.length) {
    console.log('⚠️  No invoice sourceType enum types found; skipping');
    return;
  }

  for (const typname of enumTypes) {
    const [[typeRow]] = await sequelize.query(
      `SELECT oid FROM pg_type WHERE typname = :typname LIMIT 1`,
      { replacements: { typname } }
    );
    if (!typeRow?.oid) {
      console.log(`   ⏭️  ${typname}: type does not exist`);
      continue;
    }

    const [[hasQuote]] = await sequelize.query(
      `SELECT 1 AS ok FROM pg_enum WHERE enumlabel = 'quote' AND enumtypid = :oid LIMIT 1`,
      { replacements: { oid: typeRow.oid } }
    );

    if (hasQuote?.ok) {
      console.log(`   ✓ ${typname}: quote already present`);
      continue;
    }

    await sequelize.query(`ALTER TYPE "${typname}" ADD VALUE 'quote'`);
    console.log(`   ➕ ${typname}: added quote`);
  }

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
