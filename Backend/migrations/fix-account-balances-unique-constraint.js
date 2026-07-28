const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const CORRECT_INDEX = 'account_balances_tenant_account_period_idx';
const PERIOD_FIELDS = ['tenantId', 'accountId', 'fiscalYear', 'period'];

/**
 * Normalize pg array_agg / text[] column lists to a plain string array.
 * @param {string[]|string} cols
 * @returns {string[]}
 */
const toColumnList = (cols) => {
  if (Array.isArray(cols)) return cols.map(String);
  if (typeof cols === 'string') {
    return cols.replace(/^\{|\}$/g, '').split(',').map((c) => c.trim()).filter(Boolean);
  }
  return [];
};

/**
 * True when columns are exactly the intended period uniqueness key.
 * @param {string[]} cols
 * @returns {boolean}
 */
const isCorrectPeriodUnique = (cols) =>
  cols.length === PERIOD_FIELDS.length && PERIOD_FIELDS.every((f, i) => cols[i] === f);

/**
 * Account balances are per tenant + account + fiscal year + period.
 * A wrong unique on only (tenantId, accountId) makes findOrCreate(period=N)
 * miss an existing row for period=M and then fail on INSERT.
 *
 * This migration drops incorrect uniques and ensures the 4-column unique index.
 */
const fixAccountBalancesUniqueConstraint = async ({ closeConnection = true } = {}) => {
  const isDirect = require.main === module;
  try {
    console.log('[fixAccountBalancesUniqueConstraint] Starting...');
    if (isDirect) await testConnection();

    const [tables] = await sequelize.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'account_balances' LIMIT 1`
    );
    if (!tables.length) {
      console.log('  Skipping account_balances (table does not exist)');
      return;
    }

    const [uniqueConstraints] = await sequelize.query(`
      SELECT c.conname AS name,
             array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) AS columns
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
      WHERE t.relname = 'account_balances'
        AND n.nspname = 'public'
        AND c.contype = 'u'
      GROUP BY c.conname, c.conkey
    `);

    for (const row of uniqueConstraints) {
      const cols = toColumnList(row.columns);
      if (isCorrectPeriodUnique(cols)) {
        console.log(`  Keeping correct unique constraint: ${row.name}`);
        continue;
      }
      console.log(`  Dropping incorrect unique constraint ${row.name} on (${cols.join(', ')})`);
      await sequelize.query(`ALTER TABLE account_balances DROP CONSTRAINT IF EXISTS "${row.name}";`);
    }

    const [uniqueIndexes] = await sequelize.query(`
      SELECT i.relname AS name,
             array_agg(a.attname ORDER BY x.ord) AS columns
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ord) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum AND NOT a.attisdropped
      WHERE t.relname = 'account_balances'
        AND n.nspname = 'public'
        AND ix.indisunique = true
        AND NOT ix.indisprimary
        AND x.attnum > 0
      GROUP BY i.relname
    `);

    let hasCorrectIndex = false;
    for (const row of uniqueIndexes) {
      const cols = toColumnList(row.columns);
      if (isCorrectPeriodUnique(cols)) {
        hasCorrectIndex = true;
        console.log(`  Keeping correct unique index: ${row.name}`);
        continue;
      }
      // Constraint-backed indexes are dropped with the constraint above; skip if gone.
      console.log(`  Dropping incorrect unique index ${row.name} on (${cols.join(', ')})`);
      await sequelize.query(`DROP INDEX IF EXISTS "${row.name}";`);
    }

    if (!hasCorrectIndex) {
      // Re-check after drops (constraint may have owned the correct index under another name)
      const [recheck] = await sequelize.query(`
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'account_balances'
          AND indexname = :indexName
        LIMIT 1
      `, { replacements: { indexName: CORRECT_INDEX } });

      if (!recheck.length) {
        console.log(`  Creating unique index ${CORRECT_INDEX} on (tenantId, accountId, fiscalYear, period)`);
        await sequelize.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS ${CORRECT_INDEX}
          ON account_balances ("tenantId", "accountId", "fiscalYear", "period")
        `);
      }
    }

    console.log('[fixAccountBalancesUniqueConstraint] Done.');
  } catch (error) {
    console.error('[fixAccountBalancesUniqueConstraint] Failed:', error.message);
    throw error;
  } finally {
    if (isDirect && closeConnection) {
      await sequelize.close();
    }
  }
};

module.exports = fixAccountBalancesUniqueConstraint;

if (require.main === module) {
  fixAccountBalancesUniqueConstraint()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
