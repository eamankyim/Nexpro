const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Create sale_returns, sale_return_items, and sale_return_exchange_items for POS refunds/exchanges.
 */
const createSaleReturnsTables = async () => {
  console.log('🚀 Starting sale returns schema migration...');
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sale_returns_type') THEN
          CREATE TYPE enum_sale_returns_type AS ENUM ('refund', 'exchange');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sale_returns_status') THEN
          CREATE TYPE enum_sale_returns_status AS ENUM ('completed', 'cancelled');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sale_returns_refundMethod') THEN
          CREATE TYPE "enum_sale_returns_refundMethod" AS ENUM ('cash', 'card', 'mobile_money', 'bank_transfer', 'other');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sale_returns_collectMethod') THEN
          CREATE TYPE "enum_sale_returns_collectMethod" AS ENUM ('cash', 'card', 'mobile_money', 'bank_transfer', 'other');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sale_return_items_disposition') THEN
          CREATE TYPE enum_sale_return_items_disposition AS ENUM ('restock', 'write_off');
        END IF;
      END
      $$;
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sale_returns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "shopId" UUID REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "originalSaleId" UUID NOT NULL REFERENCES sales(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        "returnNumber" VARCHAR(255) NOT NULL,
        type enum_sale_returns_type NOT NULL DEFAULT 'refund',
        status enum_sale_returns_status NOT NULL DEFAULT 'completed',
        "reasonSummary" VARCHAR(255),
        "refundAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "collectAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "refundMethod" "enum_sale_returns_refundMethod",
        "collectMethod" "enum_sale_returns_collectMethod",
        "createdBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        notes TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sale_return_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "saleReturnId" UUID NOT NULL REFERENCES sale_returns(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "saleItemId" UUID NOT NULL REFERENCES sale_items(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        "productId" UUID REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "productVariantId" UUID REFERENCES product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(255),
        "qtyReturned" DECIMAL(12, 2) NOT NULL DEFAULT 1,
        "unitAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "lineRefundAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        disposition enum_sale_return_items_disposition NOT NULL DEFAULT 'restock',
        "reasonCode" VARCHAR(64),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sale_return_exchange_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "saleReturnId" UUID NOT NULL REFERENCES sale_returns(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "productId" UUID REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "productVariantId" UUID REFERENCES product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(255),
        quantity DECIMAL(12, 2) NOT NULL DEFAULT 1,
        "unitPrice" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "lineTotal" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sale_returns_tenant_idx ON sale_returns("tenantId");
      CREATE INDEX IF NOT EXISTS sale_returns_shop_idx ON sale_returns("shopId");
      CREATE INDEX IF NOT EXISTS sale_returns_sale_idx ON sale_returns("originalSaleId");
      CREATE INDEX IF NOT EXISTS sale_returns_number_idx ON sale_returns("returnNumber");
      CREATE INDEX IF NOT EXISTS sale_returns_created_idx ON sale_returns("createdAt");
      CREATE INDEX IF NOT EXISTS sale_return_items_return_idx ON sale_return_items("saleReturnId");
      CREATE INDEX IF NOT EXISTS sale_return_items_sale_item_idx ON sale_return_items("saleItemId");
      CREATE INDEX IF NOT EXISTS sale_return_exchange_items_return_idx ON sale_return_exchange_items("saleReturnId");
    `, { transaction });

    await transaction.commit();
    console.log('✅ Sale returns schema migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Sale returns schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createSaleReturnsTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createSaleReturnsTables;
