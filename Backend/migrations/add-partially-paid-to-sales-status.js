'use strict';

/**
 * Add 'partially_paid' to sales status enum.
 * Used when a sale has received some payment but is not fully paid.
 */
module.exports = {
  async up(queryInterface) {
    const tableInfo = await queryInterface.describeTable('sales');
    if (!tableInfo || !tableInfo.status) return;

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'partially_paid'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_sales_status')
        ) THEN
          ALTER TYPE enum_sales_status ADD VALUE 'partially_paid';
        END IF;
      END $$;
    `);
  },

  async down() {
    // PostgreSQL does not support removing enum values easily; leave as-is.
  }
};
