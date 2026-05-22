const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Add adminLeadId to jobs (platform admin lead link). Safe for tenant DBs.
 */
const addAdminLeadIdToJobs = async () => {
  console.log('🚀 Adding adminLeadId to jobs...');
  const transaction = await sequelize.transaction();

  try {
    const [rows] = await sequelize.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'jobs'
        AND column_name = 'adminLeadId';
    `,
      { transaction }
    );

    if (!rows.length) {
      await sequelize.query(
        `
        ALTER TABLE jobs
        ADD COLUMN "adminLeadId" UUID REFERENCES leads(id) ON UPDATE CASCADE ON DELETE SET NULL;
      `,
        { transaction }
      );
      console.log('✅ Added adminLeadId column to jobs');
    } else {
      console.log('ℹ️  adminLeadId column already exists on jobs');
    }

    await sequelize.query(
      `
      CREATE INDEX IF NOT EXISTS jobs_admin_lead_idx
      ON jobs("adminLeadId")
      WHERE "adminLeadId" IS NOT NULL;
    `,
      { transaction }
    );

    await transaction.commit();
    console.log('✅ adminLeadId migration completed');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ adminLeadId migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  addAdminLeadIdToJobs()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addAdminLeadIdToJobs;
