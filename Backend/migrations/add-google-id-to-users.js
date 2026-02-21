const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');
const { Op } = require('sequelize');

/**
 * Add google_id field to users table for Google OAuth sign-in/sign-up
 */

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Adding google_id to users table...');

  await queryInterface.addColumn('users', 'google_id', {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: 'Google subject ID for OAuth sign-in',
  });

  await queryInterface.addIndex('users', ['google_id'], {
    name: 'idx_users_google_id',
    unique: true,
    where: {
      google_id: { [Op.ne]: null },
    },
  });

  console.log('[Migration] google_id field added successfully!');
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Removing google_id from users table...');

  await queryInterface.removeIndex('users', 'idx_users_google_id');
  await queryInterface.removeColumn('users', 'google_id');

  console.log('[Migration] google_id field removed');
}

if (require.main === module) {
  up()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { up, down };
