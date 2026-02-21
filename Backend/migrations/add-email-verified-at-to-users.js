const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Add email_verified_at to users table for email verification (hybrid flow)
 */

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  const tableDesc = await queryInterface.describeTable('users');
  if (tableDesc.email_verified_at) {
    console.log('[Migration] email_verified_at already exists on users, skipping.');
    return;
  }

  console.log('Adding email_verified_at to users table...');
  await queryInterface.addColumn('users', 'email_verified_at', {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When the user verified their email via link',
  });
  console.log('[Migration] email_verified_at added successfully!');
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();
  console.log('Removing email_verified_at from users table...');
  await queryInterface.removeColumn('users', 'email_verified_at');
  console.log('[Migration] email_verified_at removed');
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
