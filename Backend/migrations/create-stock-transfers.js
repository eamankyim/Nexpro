const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const createStockTransfers = async () => {
  console.log('Creating stock_transfers table...');
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS stock_transfers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
      "sourceShopId" UUID NOT NULL REFERENCES shops(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      "destinationShopId" UUID NOT NULL REFERENCES shops(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      "sourceProductId" UUID NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      "destinationProductId" UUID NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      "sourceVariantId" UUID REFERENCES product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL,
      "destinationVariantId" UUID REFERENCES product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL,
      quantity DECIMAL(12, 2) NOT NULL,
      unit VARCHAR(80) NOT NULL DEFAULT 'pcs',
      status VARCHAR(30) NOT NULL DEFAULT 'completed',
      "sourceBeforeQuantity" DECIMAL(12, 2) NOT NULL,
      "sourceAfterQuantity" DECIMAL(12, 2) NOT NULL,
      "destinationBeforeQuantity" DECIMAL(12, 2) NOT NULL,
      "destinationAfterQuantity" DECIMAL(12, 2) NOT NULL,
      reason VARCHAR(255),
      notes TEXT,
      "createdBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT stock_transfers_status_check CHECK (status IN ('completed', 'cancelled')),
      CONSTRAINT stock_transfers_shop_check CHECK ("sourceShopId" <> "destinationShopId"),
      CONSTRAINT stock_transfers_quantity_check CHECK (quantity > 0)
    );
  `);

  await sequelize.query('CREATE INDEX IF NOT EXISTS stock_transfers_tenant_idx ON stock_transfers("tenantId");');
  await sequelize.query('CREATE INDEX IF NOT EXISTS stock_transfers_source_shop_idx ON stock_transfers("sourceShopId");');
  await sequelize.query('CREATE INDEX IF NOT EXISTS stock_transfers_destination_shop_idx ON stock_transfers("destinationShopId");');
  await sequelize.query('CREATE INDEX IF NOT EXISTS stock_transfers_source_product_idx ON stock_transfers("sourceProductId");');
  await sequelize.query('CREATE INDEX IF NOT EXISTS stock_transfers_destination_product_idx ON stock_transfers("destinationProductId");');
  await sequelize.query('CREATE INDEX IF NOT EXISTS stock_transfers_created_at_idx ON stock_transfers("createdAt");');

  console.log('stock_transfers table ready.');
};

if (require.main === module) {
  createStockTransfers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to create stock_transfers table:', error);
      process.exit(1);
    });
}

module.exports = createStockTransfers;
