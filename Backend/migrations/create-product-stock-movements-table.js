const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createProductStockMovementsTable = async () => {
  console.log('🚀 Starting product stock movements schema migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🧱 Ensuring product stock movement type enum exists...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_product_stock_movements_type') THEN
          CREATE TYPE enum_product_stock_movements_type AS ENUM (
            'receive', 'adjustment', 'transfer_in', 'transfer_out', 'return'
          );
        END IF;
      END
      $$;
    `, { transaction });

    console.log('📦 Creating product_stock_movements table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS product_stock_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "productId" UUID NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "productVariantId" UUID REFERENCES product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "shopId" UUID REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL,
        type enum_product_stock_movements_type NOT NULL DEFAULT 'adjustment',
        "quantityDelta" DECIMAL(12, 2) NOT NULL,
        "previousQuantity" DECIMAL(12, 2) NOT NULL,
        "newQuantity" DECIMAL(12, 2) NOT NULL,
        reason VARCHAR(255),
        reference VARCHAR(255),
        "createdBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    console.log('📊 Creating indexes for product_stock_movements...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS product_stock_movements_product_idx
        ON product_stock_movements("productId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS product_stock_movements_tenant_idx
        ON product_stock_movements("tenantId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS product_stock_movements_occurred_idx
        ON product_stock_movements("occurredAt" DESC);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS product_stock_movements_product_occurred_idx
        ON product_stock_movements("productId", "occurredAt" DESC);
    `, { transaction });

    await transaction.commit();
    console.log('✅ Product stock movements schema migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Product stock movements schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createProductStockMovementsTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createProductStockMovementsTable;
