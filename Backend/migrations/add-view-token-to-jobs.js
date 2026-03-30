const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addViewTokenToJobs = async () => {
  console.log('Starting viewToken migration for jobs...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(
      `
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS "viewToken" VARCHAR(255);
    `,
      { transaction }
    );

    await sequelize.query(
      `
      CREATE UNIQUE INDEX IF NOT EXISTS jobs_view_token_unique_idx
      ON jobs ("viewToken")
      WHERE "viewToken" IS NOT NULL;
    `,
      { transaction }
    );

    await sequelize.query(
      `
      CREATE INDEX IF NOT EXISTS jobs_view_token_lookup_idx ON jobs ("viewToken");
    `,
      { transaction }
    );

    const jobs = await sequelize.query(
      `
      SELECT id FROM jobs WHERE "tenantId" IS NOT NULL AND "viewToken" IS NULL;
    `,
      { type: sequelize.QueryTypes.SELECT, transaction }
    );

    const crypto = require('crypto');
    for (const row of jobs) {
      const token = crypto.randomBytes(32).toString('hex');
      await sequelize.query(
        `
        UPDATE jobs SET "viewToken" = :token WHERE id = :id;
      `,
        { replacements: { token, id: row.id }, transaction }
      );
    }

    await transaction.commit();
    console.log('viewToken migration for jobs completed.');
  } catch (error) {
    await transaction.rollback();
    console.error('add-view-token-to-jobs migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  addViewTokenToJobs()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addViewTokenToJobs;
