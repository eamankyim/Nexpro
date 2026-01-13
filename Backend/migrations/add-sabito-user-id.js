const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Add sabito_user_id field to users table for SSO integration
 */

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Adding sabito_user_id to users table...');
  
  await queryInterface.addColumn('users', 'sabito_user_id', {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: 'Sabito user ID for SSO integration'
  });

  // Add index for faster lookups
  await queryInterface.addIndex('users', ['sabito_user_id'], {
    name: 'idx_users_sabito_user_id',
    unique: true,
    where: {
      sabito_user_id: {
        [require('sequelize').Op.ne]: null
      }
    }
  });

  console.log('[Migration] sabito_user_id field added successfully!');
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();

  console.log('Removing sabito_user_id from users table...');
  
  await queryInterface.removeIndex('users', 'idx_users_sabito_user_id');
  await queryInterface.removeColumn('users', 'sabito_user_id');
  
  console.log('[Migration] sabito_user_id field removed');
}

// Run migration if called directly
if (require.main === module) {
  up()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { up, down };






