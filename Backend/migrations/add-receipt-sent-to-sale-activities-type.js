'use strict';

/**
 * Add 'receipt_sent' to sale_activities type enum.
 * Used when logging receipt SMS/email/WhatsApp delivery on a sale.
 */
module.exports = {
  async up() {
    const { sequelize } = require('../config/database');

    await sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sale_activities_type')
           AND NOT EXISTS (
             SELECT 1 FROM pg_enum
             WHERE enumlabel = 'receipt_sent'
             AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_sale_activities_type')
           ) THEN
          ALTER TYPE enum_sale_activities_type ADD VALUE 'receipt_sent';
        END IF;
      END $$;
    `);

    console.log('✅ add-receipt-sent-to-sale-activities-type completed.');
  },

  async down() {
    // PostgreSQL does not support removing enum values easily; leave as-is.
  }
};
