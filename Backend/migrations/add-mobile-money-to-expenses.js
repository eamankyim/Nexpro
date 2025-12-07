const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const addMobileMoneyToExpenses = async () => {
  try {
    console.log('🔄 Adding mobile_money to expenses paymentMethod enum...');

    await sequelize.query(`
      DO $$
      DECLARE
        type_oid oid;
        has_mobile_money BOOLEAN;
      BEGIN
        -- Find the enum type for expenses paymentMethod
        SELECT oid INTO type_oid 
        FROM pg_type 
        WHERE typname = 'enum_expenses_paymentMethod';

        IF type_oid IS NULL THEN
          RAISE NOTICE 'Enum type enum_expenses_paymentMethod not found';
          RETURN;
        END IF;

        -- Check if mobile_money already exists
        SELECT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'mobile_money' AND enumtypid = type_oid
        ) INTO has_mobile_money;

        -- Add mobile_money if it doesn't exist
        IF NOT has_mobile_money THEN
          ALTER TYPE "enum_expenses_paymentMethod" ADD VALUE IF NOT EXISTS 'mobile_money';
          RAISE NOTICE 'Added mobile_money to expenses paymentMethod enum';
        ELSE
          RAISE NOTICE 'mobile_money already exists in expenses paymentMethod enum';
        END IF;
      END
      $$;
    `);

    console.log('✅ Mobile Money added to expenses paymentMethod successfully!');
  } catch (error) {
    console.error('❌ Error adding mobile_money to expenses:', error);
    throw error;
  }
};

if (require.main === module) {
  addMobileMoneyToExpenses()
    .then(() => {
      console.log('✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addMobileMoneyToExpenses };

