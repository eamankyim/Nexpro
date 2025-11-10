const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createInventoryTables = async () => {
  console.log('🚀 Starting inventory schema migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🔐 Ensuring pgcrypto extension is available...');
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`, { transaction });

    console.log('🧱 Ensuring inventory movement type enum exists...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_inventory_movements_type') THEN
          CREATE TYPE enum_inventory_movements_type AS ENUM ('purchase', 'usage', 'adjustment', 'return', 'transfer');
        END IF;
      END
      $$;
    `, { transaction });

    console.log('📦 Creating inventory_categories table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS inventory_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    console.log('📦 Creating inventory_items table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(255) UNIQUE,
        description TEXT,
        "categoryId" UUID REFERENCES inventory_categories(id) ON UPDATE CASCADE ON DELETE SET NULL,
        unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
        "quantityOnHand" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "reorderLevel" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "preferredVendorId" UUID REFERENCES vendors(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "unitCost" NUMERIC(12,2) NOT NULL DEFAULT 0,
        location VARCHAR(255),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT inventory_items_name_sku_check CHECK (name <> '' AND (sku IS NULL OR sku <> ''))
      );
    `, { transaction });

    console.log('📦 Creating inventory_movements table if needed...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "itemId" UUID NOT NULL REFERENCES inventory_items(id) ON UPDATE CASCADE ON DELETE CASCADE,
        type enum_inventory_movements_type NOT NULL,
        "quantityDelta" NUMERIC(12,2) NOT NULL,
        "previousQuantity" NUMERIC(12,2) NOT NULL,
        "newQuantity" NUMERIC(12,2) NOT NULL,
        "unitCost" NUMERIC(12,2),
        reference VARCHAR(255),
        notes TEXT,
        "jobId" UUID REFERENCES jobs(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "createdBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    console.log('📊 Creating indexes for inventory tables...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS inventory_items_category_idx ON inventory_items("categoryId");
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS inventory_items_active_idx ON inventory_items("isActive");
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS inventory_movements_item_idx ON inventory_movements("itemId");
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS inventory_movements_type_idx ON inventory_movements(type);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS inventory_movements_occurred_idx ON inventory_movements("occurredAt");
    `, { transaction });

    console.log('🗂️ Seeding default inventory categories...');
    const defaultCategories = [
      {
        name: 'Paper & Substrates',
        description: 'Paper stocks, vinyl, canvas, label materials, and other printable media.'
      },
      {
        name: 'Plates & Screens',
        description: 'Offset plates, flexographic plates, screen mesh, stencil supplies, and related consumables.'
      },
      {
        name: 'Inks & Toners',
        description: 'Process inks, spot colors, toners, UV inks, additives, and specialty formulations.'
      },
      {
        name: 'Coatings & Laminates',
        description: 'Aqueous and UV coatings, varnishes, laminating films, and protective finishes.'
      },
      {
        name: 'Binding & Finishing Supplies',
        description: 'Binding wires, staples, adhesives, cutting blades, shrink wraps, and finishing consumables.'
      },
      {
        name: 'Packaging & Shipping',
        description: 'Boxes, envelopes, tubes, tapes, pallets, and other packaging materials.'
      },
      {
        name: 'Maintenance & Cleaning',
        description: 'Rollers, blankets, filters, lubricants, press wash, wipes, safety gear, and maintenance supplies.'
      },
      {
        name: 'Digital Printing Media',
        description: 'Signage media, fabric substrates, magnet sheets, transfer papers, and specialty digital media.'
      },
      {
        name: 'Promotional & Miscellaneous',
        description: 'Promotional blanks, POS materials, specialty accessories, and miscellaneous items.'
      }
    ];

    for (const category of defaultCategories) {
      await sequelize.query(`
        INSERT INTO inventory_categories (id, name, description, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), :name, :description, NOW(), NOW())
        ON CONFLICT (name) DO NOTHING;
      `, { transaction, replacements: category });
    }

    await transaction.commit();
    console.log('✅ Inventory schema migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Inventory schema migration failed:', error);
    throw error;
  }
};

if (require.main === module) {
  createInventoryTables()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = createInventoryTables;


