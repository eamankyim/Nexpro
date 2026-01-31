const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

/**
 * Makes expenseNumber unique per tenant instead of globally.
 * Drops the global unique on expenseNumber and adds (tenantId, expenseNumber) unique.
 */
const fixExpenseNumberUniqueConstraint = async () => {
  try {
    console.log('🔄 Fixing expenseNumber unique constraint to be per-tenant...\n');

    await testConnection();

    // Find unique constraints on expenses that are only on expenseNumber (global unique); drop all of them
    const [allUnique] = await sequelize.query(`
      SELECT c.conname AS constraint_name,
             array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) AS columns
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
      WHERE t.relname = 'expenses'
        AND n.nspname = 'public'
        AND c.contype = 'u'
      GROUP BY c.conname, c.conkey
    `);

    const globalConstraints = allUnique.filter((row) => {
      const cols = row.columns;
      const arr = Array.isArray(cols) ? cols : (typeof cols === 'string' ? cols.replace(/^\{|\}$/g, '').split(',') : []);
      return arr.length === 1 && arr[0] === 'expenseNumber';
    });

    for (const row of globalConstraints) {
      const constraintName = row.constraint_name;
      console.log('📋 Removing global unique constraint on expenseNumber:', constraintName);
      await sequelize.query(`ALTER TABLE expenses DROP CONSTRAINT IF EXISTS "${constraintName}";`);
      console.log('   ✅ Dropped', constraintName);
    }
    if (globalConstraints.length === 0) {
      console.log('   ℹ️  No global unique constraint on expenseNumber found (may be already removed)');
    }

    // Add composite unique on (tenantId, expenseNumber) if not exists
    const [compositeCheck] = await sequelize.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'expenses'
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'expenses_tenantId_expenseNumber_key';
    `);

    if (compositeCheck.length === 0) {
      console.log('📋 Adding composite unique constraint on (tenantId, expenseNumber)...');
      await sequelize.query(`
        ALTER TABLE expenses
        ADD CONSTRAINT "expenses_tenantId_expenseNumber_key"
        UNIQUE ("tenantId", "expenseNumber");
      `);
      console.log('   ✅ Added composite unique constraint');
    } else {
      console.log('   ℹ️  Composite unique constraint already exists');
    }

    console.log('\n✅ Expense number constraint migration completed successfully!');
    console.log('📊 Expense numbers are now unique per tenant, not globally.\n');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    await sequelize.close();
    process.exit(1);
  }
};

if (require.main === module) {
  fixExpenseNumberUniqueConstraint();
}

module.exports = fixExpenseNumberUniqueConstraint;
