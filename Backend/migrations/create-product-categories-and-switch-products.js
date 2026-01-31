/**
 * Creates product_categories table, migrates product category refs from
 * inventory_categories to product_categories, and updates products FK.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

const createProductCategoriesAndSwitchProducts = async () => {
  console.log('📦 Creating product_categories table...');
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT product_categories_tenant_name_unique UNIQUE ("tenantId", name)
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS product_categories_tenant_idx ON product_categories("tenantId");
  `);
  console.log('✅ product_categories table created.');

  const rows = await sequelize.query(
    `SELECT DISTINCT p."categoryId", p."tenantId", ic.name
     FROM products p
     JOIN inventory_categories ic ON ic.id = p."categoryId"
     WHERE p."categoryId" IS NOT NULL`,
    { type: QueryTypes.SELECT }
  );

  const idMap = new Map();
  const seen = new Set();

  for (const r of rows) {
    const key = `${r.tenantId}|${r.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const inserted = await sequelize.query(
      `INSERT INTO product_categories (id, "tenantId", name, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), :tenantId, :name, NOW(), NOW())
       ON CONFLICT ("tenantId", name) DO UPDATE SET "updatedAt" = NOW()
       RETURNING id`,
      {
        replacements: { tenantId: r.tenantId, name: r.name },
        type: QueryTypes.SELECT
      }
    );
    const newId = Array.isArray(inserted) && inserted[0] ? inserted[0].id : (inserted && inserted.id);
    if (newId) idMap.set(r.categoryId, newId);
  }

  for (const [oldId, newId] of idMap) {
    await sequelize.query(
      `UPDATE products SET "categoryId" = :newId WHERE "categoryId" = :oldId`,
      { replacements: { oldId, newId } }
    );
  }

  await sequelize.query(`
    UPDATE products SET "categoryId" = NULL
    WHERE "categoryId" IS NOT NULL
    AND "categoryId" NOT IN (SELECT id FROM product_categories);
  `);

  console.log('🔗 Switching products.categoryId FK to product_categories...');
  await sequelize.query(`
    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_categoryId_fkey;
  `);
  await sequelize.query(`
    ALTER TABLE products
    ADD CONSTRAINT products_categoryId_fkey
    FOREIGN KEY ("categoryId") REFERENCES product_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;
  `);
  console.log('✅ products.categoryId now references product_categories.');
};

if (require.main === module) {
  createProductCategoriesAndSwitchProducts()
    .then(() => { console.log('✅ Product categories migration done.'); process.exit(0); })
    .catch((err) => { console.error('❌ Product categories migration failed:', err); process.exit(1); });
}

module.exports = createProductCategoriesAndSwitchProducts;
