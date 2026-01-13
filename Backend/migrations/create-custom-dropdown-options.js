'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('custom_dropdown_options', {
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
      dropdownType: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Type of dropdown: job_category, customer_source, employee_relationship, employee_bank, lead_source, region, etc.'
      },
      value: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'The custom option value entered by user'
      },
      label: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Optional display label (defaults to value)'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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

    // Create unique index
    await queryInterface.addIndex('custom_dropdown_options', {
      fields: ['tenantId', 'dropdownType', 'value'],
      unique: true,
      name: 'unique_tenant_dropdown_value'
    });

    // Create index for queries
    await queryInterface.addIndex('custom_dropdown_options', {
      fields: ['tenantId', 'dropdownType', 'isActive'],
      name: 'idx_tenant_dropdown_active'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('custom_dropdown_options');
  }
};



