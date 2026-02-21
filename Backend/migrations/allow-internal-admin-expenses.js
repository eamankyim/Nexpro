/**
 * Migration: Allow internal (platform) expenses in Control Panel
 * - expenses.tenantId becomes nullable for internal platform expenses
 * - expense_activities.tenantId becomes nullable for internal expense activities
 * - Update unique constraint to support both tenant and internal expenses
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const allowInternalAdminExpenses = async () => {
  const transaction = await sequelize.transaction();
  try {
    console.log('🚀 Starting allow internal admin expenses migration...\n');

    // Step 1: Make tenantId nullable in expenses table
    console.log('📋 Making tenantId nullable in expenses table...');
    await sequelize.query(`
      ALTER TABLE expenses 
      ALTER COLUMN "tenantId" DROP NOT NULL;
    `, { transaction });
    console.log('   ✅ tenantId is now nullable in expenses');

    // Step 2: Update unique constraint on expenses to handle NULL tenantId (internal expenses)
    console.log('📋 Updating unique constraint on expenses table...');
    const [constraintCheck] = await sequelize.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'expenses' 
      AND constraint_type = 'UNIQUE' 
      AND constraint_name = 'expenses_tenantId_expenseNumber_key';
    `, { transaction });

    if (constraintCheck.length > 0) {
      await sequelize.query(`
        ALTER TABLE expenses 
        DROP CONSTRAINT IF EXISTS "expenses_tenantId_expenseNumber_key";
      `, { transaction });
      console.log('   ✅ Dropped existing composite unique constraint');

      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS expenses_tenantId_expenseNumber_unique_idx 
        ON expenses("tenantId", "expenseNumber") 
        WHERE "tenantId" IS NOT NULL;
      `, { transaction });
      console.log('   ✅ Created partial unique index for tenant expenses');
    }

    // Step 3: Make tenantId nullable in expense_activities table
    console.log('📋 Making tenantId nullable in expense_activities table...');
    await sequelize.query(`
      ALTER TABLE expense_activities 
      ALTER COLUMN "tenantId" DROP NOT NULL;
    `, { transaction });
    console.log('   ✅ tenantId is now nullable in expense_activities');

    await transaction.commit();
    console.log('\n✅ Internal admin expenses migration completed successfully!');
    console.log('📊 Control Panel expenses are now internal (platform) expenses, not tenant expenses.\n');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  allowInternalAdminExpenses()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = allowInternalAdminExpenses;
