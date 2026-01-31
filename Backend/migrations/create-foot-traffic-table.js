/**
 * Migration: Create Foot Traffic Table
 * Tracks customer visits/foot traffic for retail intelligence
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create enum type for entry method
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE foot_traffic_entry_method AS ENUM ('manual', 'iot_counter', 'camera', 'mobile_checkin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create enum type for period type
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE foot_traffic_period_type AS ENUM ('hourly', 'daily', 'custom');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.createTable('foot_traffic', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      tenantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      shopId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'shops',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      visitorCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      entryMethod: {
        type: Sequelize.ENUM('manual', 'iot_counter', 'camera', 'mobile_checkin'),
        allowNull: false,
        defaultValue: 'manual'
      },
      periodType: {
        type: Sequelize.ENUM('hourly', 'daily', 'custom'),
        allowNull: false,
        defaultValue: 'daily'
      },
      periodStart: {
        type: Sequelize.DATE,
        allowNull: false
      },
      periodEnd: {
        type: Sequelize.DATE,
        allowNull: false
      },
      purchaseCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      periodRevenue: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
      },
      deviceId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      weather: {
        type: Sequelize.STRING,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      recordedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {}
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('foot_traffic', ['tenantId']);
    await queryInterface.addIndex('foot_traffic', ['shopId']);
    await queryInterface.addIndex('foot_traffic', ['periodStart']);
    await queryInterface.addIndex('foot_traffic', ['periodEnd']);
    await queryInterface.addIndex('foot_traffic', ['entryMethod']);
    await queryInterface.addIndex('foot_traffic', ['tenantId', 'periodStart', 'periodEnd']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('foot_traffic');
    
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS foot_traffic_entry_method;
      DROP TYPE IF EXISTS foot_traffic_period_type;
    `);
  }
};
