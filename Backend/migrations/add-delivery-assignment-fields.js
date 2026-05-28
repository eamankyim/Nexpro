const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const TABLES = ['jobs', 'sales'];

const addColumnIfMissing = async (queryInterface, tableName, columnName, definition) => {
  const table = await queryInterface.describeTable(tableName);
  if (Object.prototype.hasOwnProperty.call(table, columnName)) {
    console.log(`   ✓ ${tableName}.${columnName} already exists`);
    return;
  }

  await queryInterface.addColumn(tableName, columnName, definition);
  console.log(`   ➕ added ${tableName}.${columnName}`);
};

const addDeliveryAssignmentFields = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('🏗️  Ensuring delivery assignment fields exist on jobs/sales...');

  const queryInterface = sequelize.getQueryInterface();

  try {
    for (const tableName of TABLES) {
      await addColumnIfMissing(queryInterface, tableName, 'deliveryAssignedTo', {
        type: require('sequelize').DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      });
      await addColumnIfMissing(queryInterface, tableName, 'deliveryAssignedAt', {
        type: require('sequelize').DataTypes.DATE,
        allowNull: true,
      });
      await addColumnIfMissing(queryInterface, tableName, 'deliveredBy', {
        type: require('sequelize').DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      });
      await addColumnIfMissing(queryInterface, tableName, 'deliveredAt', {
        type: require('sequelize').DataTypes.DATE,
        allowNull: true,
      });
    }
  } finally {
    if (closeConnection) {
      await sequelize.close();
    }
  }
};

if (require.main === module) {
  addDeliveryAssignmentFields({ closeConnection: true })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addDeliveryAssignmentFields;
