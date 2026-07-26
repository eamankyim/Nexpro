/**
 * Creates Online Store hero library tables and seeds starter categories.
 * Also adds heroSlides JSONB on online_store_settings.
 */

const { sequelize } = require('../config/database');

const STARTER_CATEGORIES = [
  { slug: 'electronics', name: 'Electronics', sortOrder: 10 },
  { slug: 'fashion', name: 'Fashion', sortOrder: 20 },
  { slug: 'groceries', name: 'Groceries', sortOrder: 30 },
  { slug: 'beauty', name: 'Beauty', sortOrder: 40 },
  { slug: 'general', name: 'General', sortOrder: 50 },
];

async function createOnlineStoreHeroLibraryTables(options = {}) {
  const { closeConnection = true } = options;
  console.log('[createOnlineStoreHeroLibraryTables] Starting...');

  try {
    await sequelize.authenticate();

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS online_store_hero_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(80) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS online_store_hero_categories_active_sort_idx
        ON online_store_hero_categories ("isActive", "sortOrder");
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS online_store_hero_designs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "categoryId" UUID NOT NULL REFERENCES online_store_hero_categories(id) ON DELETE CASCADE,
        name VARCHAR(160) NOT NULL,
        description TEXT NULL,
        "thumbnailUrl" TEXT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS online_store_hero_designs_category_idx
        ON online_store_hero_designs ("categoryId");
      CREATE INDEX IF NOT EXISTS online_store_hero_designs_active_sort_idx
        ON online_store_hero_designs ("isActive", "sortOrder");
    `);

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS online_store_hero_colorways (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "designId" UUID NOT NULL REFERENCES online_store_hero_designs(id) ON DELETE CASCADE,
        label VARCHAR(80) NOT NULL,
        "hexHint" VARCHAR(24) NULL,
        "imageUrl" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS online_store_hero_colorways_design_idx
        ON online_store_hero_colorways ("designId");
      CREATE INDEX IF NOT EXISTS online_store_hero_colorways_active_sort_idx
        ON online_store_hero_colorways ("isActive", "sortOrder");
    `);

    await sequelize.query(`
      ALTER TABLE online_store_settings
        ADD COLUMN IF NOT EXISTS "heroSlides" JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);

    for (const cat of STARTER_CATEGORIES) {
      await sequelize.query(
        `
        INSERT INTO online_store_hero_categories (id, slug, name, "sortOrder", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), :slug, :name, :sortOrder, true, NOW(), NOW())
        ON CONFLICT (slug) DO UPDATE
          SET name = EXCLUDED.name,
              "sortOrder" = EXCLUDED."sortOrder",
              "updatedAt" = NOW();
        `,
        { replacements: cat }
      );
    }

    console.log('[createOnlineStoreHeroLibraryTables] Done');
  } finally {
    if (closeConnection) {
      await sequelize.close();
    }
  }
}

if (require.main === module) {
  createOnlineStoreHeroLibraryTables()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = createOnlineStoreHeroLibraryTables;
