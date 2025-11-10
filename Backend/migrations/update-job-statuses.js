const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const updateJobStatuses = async () => {
  try {
    console.log('🔄 Updating job status enum values...');

    await sequelize.query(`
      DO $$
      DECLARE
        type_oid oid;
        has_pending BOOLEAN;
        has_new BOOLEAN;
      BEGIN
        SELECT oid INTO type_oid FROM pg_type WHERE typname = 'enum_jobs_status';

        IF type_oid IS NULL THEN
          RETURN;
        END IF;

        SELECT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'pending' AND enumtypid = type_oid
        ) INTO has_pending;

        SELECT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'new' AND enumtypid = type_oid
        ) INTO has_new;

        IF has_pending AND NOT has_new THEN
          EXECUTE 'ALTER TYPE "enum_jobs_status" RENAME VALUE ''pending'' TO ''new''';
        ELSIF has_pending AND has_new THEN
          UPDATE jobs SET status = 'new' WHERE status = 'pending';
        END IF;
      END
      $$;
    `);

    console.log('✅ Job status enum updated successfully!');
  } catch (error) {
    console.error('❌ Error updating job statuses:', error);
    throw error;
  }
};

if (require.main === module) {
  updateJobStatuses()
    .then(() => {
      console.log('🎉 Job status update completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Job status update failed:', error);
      process.exit(1);
    });
}

module.exports = updateJobStatuses;


