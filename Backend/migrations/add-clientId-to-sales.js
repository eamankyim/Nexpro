const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const addClientIdToSales = async () => {
  const isDirect = require.main === module;
  try {
    console.log('Adding clientId column to sales for offline sync idempotency...\n');
    if (isDirect) await testConnection();

    const [columnInfo] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'clientId';
    `);

    if (columnInfo.length > 0) {
      console.log('Column clientId already exists on sales.');
    } else {
      await sequelize.query(`
        ALTER TABLE sales
        ADD COLUMN "clientId" VARCHAR(255);
      `);
      console.log('Column clientId added to sales.');
    }

    const [indexInfo] = await sequelize.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'sales' AND indexname = 'sales_tenant_id_client_id_unique';
    `);
    if (indexInfo.length === 0) {
      await sequelize.query(`
        CREATE UNIQUE INDEX sales_tenant_id_client_id_unique
        ON sales ("tenantId", "clientId")
        WHERE "clientId" IS NOT NULL;
      `);
      console.log('Unique index (tenantId, clientId) created.');
    }

    console.log('add-clientId-to-sales migration completed.\n');
    if (isDirect) {
      await sequelize.close();
      process.exit(0);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    if (isDirect) {
      await sequelize.close();
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  addClientIdToSales();
}

module.exports = addClientIdToSales;
