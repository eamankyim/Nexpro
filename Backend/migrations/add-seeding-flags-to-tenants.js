/**
 * Migration: Add seeding status flags to tenants table
 * These flags help avoid redundant seeding operations on every API call.
 */

const { sequelize } = require('../config/database');

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Adding seeding flags to tenants table...');

  // Add categoriesSeeded flag
  try {
    await queryInterface.addColumn('tenants', 'categoriesSeeded', {
      type: sequelize.Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    console.log('✅ Added categoriesSeeded column');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('ℹ️  categoriesSeeded column already exists');
    } else {
      throw err;
    }
  }

  // Add accountsSeeded flag
  try {
    await queryInterface.addColumn('tenants', 'accountsSeeded', {
      type: sequelize.Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    console.log('✅ Added accountsSeeded column');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('ℹ️  accountsSeeded column already exists');
    } else {
      throw err;
    }
  }

  // Add equipmentCategoriesSeeded flag
  try {
    await queryInterface.addColumn('tenants', 'equipmentCategoriesSeeded', {
      type: sequelize.Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    console.log('✅ Added equipmentCategoriesSeeded column');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('ℹ️  equipmentCategoriesSeeded column already exists');
    } else {
      throw err;
    }
  }

  // Mark existing tenants as seeded (they already have their data)
  const [updated] = await sequelize.query(`
    UPDATE tenants 
    SET "categoriesSeeded" = true, 
        "accountsSeeded" = true, 
        "equipmentCategoriesSeeded" = true
    WHERE "categoriesSeeded" = false
  `);
  console.log(`✅ Marked existing tenants as seeded`);

  console.log('Migration complete!');
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();
  
  await queryInterface.removeColumn('tenants', 'categoriesSeeded');
  await queryInterface.removeColumn('tenants', 'accountsSeeded');
  await queryInterface.removeColumn('tenants', 'equipmentCategoriesSeeded');
  
  console.log('Removed seeding flag columns');
}

module.exports = { up, down };

// Run directly if called as script
if (require.main === module) {
  up()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
