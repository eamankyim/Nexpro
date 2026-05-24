const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createCustomerFeedbackTable = async () => {
  console.log('Starting customer_feedback migration...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(
      `
      CREATE TABLE IF NOT EXISTS customer_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "studioLocationId" UUID REFERENCES studio_locations(id) ON UPDATE CASCADE ON DELETE SET NULL,
        rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        "contactName" VARCHAR(255),
        "contactEmail" VARCHAR(255),
        "contactPhone" VARCHAR(50),
        source VARCHAR(50) NOT NULL DEFAULT 'direct',
        "sourceRef" VARCHAR(255),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
      { transaction }
    );

    // Table may predate studioLocationId; CREATE TABLE IF NOT EXISTS does not add new columns
    await sequelize.query(
      `
      ALTER TABLE customer_feedback
      ADD COLUMN IF NOT EXISTS "studioLocationId" UUID
      REFERENCES studio_locations(id) ON UPDATE CASCADE ON DELETE SET NULL;
    `,
      { transaction }
    );

    await sequelize.query(
      `
      CREATE INDEX IF NOT EXISTS customer_feedback_tenant_created_idx
      ON customer_feedback ("tenantId", "createdAt" DESC);
    `,
      { transaction }
    );

    await sequelize.query(
      `
      CREATE INDEX IF NOT EXISTS customer_feedback_studio_location_idx
      ON customer_feedback ("studioLocationId");
    `,
      { transaction }
    );

    await transaction.commit();
    console.log('customer_feedback migration completed.');
  } catch (error) {
    await transaction.rollback();
    console.error('customer_feedback migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createCustomerFeedbackTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { createCustomerFeedbackTable };
