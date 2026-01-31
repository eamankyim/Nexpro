/**
 * Migration: Create Stock Count Tables
 * For inventory reconciliation and shrinkage detection
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create enum types
    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE stock_count_status AS ENUM ('draft', 'in_progress', 'completed', 'approved', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE stock_count_type AS ENUM ('full', 'partial', 'cycle', 'spot');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryInterface.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE variance_type AS ENUM ('match', 'shrinkage', 'overage', 'uncounted');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create stock_counts table
    await queryInterface.createTable('stock_counts', {
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
      countNumber: {
        type: Sequelize.STRING,
        allowNull: false
      },
      countDate: {
        type: Sequelize.DATE,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('draft', 'in_progress', 'completed', 'approved', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft'
      },
      countType: {
        type: Sequelize.ENUM('full', 'partial', 'cycle', 'spot'),
        allowNull: false,
        defaultValue: 'full'
      },
      totalProducts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      countedProducts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      matchedProducts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      varianceProducts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      totalVarianceValue: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0
      },
      totalShrinkageValue: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0
      },
      totalOverageValue: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0
      },
      countedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      approvedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      approvedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT
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

    // Create stock_count_items table
    await queryInterface.createTable('stock_count_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      stockCountId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'stock_counts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
      productId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      productVariantId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'product_variants',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      productName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      productSku: {
        type: Sequelize.STRING
      },
      productBarcode: {
        type: Sequelize.STRING
      },
      unitCost: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0
      },
      systemQuantity: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
      },
      countedQuantity: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      varianceQuantity: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      varianceValue: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      varianceType: {
        type: Sequelize.ENUM('match', 'shrinkage', 'overage', 'uncounted'),
        defaultValue: 'uncounted'
      },
      adjustmentApplied: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      adjustmentNotes: {
        type: Sequelize.TEXT
      },
      countedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      countedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
    await queryInterface.addIndex('stock_counts', ['tenantId']);
    await queryInterface.addIndex('stock_counts', ['shopId']);
    await queryInterface.addIndex('stock_counts', ['countDate']);
    await queryInterface.addIndex('stock_counts', ['status']);

    await queryInterface.addIndex('stock_count_items', ['stockCountId']);
    await queryInterface.addIndex('stock_count_items', ['tenantId']);
    await queryInterface.addIndex('stock_count_items', ['productId']);
    await queryInterface.addIndex('stock_count_items', ['varianceType']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('stock_count_items');
    await queryInterface.dropTable('stock_counts');

    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS stock_count_status;
      DROP TYPE IF EXISTS stock_count_type;
      DROP TYPE IF EXISTS variance_type;
    `);
  }
};
