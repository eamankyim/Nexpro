const { sequelize } = require('../config/database');

async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    console.log('🔄 Creating storefront wishlist items table...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS storefront_wishlist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "storefrontCustomerId" UUID NOT NULL REFERENCES storefront_customers(id) ON DELETE CASCADE,
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        "shopId" UUID NULL REFERENCES shops(id) ON DELETE SET NULL,
        "listingId" UUID NOT NULL REFERENCES online_product_listings(id) ON DELETE CASCADE,
        "productId" UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        "productVariantId" UUID NULL REFERENCES product_variants(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_storefront_wishlist_customer_listing
      ON storefront_wishlist_items ("storefrontCustomerId", "listingId");
    `);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_storefront_wishlist_customer_created ON storefront_wishlist_items ("storefrontCustomerId", "createdAt" DESC);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_storefront_wishlist_tenant ON storefront_wishlist_items ("tenantId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_storefront_wishlist_listing ON storefront_wishlist_items ("listingId");`);

    console.log('✅ Storefront wishlist items table ready.');
  } catch (error) {
    console.error('❌ create-storefront-wishlist-items failed:', error);
    throw error;
  } finally {
    if (closeConnection) {
      try { await sequelize.close(); } catch (_) { /* ignore */ }
    }
  }
}

async function down() {
  await sequelize.query('DROP TABLE IF EXISTS storefront_wishlist_items CASCADE;');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { up, down };
