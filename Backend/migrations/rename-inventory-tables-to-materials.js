/**
 * Rename inventory_* tables to materials_* for full materials/equipment consistency.
 * Drops FKs that reference these tables, renames tables, re-adds FKs.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

async function up() {
  const queryInterface = sequelize.getQueryInterface();
  const dialect = sequelize.getDialect();

  if (dialect !== 'postgres') {
    console.log('⚠️  rename-inventory-tables-to-materials: written for PostgreSQL; skipping.');
    return;
  }

  console.log('🔄 Renaming inventory_* tables to materials_*...');

  const [fkList] = await sequelize.query(`
    SELECT tc.constraint_name, tc.table_name, kcu.column_name,
           ccu.table_name AS ref_table, ccu.column_name AS ref_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND (ccu.table_name IN ('inventory_categories', 'inventory_items', 'inventory_movements')
           OR tc.table_name IN ('inventory_categories', 'inventory_items', 'inventory_movements'));
  `);

  for (const fk of fkList) {
    await sequelize.query(`ALTER TABLE "${fk.table_name}" DROP CONSTRAINT IF EXISTS "${fk.constraint_name}";`);
    console.log(`  Dropped FK ${fk.table_name}.${fk.constraint_name}`);
  }

  const renames = [
    ['inventory_categories', 'materials_categories'],
    ['inventory_items', 'materials_items'],
    ['inventory_movements', 'materials_movements']
  ];

  for (const [oldName, newName] of renames) {
    const [tables] = await sequelize.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ?`,
      { replacements: [oldName] }
    );
    if (tables.length > 0) {
      await sequelize.query(`ALTER TABLE "${oldName}" RENAME TO "${newName}";`);
      console.log(`  Renamed ${oldName} -> ${newName}`);
    }
  }

  // Re-add FKs: materials_items.categoryId -> materials_categories.id
  const [hasItems] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materials_items'`
  );
  if (hasItems.length > 0) {
    await sequelize.query(`
      ALTER TABLE "materials_items"
      ADD CONSTRAINT "materials_items_category_id_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "materials_categories"("id") ON UPDATE CASCADE ON DELETE SET NULL;
    `);
    console.log('  Added FK materials_items.categoryId -> materials_categories.id');
  }

  // materials_movements.itemId -> materials_items.id
  const [hasMovements] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materials_movements'`
  );
  if (hasMovements.length > 0) {
    await sequelize.query(`
      ALTER TABLE "materials_movements"
      ADD CONSTRAINT "materials_movements_item_id_fkey"
      FOREIGN KEY ("itemId") REFERENCES "materials_items"("id") ON UPDATE CASCADE ON DELETE CASCADE;
    `);
    console.log('  Added FK materials_movements.itemId -> materials_items.id');
  }

  // drugs.categoryId -> materials_categories.id (if drugs table exists)
  const [hasDrugs] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drugs'`
  );
  if (hasDrugs.length > 0) {
    await sequelize.query(`
      ALTER TABLE "drugs"
      ADD CONSTRAINT "drugs_category_id_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "materials_categories"("id") ON UPDATE CASCADE ON DELETE SET NULL;
    `).catch(() => {});
    console.log('  Added FK drugs.categoryId -> materials_categories.id (if not exists)');
  }

  console.log('✅ Rename inventory -> materials tables done.');
}

async function down() {
  const dialect = sequelize.getDialect();
  if (dialect !== 'postgres') return;

  // Drop FKs, rename back
  await sequelize.query(`ALTER TABLE "drugs" DROP CONSTRAINT IF EXISTS "drugs_category_id_fkey";`);
  await sequelize.query(`ALTER TABLE "materials_movements" DROP CONSTRAINT IF EXISTS "materials_movements_item_id_fkey";`);
  await sequelize.query(`ALTER TABLE "materials_items" DROP CONSTRAINT IF EXISTS "materials_items_category_id_fkey";`);

  await sequelize.query(`ALTER TABLE "materials_movements" RENAME TO "inventory_movements";`);
  await sequelize.query(`ALTER TABLE "materials_items" RENAME TO "inventory_items";`);
  await sequelize.query(`ALTER TABLE "materials_categories" RENAME TO "inventory_categories";`);

  // Re-add original FKs (would need to be restored to match create-inventory-tables; minimal restore)
  await sequelize.query(`
    ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_category_id_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON UPDATE CASCADE ON DELETE SET NULL;
  `);
  await sequelize.query(`
    ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_fkey"
    FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON UPDATE CASCADE ON DELETE CASCADE;
  `);
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up, down };
